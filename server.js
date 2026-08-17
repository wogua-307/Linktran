const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { createStorage } = require('./storage');

const PORT = Number(process.env.PORT) || 9527;
const HOST = '0.0.0.0';
const ROOT = __dirname;
const PUBLIC = process.env.PUBLIC_DIR || path.join(ROOT, 'public');
const UPLOADS = process.env.UPLOADS_DIR || path.join(ROOT, 'uploads');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const MAX_FILE_SIZE = 1024 * 1024 * 1024;
const clients = new Map();
const storage = createStorage(DATA);
const savedState = storage.loadState();
const profiles = new Map(savedState.profiles.map(profile => [profile.id, profile]));
const chats = new Map(savedState.chats.map(chat => [chat.id, chat]));

fs.mkdirSync(UPLOADS, { recursive: true });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8'
};

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function cleanText(value, max = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function safeFilename(value) {
  const cleaned = path.basename(cleanText(value, 180)).replace(/[\\/:*?"<>|]/g, '_');
  return cleaned || '未命名文件';
}

function profileFor(id) {
  return profiles.get(id) || { id, name: '匿名设备', avatar: '' };
}

function canAccess(chat, clientId) {
  return chat && (chat.members === null || chat.members.includes(clientId));
}

function publicChat(chat, clientId, includeHistory = false) {
  if (!canAccess(chat, clientId)) return null;
  const result = { id: chat.id, type: chat.type, name: chat.name, members: chat.members, createdAt: chat.createdAt };
  if (includeHistory) result.history = chat.history;
  return result;
}

function send(client, type, data) {
  client?.res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(type, data) {
  for (const client of clients.values()) send(client, type, data);
}

function sendToChat(chat, type, data) {
  for (const client of clients.values()) if (canAccess(chat, client.id)) send(client, type, data);
}

function broadcastPresence() {
  const online = [...clients.keys()].map(profileFor);
  broadcast('presence', online);
}

function addEvent(chat, event) {
  const sender = profileFor(event.senderId);
  const item = storage.saveEvent({ id: crypto.randomUUID(), chatId: chat.id, time: Date.now(), name: sender.name, ...event });
  chat.history.push(item);
  if (chat.history.length > 100) chat.history.shift();
  sendToChat(chat, 'event', item);
  return item;
}

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 512 * 1024) throw new Error('请求内容过大');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function serveFile(res, filename, downloadName) {
  fs.stat(filename, (error, stat) => {
    if (error || !stat.isFile()) return json(res, 404, { error: '文件不存在' });
    const headers = {
      'Content-Type': mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': downloadName ? 'private, max-age=3600' : 'no-cache'
    };
    if (downloadName) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
    res.writeHead(200, headers);
    fs.createReadStream(filename).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, { app: 'linktran', status: 'ok', port: PORT });
    }

    if (req.method === 'GET' && url.pathname === '/api/events') {
      const id = cleanText(url.searchParams.get('id'), 80) || crypto.randomUUID();
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      clients.set(id, { id, res });
      const accessibleChats = [...chats.values()].map(chat => publicChat(chat, id, true)).filter(Boolean);
      send(clients.get(id), 'bootstrap', { chats: accessibleChats, profiles: Object.fromEntries(profiles) });
      broadcastPresence();
      req.on('close', () => {
        if (clients.get(id)?.res === res) clients.delete(id);
        broadcastPresence();
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/profile') {
      const body = await readJson(req);
      const id = cleanText(body.id, 80);
      const name = cleanText(body.name, 30) || '匿名设备';
      const avatar = String(body.avatar || '');
      if (!id) return json(res, 400, { error: '设备 ID 不能为空' });
      if (avatar && (!/^data:image\/(?:png|jpeg|webp);base64,/.test(avatar) || avatar.length > 300 * 1024)) {
        return json(res, 400, { error: '头像格式不支持或文件过大' });
      }
      const profile = { id, name, avatar };
      storage.upsertProfile(profile);
      profiles.set(id, profile);
      broadcast('profile', profile);
      broadcastPresence();
      return json(res, 200, profile);
    }

    if (req.method === 'POST' && url.pathname === '/api/chats') {
      const body = await readJson(req);
      const creatorId = cleanText(body.creatorId, 80);
      const requestedMembers = Array.isArray(body.members) ? body.members.map(id => cleanText(id, 80)).filter(Boolean) : [];
      const members = [...new Set([creatorId, ...requestedMembers])];
      if (!creatorId || members.length < 2) return json(res, 400, { error: '请选择至少一台其他设备' });
      let chat;
      if (body.type === 'dm' && members.length === 2) {
        const id = `dm:${members.slice().sort().join(':')}`;
        chat = chats.get(id) || { id, type: 'dm', name: '', members, history: [], createdAt: Date.now() };
        if (!chats.has(id)) storage.saveChat(chat);
        chats.set(id, chat);
      } else {
        const name = cleanText(body.name, 40) || '新群聊';
        chat = { id: `group:${crypto.randomUUID()}`, type: 'group', name, members, history: [], createdAt: Date.now() };
        storage.saveChat(chat);
        chats.set(chat.id, chat);
      }
      for (const memberId of chat.members) send(clients.get(memberId), 'chat', publicChat(chat, memberId, true));
      return json(res, 201, publicChat(chat, creatorId, true));
    }

    if (req.method === 'POST' && url.pathname === '/api/messages') {
      const body = await readJson(req);
      const text = cleanText(body.text, 2000);
      const senderId = cleanText(body.id, 80);
      const chat = chats.get(cleanText(body.chatId, 140));
      if (!text) return json(res, 400, { error: '消息不能为空' });
      if (!canAccess(chat, senderId)) return json(res, 403, { error: '无权访问该会话' });
      return json(res, 201, addEvent(chat, { type: 'message', senderId, text }));
    }

    if (req.method === 'POST' && url.pathname === '/api/files') {
      const size = Number(req.headers['content-length'] || 0);
      const senderId = cleanText(req.headers['x-client-id'], 80);
      const chat = chats.get(cleanText(req.headers['x-chat-id'], 140));
      if (!canAccess(chat, senderId)) return json(res, 403, { error: '无权访问该会话' });
      if (!size || size > MAX_FILE_SIZE) return json(res, 413, { error: '文件为空或超过 1 GB' });
      const originalName = safeFilename(decodeURIComponent(req.headers['x-file-name'] || ''));
      const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(originalName)}`;
      const target = path.join(UPLOADS, storedName);
      const output = fs.createWriteStream(target, { flags: 'wx' });
      let received = 0;
      req.on('data', chunk => {
        received += chunk.length;
        if (received > MAX_FILE_SIZE) req.destroy(new Error('文件超过 1 GB'));
      });
      req.pipe(output);
      try {
        await new Promise((resolve, reject) => {
          output.on('finish', resolve); output.on('error', reject);
          req.on('aborted', () => reject(new Error('上传已中断'))); req.on('error', reject);
        });
      } catch (error) {
        output.destroy(); fs.rm(target, { force: true }, () => {}); throw error;
      }
      try {
        return json(res, 201, addEvent(chat, {
          type: 'file', senderId,
          file: { name: originalName, size: received, url: `/files/${storedName}` }
        }));
      } catch (error) {
        fs.rm(target, { force: true }, () => {});
        throw error;
      }
    }

    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      const storedName = path.basename(url.pathname.slice('/files/'.length));
      const originalName = storage.getFileName(`/files/${storedName}`);
      return serveFile(res, path.join(UPLOADS, storedName), originalName || storedName);
    }

    if (req.method === 'GET') {
      const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const filename = path.resolve(PUBLIC, requested);
      if (!filename.startsWith(`${PUBLIC}${path.sep}`) && filename !== path.join(PUBLIC, 'index.html')) return json(res, 403, { error: '禁止访问' });
      return serveFile(res, filename);
    }
    json(res, 404, { error: '接口不存在' });
  } catch (error) {
    if (!res.headersSent) json(res, 500, { error: error.message || '服务器错误' });
  }
});

server.listen(PORT, HOST, () => {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) if (entry.family === 'IPv4' && !entry.internal) addresses.push(`http://${entry.address}:${PORT}`);
  }
  console.log(`\n局域网传输已启动\n本机访问: http://localhost:${PORT}`);
  for (const address of addresses) console.log(`其他设备: ${address}`);
  console.log(`数据文件: ${storage.filename}`);
  console.log('\n保持此终端运行，并让设备连接同一个 Wi-Fi。\n');
});

setInterval(() => broadcast('ping', Date.now()), 25000).unref();

function shutdown() {
  server.close(() => { storage.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 3000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
