const LinktranDB = (() => {
  const DB_NAME = 'linktran-extension';
  const DB_VERSION = 1;

  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('conversations')) db.createObjectStore('conversations', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('messages')) {
          const messages = db.createObjectStore('messages', { keyPath: 'id' });
          messages.createIndex('conversationTime', ['conversationId', 'createdAt']);
          messages.createIndex('status', 'status');
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function transact(storeName, mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  const get = (store, key) => transact(store, 'readonly', objectStore => objectStore.get(key));
  const put = (store, value) => transact(store, 'readwrite', objectStore => objectStore.put(value));
  const getAll = store => transact(store, 'readonly', objectStore => objectStore.getAll());

  async function savePage(tab) {
    const conversation = { id: 'saved-pages', type: 'saved', name: '网页收藏', updatedAt: Date.now() };
    await put('conversations', conversation);
    const message = {
      id: crypto.randomUUID(), conversationId: conversation.id, type: 'link',
      title: tab.title || tab.url, url: tab.url, createdAt: Date.now(), status: 'saved'
    };
    await put('messages', message);
    return message;
  }

  async function stats() {
    const [profiles, conversations, messages] = await Promise.all([
      getAll('profiles'), getAll('conversations'), getAll('messages')
    ]);
    return { profiles: profiles.length, conversations: conversations.length, messages: messages.length };
  }

  return { open, get, put, getAll, savePage, stats };
})();

globalThis.LinktranDB = LinktranDB;
