const $ = selector => document.querySelector(selector);
const clientId = localStorage.lanClientId || (localStorage.lanClientId = createClientId());
let deviceName = localStorage.lanDeviceName || `${deviceLabel()} ${Math.floor(Math.random() * 90 + 10)}`;
let deviceAvatar = localStorage.lanDeviceAvatar || '';
let pendingAvatar = deviceAvatar;
let notificationsEnabled = localStorage.lanNotifications !== 'false';
let source;
let activeChatId = 'lobby';
let activeChatTab = 'group';
let onlineDevices = [];
const chats = new Map();
const profiles = new Map();
const seen = new Set();
const unreadCounts = new Map();
const emojis = ['😀','😄','😁','😂','🥹','😊','😍','🥰','😘','😎','🤓','🧐','🤔','😴','😭','😤','😡','🥳','🤩','😇','👍','👎','👌','✌️','🤝','👏','🙌','🙏','💪','👀','❤️','💛','💚','💙','💜','🔥','✨','🎉','🎁','🚀','💡','✅','❌','📎','📁','☕','🍻','🌹'];

function createClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return '设备';
}

function initials(name) { return [...String(name || '?').trim()].slice(0, 2).join('').toUpperCase(); }
function escapeHtml(text) { const el = document.createElement('div'); el.textContent = text; return el.innerHTML; }
function formatTime(time) { return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(time); }
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}
function showToast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => el.classList.remove('show'), 2200); }
function totalUnread() { return [...unreadCounts.values()].reduce((total, count) => total + count, 0); }
function updateDocumentTitle() {
  const unread = totalUnread(); document.title = unread ? `(${unread}) 邻传` : '邻传';
}
async function requestNotificationPermission() {
  if (!('Notification' in globalThis) || Notification.permission !== 'default') return;
  try { await Notification.requestPermission(); } catch { /* Page alerts remain available on restricted HTTP origins. */ }
}
function notifyNewMessage(item) {
  if (!notificationsEnabled) return;
  const sender = profileFor(item.senderId);
  const content = item.type === 'file' ? `发送了文件：${item.file.name}` : item.text;
  showToast(`${sender.name}：${content.slice(0, 50)}`);
  if ('Notification' in globalThis && Notification.permission === 'granted') {
    const notification = new Notification(`邻传 · ${sender.name}`, { body: content.slice(0, 120), icon: '/logo.svg', tag: item.chatId });
    notification.onclick = () => { globalThis.focus(); selectChat(item.chatId); notification.close(); };
  }
}
function openModal(modal) {
  if (typeof modal.showModal === 'function') modal.showModal();
  else { modal.setAttribute('open', ''); document.body.classList.add('modal-open'); }
}
function closeModal(modal) {
  if (typeof modal.close === 'function') modal.close();
  else { modal.removeAttribute('open'); document.body.classList.remove('modal-open'); }
}
function profileFor(id) { return profiles.get(id) || { id, name: '匿名设备', avatar: '' }; }
function avatarHtml(profile, extraClass = '') {
  const content = profile.avatar ? `<img src="${profile.avatar}" alt="">` : escapeHtml(initials(profile.name));
  return `<span class="avatar ${extraClass}">${content}</span>`;
}

function groupAvatarHtml(chat) {
  const members = chat.members.slice(0, 4).map(profileFor);
  return `<span class="group-avatar group-${members.length}">${members.map(profile => avatarHtml(profile, 'group-avatar-cell')).join('')}</span>`;
}

function chatLabel(chat) {
  if (chat.type !== 'dm') return chat.name;
  const peerId = chat.members.find(id => id !== clientId);
  return profileFor(peerId).name;
}

function chatAvatar(chat) {
  if (chat.type === 'lobby') return `<span class="chat-symbol lobby-symbol"><i>⇄</i></span>`;
  if (chat.type === 'group') return groupAvatarHtml(chat);
  return avatarHtml(profileFor(chat.members.find(id => id !== clientId)));
}

function updateIdentity() {
  const profile = { name: deviceName, avatar: deviceAvatar };
  $('#displayName').textContent = deviceName;
  $('#avatar').innerHTML = profile.avatar ? `<img src="${profile.avatar}" alt="">` : escapeHtml(initials(profile.name));
}

async function saveProfile() {
  const response = await fetch('/api/profile', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: clientId, name: deviceName, avatar: deviceAvatar })
  });
  if (!response.ok) throw new Error((await response.json()).error);
  const profile = await response.json();
  profiles.set(profile.id, profile);
  return profile;
}

function connect() {
  source?.close();
  source = new EventSource(`/api/events?id=${encodeURIComponent(clientId)}`);
  source.addEventListener('bootstrap', event => {
    const data = JSON.parse(event.data);
    Object.values(data.profiles).forEach(profile => profiles.set(profile.id, profile));
    data.chats.forEach(chat => chats.set(chat.id, chat));
    renderChats(); selectChat(chats.has(activeChatId) ? activeChatId : 'lobby');
  });
  source.addEventListener('presence', event => {
    onlineDevices = JSON.parse(event.data);
    onlineDevices.forEach(profile => profiles.set(profile.id, profile));
    renderDevices(); renderChats(); updateChatHeader();
  });
  source.addEventListener('profile', event => {
    const profile = JSON.parse(event.data); profiles.set(profile.id, profile);
    renderDevices(); renderChats(); updateChatHeader(); renderMessages();
  });
  source.addEventListener('chat', event => {
    const chat = JSON.parse(event.data); chats.set(chat.id, chat); renderChats();
    if (!chats.has(activeChatId)) selectChat(chat.id);
  });
  source.addEventListener('event', event => {
    const item = JSON.parse(event.data);
    const chat = chats.get(item.chatId);
    if (!chat) return;
    if (!chat.history.some(existing => existing.id === item.id)) chat.history.push(item);
    if (item.chatId === activeChatId) renderEvent(item);
    else if (item.senderId !== clientId) {
      unreadCounts.set(item.chatId, (unreadCounts.get(item.chatId) || 0) + 1);
      updateDocumentTitle(); notifyNewMessage(item);
    }
    renderChats();
  });
  source.onerror = () => showToast('连接中断，正在重连…');
}

function renderChats() {
  const ordered = [...chats.values()].filter(chat => activeChatTab === 'dm' ? chat.type === 'dm' : chat.type !== 'dm').sort((a, b) => {
    if (a.id === 'lobby') return -1; if (b.id === 'lobby') return 1;
    const aTime = a.history.at(-1)?.time || a.createdAt;
    const bTime = b.history.at(-1)?.time || b.createdAt;
    return bTime - aTime;
  });
  $('#chatList').innerHTML = ordered.map(chat => {
    const last = chat.history.at(-1);
    const preview = last ? (last.type === 'file' ? `[文件] ${last.file.name}` : last.text) : (chat.type === 'lobby' ? '所有设备都能看到' : '暂无消息');
    const unread = unreadCounts.get(chat.id) || 0;
    return `<button class="chat-row${chat.id === activeChatId ? ' active' : ''}" data-chat-id="${escapeHtml(chat.id)}">${chatAvatar(chat)}<span class="chat-content"><strong>${escapeHtml(chatLabel(chat))}</strong><small>${escapeHtml(preview)}</small></span>${unread ? `<b class="unread-badge">${unread > 99 ? '99+' : unread}</b>` : ''}</button>`;
  }).join('');
}

function setChatTab(tab) {
  activeChatTab = tab === 'dm' ? 'dm' : 'group';
  $('#chatTabs').querySelectorAll('[data-chat-tab]').forEach(button => {
    const active = button.dataset.chatTab === activeChatTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  renderChats();
}

function renderDevices() {
  $('#onlineCount').textContent = onlineDevices.length;
  $('#deviceList').innerHTML = onlineDevices.map(profile => `
    <button class="device-row" data-device-id="${escapeHtml(profile.id)}"${profile.id === clientId ? ' disabled' : ''}>
      ${avatarHtml(profile)}<span><strong>${escapeHtml(profile.name)}${profile.id === clientId ? '（本机）' : ''}</strong><small>${profile.id === clientId ? '当前设备' : '点击发起单聊'}</small></span>
    </button>`).join('');
}

function updateChatHeader() {
  const chat = chats.get(activeChatId); if (!chat) return;
  $('#chatTitle').textContent = chatLabel(chat);
  if (chat.type === 'lobby') $('#chatSubtitle').textContent = `${onlineDevices.length} 台设备在线`;
  else if (chat.type === 'dm') $('#chatSubtitle').textContent = onlineDevices.some(device => chat.members.includes(device.id) && device.id !== clientId) ? '在线' : '离线';
  else $('#chatSubtitle').textContent = `${chat.members.length} 位成员`;
}

function selectChat(chatId) {
  if (!chats.has(chatId)) return;
  activeChatId = chatId;
  unreadCounts.delete(chatId); updateDocumentTitle();
  setChatTab(chats.get(chatId).type === 'dm' ? 'dm' : 'group');
  seen.clear(); renderChats(); updateChatHeader(); renderMessages();
  if (innerWidth <= 700) $('.sidebar').classList.remove('open');
}

function renderMessages() {
  const chat = chats.get(activeChatId); if (!chat) return;
  seen.clear(); $('#messages').innerHTML = '';
  if (!chat.history.length) {
    $('#messages').innerHTML = `<div class="empty"><span>⇄</span><h2>${escapeHtml(chatLabel(chat))}</h2><p>这里还没有消息</p></div>`;
    return;
  }
  chat.history.forEach(renderEvent);
}

function renderEvent(item) {
  if (seen.has(item.id)) return;
  seen.add(item.id); $('#messages .empty')?.remove();
  const mine = item.senderId === clientId;
  const sender = profileFor(item.senderId);
  const extension = item.type === 'file' ? (item.file.name.split('.').pop() || 'FILE').slice(0, 4) : '';
  const content = item.type === 'file'
    ? `<a class="file-card" href="${item.file.url}"><span class="file-icon">${escapeHtml(extension)}</span><span class="file-details"><strong>${escapeHtml(item.file.name)}</strong><small>${formatSize(item.file.size)}</small></span><span class="download">↓</span></a>`
    : `<div class="bubble markdown-body">${LinktranMarkdown.render(item.text)}</div>`;
  const article = document.createElement('article');
  article.className = `event${mine ? ' mine' : ''}`;
  article.innerHTML = `${avatarHtml(sender, 'event-avatar')}<div class="event-body"><div class="event-meta"><strong>${escapeHtml(mine ? '我' : sender.name)}</strong><time>${formatTime(item.time)}</time></div>${content}</div>`;
  $('#messages').append(article); $('#messages').scrollTop = $('#messages').scrollHeight;
}

async function createChat(type, members, name = '') {
  const response = await fetch('/api/chats', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, creatorId: clientId, members, name })
  });
  if (!response.ok) throw new Error((await response.json()).error);
  const chat = await response.json(); chats.set(chat.id, chat); selectChat(chat.id); return chat;
}

async function sendMessage(text) {
  const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: clientId, chatId: activeChatId, text }) });
  if (!response.ok) throw new Error((await response.json()).error);
}

function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/files');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('X-Client-Id', clientId); xhr.setRequestHeader('X-Chat-Id', activeChatId);
    xhr.upload.onprogress = event => {
      const percent = event.lengthComputable ? Math.round(event.loaded / event.total * 100) : 0;
      $('#uploadText').textContent = `正在发送 ${file.name} · ${percent}%`; $('#uploadBar').style.width = `${percent}%`;
    };
    xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(JSON.parse(xhr.responseText).error));
    xhr.onerror = () => reject(new Error('网络连接失败')); xhr.send(file);
  });
}

async function uploadFiles(files) {
  if (!files.length) return; const progress = $('#uploadProgress'); progress.classList.remove('hidden');
  try { for (const file of files) await uploadFile(file); showToast(`${files.length} 个文件发送完成`); }
  catch (error) { showToast(error.message); }
  finally { progress.classList.add('hidden'); $('#uploadBar').style.width = '0'; $('#fileInput').value = ''; }
}

function openGroupDialog() {
  const peers = onlineDevices.filter(device => device.id !== clientId);
  if (!peers.length) return showToast('暂无其他在线设备');
  $('#groupName').value = '';
  $('#groupMembers').innerHTML = peers.map(profile => `<label class="member-option"><input type="checkbox" value="${escapeHtml(profile.id)}">${avatarHtml(profile)}<span><strong>${escapeHtml(profile.name)}</strong><small>在线</small></span><i>✓</i></label>`).join('');
  openModal($('#groupDialog'));
}

function resizeAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) return reject(new Error('请选择 PNG、JPG 或 WebP 图片'));
    const reader = new FileReader(); reader.onerror = () => reject(new Error('头像读取失败'));
    reader.onload = () => {
      const image = new Image(); image.onerror = () => reject(new Error('头像格式不支持'));
      image.onload = () => {
        const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 160;
        const size = Math.min(image.width, image.height); const x = (image.width - size) / 2; const y = (image.height - size) / 2;
        canvas.getContext('2d').drawImage(image, x, y, size, size, 0, 0, 160, 160);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function insertEmoji(emoji) {
  const input = $('#messageInput');
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.value = `${input.value.slice(0, start)}${emoji}${input.value.slice(end)}`;
  const next = start + emoji.length;
  input.focus(); input.setSelectionRange(next, next);
  input.dispatchEvent(new Event('input'));
}

$('#emojiPanel').innerHTML = emojis.map(emoji => `<button type="button" data-emoji="${emoji}" aria-label="${emoji}">${emoji}</button>`).join('');
$('#emojiToggle').addEventListener('click', event => {
  event.stopPropagation(); $('#emojiPanel').classList.toggle('hidden');
});
$('#emojiPanel').addEventListener('click', event => {
  const button = event.target.closest('[data-emoji]'); if (!button) return;
  insertEmoji(button.dataset.emoji);
});
document.addEventListener('click', event => {
  if (!event.target.closest('#emojiPanel') && !event.target.closest('#emojiToggle')) $('#emojiPanel').classList.add('hidden');
});

$('#chatList').addEventListener('click', event => { const row = event.target.closest('[data-chat-id]'); if (row) selectChat(row.dataset.chatId); });
$('#chatTabs').addEventListener('click', event => {
  const tab = event.target.closest('[data-chat-tab]'); if (tab) setChatTab(tab.dataset.chatTab);
});
$('#deviceList').addEventListener('click', async event => {
  const row = event.target.closest('[data-device-id]'); if (!row || row.disabled) return;
  try { await createChat('dm', [row.dataset.deviceId]); } catch (error) { showToast(error.message); }
});
$('#newGroup').addEventListener('click', openGroupDialog);
$('#groupForm').addEventListener('submit', async event => {
  event.preventDefault(); if (event.submitter?.value === 'cancel') return closeModal($('#groupDialog'));
  const members = [...$('#groupMembers').querySelectorAll('input:checked')].map(input => input.value);
  if (!members.length) return showToast('请至少选择一台设备');
  try { await createChat('group', members, $('#groupName').value.trim()); closeModal($('#groupDialog')); }
  catch (error) { showToast(error.message); }
});

$('#editProfile').addEventListener('click', () => {
  pendingAvatar = deviceAvatar; $('#profileName').value = deviceName;
  $('#notificationSetting').checked = notificationsEnabled;
  $('#avatarPreview').innerHTML = pendingAvatar ? `<img src="${pendingAvatar}" alt="">` : escapeHtml(initials(deviceName));
  $('#avatarInput').value = ''; openModal($('#profileDialog'));
});
$('#avatarInput').addEventListener('change', async event => {
  try { pendingAvatar = await resizeAvatar(event.target.files[0]); $('#avatarPreview').innerHTML = `<img src="${pendingAvatar}" alt="">`; }
  catch (error) { showToast(error.message); event.target.value = ''; }
});
$('#profileForm').addEventListener('submit', async event => {
  event.preventDefault(); if (event.submitter?.value === 'cancel') return closeModal($('#profileDialog'));
  const nextName = $('#profileName').value.trim().slice(0, 30); if (!nextName) return showToast('请输入设备昵称');
  const old = { name: deviceName, avatar: deviceAvatar, notifications: notificationsEnabled };
  deviceName = nextName; deviceAvatar = pendingAvatar; notificationsEnabled = $('#notificationSetting').checked;
  try {
    if (notificationsEnabled) await requestNotificationPermission();
    await saveProfile(); localStorage.lanDeviceName = deviceName; localStorage.lanDeviceAvatar = deviceAvatar;
    localStorage.lanNotifications = String(notificationsEnabled);
    updateIdentity(); closeModal($('#profileDialog')); showToast('设备资料已更新');
  } catch (error) { deviceName = old.name; deviceAvatar = old.avatar; notificationsEnabled = old.notifications; showToast(error.message); }
});

$('#messageForm').addEventListener('submit', async event => {
  event.preventDefault(); const input = $('#messageInput'); const text = input.value.trim(); if (!text) return;
  input.value = ''; input.style.height = 'auto';
  try { await sendMessage(text); } catch (error) { input.value = text; showToast(error.message); }
});
$('#messageInput').addEventListener('input', event => { event.target.style.height = 'auto'; event.target.style.height = `${event.target.scrollHeight}px`; });
$('#messageInput').addEventListener('paste', event => {
  const markdown = LinktranRichPaste.convert(event.clipboardData);
  if (!markdown) return;
  event.preventDefault();
  const input = event.currentTarget;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const available = input.maxLength - (input.value.length - (end - start));
  const inserted = markdown.slice(0, Math.max(0, available));
  input.value = `${input.value.slice(0, start)}${inserted}${input.value.slice(end)}`;
  const next = start + inserted.length;
  input.setSelectionRange(next, next);
  input.dispatchEvent(new Event('input'));
  if (inserted.length < markdown.length) showToast(`内容已按 ${input.maxLength} 字上限截断`);
});
$('#messageInput').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#messageForm').requestSubmit(); } });
$('#fileInput').addEventListener('change', event => uploadFiles([...event.target.files]));
$('#toggleSidebar').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
document.addEventListener('click', event => { if (innerWidth <= 700 && $('.sidebar').classList.contains('open') && !event.target.closest('.sidebar') && !event.target.closest('#toggleSidebar')) $('.sidebar').classList.remove('open'); });
let dragDepth = 0;
document.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; $('.chat').classList.add('dragging'); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('.chat').classList.remove('dragging'); } });
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; $('.chat').classList.remove('dragging'); uploadFiles([...event.dataTransfer.files]); });

async function init() {
  updateIdentity();
  try { await saveProfile(); connect(); } catch (error) { showToast(error.message); setTimeout(init, 1500); }
}
init();
