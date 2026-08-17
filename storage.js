const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function createStorage(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const filename = path.join(dataDir, 'linchuan.db');
  const db = new DatabaseSync(filename);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('lobby', 'dm', 'group')),
      name TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      profile_id TEXT NOT NULL,
      PRIMARY KEY (chat_id, profile_id)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('message', 'file')),
      text TEXT,
      file_name TEXT,
      file_size INTEGER,
      file_url TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE (chat_id, sequence)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS idx_messages_chat_sequence ON messages(chat_id, sequence DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_file_url ON messages(file_url) WHERE file_url IS NOT NULL;
  `);

  db.prepare(`
    INSERT OR IGNORE INTO chats (id, type, name, created_at)
    VALUES ('lobby', 'lobby', '共享空间', ?)
  `).run(Date.now());

  const statements = {
    upsertProfile: db.prepare(`
      INSERT INTO profiles (id, name, avatar, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, updated_at = excluded.updated_at
    `),
    insertChat: db.prepare('INSERT OR IGNORE INTO chats (id, type, name, created_at) VALUES (?, ?, ?, ?)'),
    insertMember: db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, profile_id) VALUES (?, ?)'),
    nextSequence: db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM messages WHERE chat_id = ?'),
    insertMessage: db.prepare(`
      INSERT INTO messages (id, chat_id, sender_id, sequence, type, text, file_name, file_size, file_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    fileByUrl: db.prepare('SELECT file_name AS name FROM messages WHERE file_url = ? AND type = \'file\''),
    profiles: db.prepare('SELECT id, name, avatar FROM profiles ORDER BY updated_at'),
    chats: db.prepare('SELECT id, type, name, created_at AS createdAt FROM chats ORDER BY created_at'),
    members: db.prepare('SELECT profile_id AS id FROM chat_members WHERE chat_id = ? ORDER BY rowid'),
    histories: db.prepare(`
      SELECT * FROM (
        SELECT id, chat_id AS chatId, sender_id AS senderId, sequence, type, text,
               file_name AS fileName, file_size AS fileSize, file_url AS fileUrl, created_at AS time
        FROM messages WHERE chat_id = ? ORDER BY sequence DESC LIMIT ?
      ) ORDER BY sequence
    `)
  };

  function upsertProfile(profile) {
    statements.upsertProfile.run(profile.id, profile.name, profile.avatar, Date.now());
  }

  function saveChat(chat) {
    db.exec('BEGIN IMMEDIATE');
    try {
      statements.insertChat.run(chat.id, chat.type, chat.name, chat.createdAt);
      for (const memberId of chat.members || []) statements.insertMember.run(chat.id, memberId);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function saveEvent(item) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const sequence = Number(statements.nextSequence.get(item.chatId).sequence);
      statements.insertMessage.run(
        item.id, item.chatId, item.senderId, sequence, item.type,
        item.type === 'message' ? item.text : null,
        item.type === 'file' ? item.file.name : null,
        item.type === 'file' ? item.file.size : null,
        item.type === 'file' ? item.file.url : null,
        item.time
      );
      db.exec('COMMIT');
      return { ...item, sequence };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function rowToEvent(row) {
    const item = {
      id: row.id, chatId: row.chatId, senderId: row.senderId,
      sequence: Number(row.sequence), type: row.type, time: Number(row.time)
    };
    if (row.type === 'file') item.file = { name: row.fileName, size: Number(row.fileSize), url: row.fileUrl };
    else item.text = row.text;
    return item;
  }

  function loadState(historyLimit = 100) {
    const profiles = statements.profiles.all().map(row => ({ ...row }));
    const chats = statements.chats.all().map(row => ({
      ...row,
      createdAt: Number(row.createdAt),
      members: row.type === 'lobby' ? null : statements.members.all(row.id).map(member => member.id),
      history: statements.histories.all(row.id, historyLimit).map(rowToEvent)
    }));
    return { profiles, chats };
  }

  return {
    filename,
    upsertProfile,
    saveChat,
    saveEvent,
    loadState,
    getFileName(fileUrl) { return statements.fileByUrl.get(fileUrl)?.name || null; },
    close() { db.close(); }
  };
}

module.exports = { createStorage };
