const $ = selector => document.querySelector(selector);
const t = (source, values) => globalThis.LinktranI18n.t(source, values);
const clientId = localStorage.lanClientId || (localStorage.lanClientId = createClientId());
const deviceContext = detectDeviceContext();
let deviceName = localStorage.lanDeviceName || `${deviceLabel()} ${Math.floor(Math.random() * 90 + 10)}`;
let deviceAvatar = localStorage.lanDeviceAvatar || '';
let pendingAvatar = deviceAvatar;
let notificationsEnabled = localStorage.lanNotifications !== 'false';
let themePreference = localStorage.linktranTheme || 'system';
let autoUpdateEnabled = localStorage.linktranAutoUpdate !== 'false';
let updateResult = null;
let updateChecking = false;
let relayInfo = null;
let relayClientId = null;
let mentionCandidates = [];
let mentionIndex = 0;
const selectedMentions = new Map();
let pendingAttachments = [];
let sendingMessage = false;
let source;
let activeChatId = 'lobby';
let activeChatTab = 'group';
let onlineDevices = [];
const chats = new Map();
const profiles = new Map();
const seen = new Set();
const unreadCounts = new Map();
const emojis = ['😀','😄','😁','😂','🥹','😊','😍','🥰','😘','😎','🤓','🧐','🤔','😴','😭','😤','😡','🥳','🤩','😇','👍','👎','👌','✌️','🤝','👏','🙌','🙏','💪','👀','❤️','💛','💚','💙','💜','🔥','✨','🎉','🎁','🚀','💡','✅','❌','📎','📁','☕','🍻','🌹'];

function applyTheme() {
  const dark = themePreference === 'dark' || (themePreference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1d211e' : '#f5f5f2');
}
applyTheme();

function renderUpdateStatus() {
  if (!globalThis.linktranDesktop) return;
  const button = $('#checkUpdate');
  if (updateChecking) {
    $('#updateStatus').textContent = t('正在检查更新…'); button.textContent = t('立即检查'); button.disabled = true;
  } else if (updateResult?.hasUpdate) {
    $('#updateStatus').textContent = t('发现新版本 v{version}', { version: updateResult.latestVersion }); button.textContent = t('前往下载'); button.disabled = false;
  } else if (updateResult) {
    $('#updateStatus').textContent = t('当前版本 {version} 已是最新版本', { version: updateResult.currentVersion }); button.textContent = t('立即检查'); button.disabled = false;
  } else {
    $('#updateStatus').textContent = t('尚未检查更新'); button.textContent = t('立即检查'); button.disabled = false;
  }
}

async function checkForDesktopUpdate({ silent = false } = {}) {
  if (!globalThis.linktranDesktop || updateChecking) return;
  updateChecking = true; renderUpdateStatus();
  try {
    updateResult = await globalThis.linktranDesktop.checkForUpdate();
    localStorage.linktranLastUpdateCheck = String(Date.now());
    localStorage.linktranLastUpdateResult = JSON.stringify(updateResult);
    renderUpdateStatus();
    if (updateResult.hasUpdate) showToast(t('发现新版本 v{version}', { version: updateResult.latestVersion }));
    else if (!silent) showToast(t('当前版本 {version} 已是最新版本', { version: updateResult.currentVersion }));
  } catch {
    renderUpdateStatus();
    if (!silent) showToast(t('检查更新失败'));
  } finally { updateChecking = false; renderUpdateStatus(); }
}

function renderRelayInfo() {
  if (!relayInfo) return;
  $('#relayName').textContent = t('中转节点：{name}', { name: relayInfo.name });
  $('#relayDetail').textContent = t(relayInfo.type === 'desktop' ? '桌面客户端 · 应用数据' : 'Web 服务 · 项目数据');
}

async function loadRelayInfo() {
  const response = await fetch('/api/host');
  if (!response.ok) throw new Error('Unable to identify relay');
  relayInfo = await response.json();
  relayClientId = relayInfo.relayClientId || null;
  if (globalThis.linktranDesktop) {
    const localInstanceId = await globalThis.linktranDesktop.getHostInstanceId();
    const claimResponse = await fetch('/api/host/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId: localInstanceId, clientId })
    });
    if (claimResponse.ok) {
      relayInfo = await claimResponse.json(); relayClientId = relayInfo.relayClientId;
    }
  }
  renderRelayInfo(); renderDevices();
}

function createClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function detectDeviceContext() {
  const ua = navigator.userAgent;
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  let platform = 'unknown';
  if (/iPhone|iPad|iPod/i.test(ua) || isIPadOS) platform = 'ios';
  else if (/Android/i.test(ua)) platform = 'android';
  else if (/Windows/i.test(ua)) platform = 'windows';
  else if (/Mac/i.test(ua)) platform = 'macos';
  else if (/Linux/i.test(ua)) platform = 'linux';
  const desktop = new URLSearchParams(location.search).get('desktop') === '1';
  return { platform, clientType: desktop ? 'desktop' : ['ios', 'android'].includes(platform) ? 'mobile' : 'web' };
}

function deviceLabel() {
  return ({ macos: 'Mac', windows: 'Windows', linux: 'Linux', ios: 'iPhone', android: 'Android' })[deviceContext.platform] || t('设备');
}

function initials(name) { return [...String(name || '?').trim()].slice(0, 2).join('').toUpperCase(); }
function escapeHtml(text) { const el = document.createElement('div'); el.textContent = text; return el.innerHTML; }
function formatTime(time) { return new Intl.DateTimeFormat(globalThis.LinktranI18n.getLocale(), { hour: '2-digit', minute: '2-digit' }).format(time); }
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}
function showToast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => el.classList.remove('show'), 2200); }
async function copyText(text) {
  if (navigator.clipboard?.writeText && globalThis.isSecureContext) return navigator.clipboard.writeText(text);
  const input = document.createElement('textarea');
  input.value = text; input.setAttribute('readonly', '');
  input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.append(input); input.select();
  const copied = document.execCommand('copy'); input.remove();
  if (!copied) throw new Error(t('复制失败，请手动选择消息内容'));
}
function totalUnread() { return [...unreadCounts.values()].reduce((total, count) => total + count, 0); }
function updateDocumentTitle() {
  const unread = totalUnread(); document.title = unread ? `(${unread}) ${t('邻传')}` : t('邻传');
  globalThis.linktranDesktop?.setUnreadCount(unread).catch(() => {});
}
async function requestNotificationPermission() {
  if (globalThis.linktranDesktop) return;
  if (!('Notification' in globalThis) || Notification.permission !== 'default') return;
  try { await Notification.requestPermission(); } catch { /* Page alerts remain available on restricted HTTP origins. */ }
}
function notifyNewMessage(item) {
  if (!notificationsEnabled) return;
  const sender = profileFor(item.senderId);
  const mentioned = item.mentions?.some(mention => mention.id === clientId);
  const content = item.type === 'file' ? t('发送了文件：{name}', { name: item.file.name }) : item.text;
  showToast(`${sender.name}：${content.slice(0, 50)}`);
  if (globalThis.linktranDesktop) {
    globalThis.linktranDesktop.notify({
      title: `${mentioned ? t('有人@你') + ' · ' : ''}${t('邻传')} · ${sender.name}`,
      body: content.slice(0, 120),
      chatId: item.chatId
    }).catch(() => {});
    return;
  }
  if ('Notification' in globalThis && Notification.permission === 'granted') {
    const notification = new Notification(`${mentioned ? t('有人@你') + ' · ' : ''}${t('邻传')} · ${sender.name}`, { body: content.slice(0, 120), icon: '/logo.svg', tag: item.chatId });
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
async function loadConnectAddresses() {
  const response = await fetch('/api/network');
  if (!response.ok) throw new Error(t('无法获取局域网地址'));
  const { urls } = await response.json();
  if (!urls.length) throw new Error(t('未发现可用的局域网地址'));
  const select = $('#connectAddress');
  select.innerHTML = urls.map(url => `<option value="${escapeHtml(url)}">${escapeHtml(url)}</option>`).join('');
  updateConnectQr();
}
function updateConnectQr() {
  const url = $('#connectAddress').value;
  $('#connectLink').textContent = url;
  $('#connectQr').src = `/api/qrcode?url=${encodeURIComponent(url)}`;
}
function profileFor(id) { return profiles.get(id) || { id, name: t('匿名设备'), avatar: '', platform: 'unknown', clientType: 'web' }; }
function deviceIcon(profile) {
  if (profile.clientType === 'desktop') return 'monitor';
  if (profile.clientType === 'mobile') return 'smartphone';
  if (profile.clientType === 'extension') return 'puzzle';
  return 'globe';
}
function deviceKindLabel(profile) {
  const platform = ({ macos: 'macOS', windows: 'Windows', linux: 'Linux', ios: 'iOS', android: 'Android', unknown: t('未知系统') })[profile.platform] || t('未知系统');
  const clientType = ({ desktop: t('客户端'), mobile: t('移动端'), web: 'Web', extension: t('浏览器插件') })[profile.clientType] || 'Web';
  return `${platform} · ${clientType}`;
}
function avatarHtml(profile, extraClass = '') {
  const content = profile.avatar ? `<img src="${profile.avatar}" alt="">` : escapeHtml(initials(profile.name));
  return `<span class="avatar ${extraClass}">${content}</span>`;
}

function groupAvatarHtml(chat) {
  const members = chat.members.slice(0, 4).map(profileFor);
  return `<span class="group-avatar group-${members.length}">${members.map(profile => avatarHtml(profile, 'group-avatar-cell')).join('')}</span>`;
}

function chatLabel(chat) {
  if (chat.type === 'lobby') return t('共享空间');
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
    body: JSON.stringify({ id: clientId, name: deviceName, avatar: deviceAvatar, ...deviceContext })
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
    if (data.host) { relayInfo = data.host; relayClientId = data.host.relayClientId || null; renderRelayInfo(); }
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
    renderDevices(); renderChats(); updateChatHeader(); updateRenderedProfile(profile);
  });
  source.addEventListener('host', event => {
    relayInfo = JSON.parse(event.data); relayClientId = relayInfo.relayClientId || null;
    renderRelayInfo(); renderDevices();
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
    const viewingActiveChat = item.chatId === activeChatId && document.visibilityState === 'visible' && document.hasFocus();
    if (item.chatId === activeChatId) renderEvent(item);
    if (item.senderId !== clientId && !viewingActiveChat) {
      unreadCounts.set(item.chatId, (unreadCounts.get(item.chatId) || 0) + 1);
      updateDocumentTitle(); notifyNewMessage(item);
    }
    renderChats();
  });
  source.onerror = () => showToast(t('连接中断，正在重连…'));
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
    const preview = last ? (last.type === 'file' ? t('[文件] {name}', { name: last.file.name }) : last.text) : (chat.type === 'lobby' ? t('所有设备都能看到') : t('暂无消息'));
    const unread = unreadCounts.get(chat.id) || 0;
    return `<button class="chat-row${chat.id === activeChatId ? ' active' : ''}" data-chat-id="${escapeHtml(chat.id)}">${chatAvatar(chat)}<span class="chat-content"><strong>${escapeHtml(chatLabel(chat))}</strong><small>${escapeHtml(preview)}</small></span>${unread ? `<b class="unread-badge">${unread > 99 ? '99+' : unread}</b>` : ''}</button>`;
  }).join('');

  const totals = { group: 0, dm: 0 };
  for (const [chatId, count] of unreadCounts) {
    const chat = chats.get(chatId);
    if (!chat) continue;
    totals[chat.type === 'dm' ? 'dm' : 'group'] += count;
  }
  for (const [type, total] of Object.entries(totals)) {
    const badge = $(`#${type}Unread`);
    badge.textContent = total > 99 ? '99+' : total;
    badge.classList.toggle('hidden', total === 0);
  }
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
      ${avatarHtml(profile)}<span><strong>${escapeHtml(profile.name)}${profile.id === clientId ? t('（本机）') : ''}${profile.id === relayClientId ? `<b class="relay-badge">${t('中转节点')}</b>` : ''}</strong><small class="device-kind"><i data-lucide="${deviceIcon(profile)}" aria-hidden="true"></i><span>${escapeHtml(deviceKindLabel(profile))} · ${profile.id === relayClientId ? t('本机中转') : profile.id === clientId ? t('当前设备') : t('点击发起单聊')}</span></small></span>
    </button>`).join('');
  globalThis.lucide?.createIcons({ attrs: { 'stroke-width': 1.8 } });
}

function updateChatHeader() {
  const chat = chats.get(activeChatId); if (!chat) return;
  $('#chatTitle').textContent = chatLabel(chat);
  if (chat.type === 'lobby') $('#chatSubtitle').textContent = t('{count} 台设备在线', { count: onlineDevices.length });
  else if (chat.type === 'dm') $('#chatSubtitle').textContent = t(onlineDevices.some(device => chat.members.includes(device.id) && device.id !== clientId) ? '在线' : '离线');
  else $('#chatSubtitle').textContent = t('{count} 位成员', { count: chat.members.length });
}

function selectChat(chatId) {
  if (!chats.has(chatId)) return;
  if (sendingMessage && chatId !== activeChatId) return showToast(t('消息发送中，请稍候'));
  if (chatId !== activeChatId) {
    selectedMentions.clear(); closeMentionMenu(); clearPendingAttachments();
  }
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
    $('#messages').innerHTML = `<div class="empty"><span>⇄</span><h2>${escapeHtml(chatLabel(chat))}</h2><p>${t('这里还没有消息')}</p></div>`;
    return;
  }
  chat.history.forEach(renderEvent);
}

function updateRenderedProfile(profile) {
  document.querySelectorAll(`.event[data-sender-id="${CSS.escape(profile.id)}"]`).forEach(article => {
    const avatar = article.querySelector('.event-avatar');
    if (avatar) avatar.outerHTML = avatarHtml(profile, 'event-avatar');
    const senderName = article.querySelector('.event-meta strong');
    if (senderName && profile.id !== clientId) senderName.textContent = profile.name;
  });
}

function renderEvent(item) {
  if (seen.has(item.id)) return;
  seen.add(item.id); $('#messages .empty')?.remove();
  const mine = item.senderId === clientId;
  const sender = profileFor(item.senderId);
  const extension = item.type === 'file' ? (item.file.name.split('.').pop() || 'FILE').slice(0, 4) : '';
  const content = item.type === 'file'
    ? `<a class="file-card" href="${item.file.url}"><span class="file-icon">${escapeHtml(extension)}</span><span class="file-details"><strong>${escapeHtml(item.file.name)}</strong><small>${formatSize(item.file.size)}</small></span><span class="download">↓</span></a>`
    : `<div class="message-shell"><div class="bubble markdown-body">${renderMessageText(item)}</div><button class="copy-message" type="button" title="${t('复制消息')}" aria-label="${t('复制消息')}">⧉</button></div>`;
  const article = document.createElement('article');
  article.className = `event${mine ? ' mine' : ''}`;
  article.dataset.senderId = item.senderId;
  article.innerHTML = `${avatarHtml(sender, 'event-avatar')}<div class="event-body"><div class="event-meta"><strong>${escapeHtml(mine ? t('我') : sender.name)}</strong><time>${formatTime(item.time)}</time></div>${content}</div>`;
  article.querySelector('.copy-message')?.addEventListener('click', async () => {
    try { await copyText(item.text); showToast(t('消息已复制')); }
    catch (error) { showToast(error.message); }
  });
  $('#messages').append(article); $('#messages').scrollTop = $('#messages').scrollHeight;
}

function renderMessageText(item) {
  const wrapper = document.createElement('div'); wrapper.innerHTML = LinktranMarkdown.render(item.text);
  const mentions = item.mentions || [];
  if (!mentions.length) return wrapper.innerHTML;
  const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
  const nodes = []; for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  for (const node of nodes) {
    const matches = [...new Set(mentions.map(mention => `@${mention.name}`).filter(value => node.nodeValue.includes(value)))].sort((a, b) => b.length - a.length);
    if (!matches.length) continue;
    const pattern = new RegExp(`(${matches.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[\\s.,!?，。！？、:：;；)）\\]】}])`, 'gu');
    const fragment = document.createDocumentFragment();
    node.nodeValue.split(pattern).filter(Boolean).forEach(part => {
      const mention = mentions.find(item => `@${item.name}` === part);
      if (!mention) fragment.append(part);
      else { const mark = document.createElement('mark'); mark.className = `mention${mention.id === clientId ? ' mention-me' : ''}`; mark.textContent = part; fragment.append(mark); }
    });
    node.replaceWith(fragment);
  }
  return wrapper.innerHTML;
}

async function createChat(type, members, name = '') {
  const response = await fetch('/api/chats', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, creatorId: clientId, members, name })
  });
  if (!response.ok) throw new Error((await response.json()).error);
  const chat = await response.json(); chats.set(chat.id, chat); selectChat(chat.id); return chat;
}

async function sendMessage(chatId, text, mentions = []) {
  const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: clientId, chatId, text, mentions }) });
  if (!response.ok) throw new Error((await response.json()).error);
}

function uploadFile(file, chatId) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/files');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('X-Client-Id', clientId); xhr.setRequestHeader('X-Chat-Id', chatId);
    xhr.upload.onprogress = event => {
      const percent = event.lengthComputable ? Math.round(event.loaded / event.total * 100) : 0;
      $('#uploadText').textContent = t('正在发送 {name} · {percent}%', { name: file.name, percent }); $('#uploadBar').style.width = `${percent}%`;
    };
    xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(JSON.parse(xhr.responseText).error));
    xhr.onerror = () => reject(new Error(t('网络连接失败'))); xhr.send(file);
  });
}

async function uploadFiles(files) {
  if (!files.length) return; const chatId = activeChatId; const progress = $('#uploadProgress'); progress.classList.remove('hidden');
  try { for (const file of files) await uploadFile(file, chatId); showToast(t('{count} 个文件发送完成', { count: files.length })); }
  catch (error) { showToast(error.message); }
  finally { progress.classList.add('hidden'); $('#uploadBar').style.width = '0'; $('#fileInput').value = ''; }
}

function mentionableDevices() {
  const chat = chats.get(activeChatId);
  if (!chat || chat.type === 'dm') return [];
  const memberIds = chat.members ? new Set(chat.members) : null;
  return onlineDevices.filter(profile => profile.id !== clientId && (!memberIds || memberIds.has(profile.id)));
}

function closeMentionMenu() { mentionCandidates = []; $('#mentionMenu').classList.add('hidden'); }

function updateMentionMenu() {
  const input = $('#messageInput'); const beforeCaret = input.value.slice(0, input.selectionStart);
  const match = beforeCaret.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) return closeMentionMenu();
  const query = match[1].toLocaleLowerCase();
  mentionCandidates = mentionableDevices().filter(profile => profile.name.toLocaleLowerCase().includes(query));
  if (!mentionCandidates.length) return closeMentionMenu();
  mentionIndex = Math.min(mentionIndex, mentionCandidates.length - 1);
  $('#mentionMenu').innerHTML = mentionCandidates.map((profile, index) => `<button type="button" role="option" data-mention-index="${index}" class="${index === mentionIndex ? 'active' : ''}">${avatarHtml(profile)}<span><strong>${escapeHtml(profile.name)}</strong><small>${escapeHtml(deviceKindLabel(profile))}</small></span></button>`).join('');
  $('#mentionMenu').classList.remove('hidden');
}

function selectMention(index) {
  const profile = mentionCandidates[index]; if (!profile) return;
  const input = $('#messageInput'); const caret = input.selectionStart;
  const before = input.value.slice(0, caret); const match = before.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) return closeMentionMenu();
  const atIndex = before.lastIndexOf('@'); const inserted = `@${profile.name} `;
  input.value = `${input.value.slice(0, atIndex)}${inserted}${input.value.slice(caret)}`;
  const nextCaret = atIndex + inserted.length; input.setSelectionRange(nextCaret, nextCaret);
  selectedMentions.set(profile.id, { id: profile.id, name: profile.name });
  closeMentionMenu(); input.dispatchEvent(new Event('input')); input.focus();
}

function queueAttachments(files) {
  const additions = [...files].filter(file => file?.size > 0).slice(0, Math.max(0, 10 - pendingAttachments.length)).map(file => ({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' }));
  pendingAttachments.push(...additions); renderPendingAttachments();
}

function clipboardFiles(clipboardData) {
  const files = [...(clipboardData?.files || [])];
  for (const item of clipboardData?.items || []) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file && !files.some(existing => existing.name === file.name && existing.size === file.size && existing.type === file.type)) files.push(file);
  }
  return files;
}

function clearPendingAttachments() {
  pendingAttachments.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); });
  pendingAttachments = []; renderPendingAttachments();
}

function renderPendingAttachments() {
  const tray = $('#pendingAttachments'); tray.classList.toggle('hidden', !pendingAttachments.length);
  tray.innerHTML = pendingAttachments.map((item, index) => `<div class="pending-attachment">${item.preview ? `<img src="${item.preview}" alt="">` : `<span class="pending-file-icon">${escapeHtml((item.file.name.split('.').pop() || 'FILE').slice(0, 4))}</span>`}<p><strong>${escapeHtml(item.file.name)}</strong><small>${formatSize(item.file.size)}</small></p><button type="button" data-remove-attachment="${index}" title="${t('移除附件')}" aria-label="${t('移除附件')}">×</button></div>`).join('');
}

async function sendPendingAttachments(chatId, attachments) {
  if (!attachments.length) return;
  const progress = $('#uploadProgress'); progress.classList.remove('hidden');
  try {
    while (attachments.length) {
      const item = attachments[0];
      await uploadFile(item.file, chatId);
      attachments.shift();
      if (item.preview) URL.revokeObjectURL(item.preview);
    }
  } finally { progress.classList.add('hidden'); $('#uploadBar').style.width = '0'; }
}

function openGroupDialog() {
  const peers = onlineDevices.filter(device => device.id !== clientId);
  if (!peers.length) return showToast(t('暂无其他在线设备'));
  $('#groupName').value = '';
  $('#groupMembers').innerHTML = peers.map(profile => `<label class="member-option"><input type="checkbox" value="${escapeHtml(profile.id)}">${avatarHtml(profile)}<span><strong>${escapeHtml(profile.name)}</strong><small>${t('在线')}</small></span><i>✓</i></label>`).join('');
  openModal($('#groupDialog'));
}

function resizeAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) return reject(new Error(t('请选择 PNG、JPG 或 WebP 图片')));
    const reader = new FileReader(); reader.onerror = () => reject(new Error(t('头像读取失败')));
    reader.onload = () => {
      const image = new Image(); image.onerror = () => reject(new Error(t('头像格式不支持')));
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
  if (!members.length) return showToast(t('请至少选择一台设备'));
  try { await createChat('group', members, $('#groupName').value.trim()); closeModal($('#groupDialog')); }
  catch (error) { showToast(error.message); }
});

$('#editProfile').addEventListener('click', () => {
  pendingAvatar = deviceAvatar; $('#profileName').value = deviceName;
  $('#avatarPreview').innerHTML = pendingAvatar ? `<img src="${pendingAvatar}" alt="">` : escapeHtml(initials(deviceName));
  $('#avatarInput').value = ''; openModal($('#profileDialog'));
});
$('#openSettings').addEventListener('click', () => {
  $('#languageSetting').value = globalThis.LinktranI18n.getLocale();
  $('#themeSetting').value = themePreference;
  $('#notificationSetting').checked = notificationsEnabled;
  if (globalThis.linktranDesktop) {
    $('#desktopUpdateSettings').classList.remove('hidden');
    $('#autoUpdateSetting').checked = autoUpdateEnabled; renderUpdateStatus();
  }
  openModal($('#settingsDialog'));
});
$('#openConnect').addEventListener('click', async () => {
  openModal($('#connectDialog'));
  try { await loadConnectAddresses(); }
  catch (error) { closeModal($('#connectDialog')); showToast(error.message); }
});
$('#connectAddress').addEventListener('change', updateConnectQr);
$('#copyConnectLink').addEventListener('click', async () => {
  try { await copyText($('#connectAddress').value); showToast(t('连接地址已复制')); }
  catch (error) { showToast(error.message); }
});
$('#avatarInput').addEventListener('change', async event => {
  try { pendingAvatar = await resizeAvatar(event.target.files[0]); $('#avatarPreview').innerHTML = `<img src="${pendingAvatar}" alt="">`; }
  catch (error) { showToast(error.message); event.target.value = ''; }
});
$('#profileForm').addEventListener('submit', async event => {
  event.preventDefault(); if (event.submitter?.value === 'cancel') return closeModal($('#profileDialog'));
  const nextName = $('#profileName').value.trim().slice(0, 30); if (!nextName) return showToast(t('请输入设备昵称'));
  const old = { name: deviceName, avatar: deviceAvatar };
  deviceName = nextName; deviceAvatar = pendingAvatar;
  try {
    await saveProfile(); localStorage.lanDeviceName = deviceName; localStorage.lanDeviceAvatar = deviceAvatar;
    updateIdentity(); closeModal($('#profileDialog')); showToast(t('设备资料已更新'));
  } catch (error) { deviceName = old.name; deviceAvatar = old.avatar; showToast(error.message); }
});
$('#settingsForm').addEventListener('submit', async event => {
  event.preventDefault(); if (event.submitter?.value === 'cancel') return closeModal($('#settingsDialog'));
  const wasNotificationsEnabled = notificationsEnabled;
  notificationsEnabled = $('#notificationSetting').checked;
  themePreference = $('#themeSetting').value;
  if (globalThis.linktranDesktop) autoUpdateEnabled = $('#autoUpdateSetting').checked;
  if (notificationsEnabled && !wasNotificationsEnabled) await requestNotificationPermission();
  localStorage.lanNotifications = String(notificationsEnabled);
  localStorage.linktranTheme = themePreference; applyTheme();
  localStorage.linktranAutoUpdate = String(autoUpdateEnabled);
  globalThis.LinktranI18n.setLocale($('#languageSetting').value);
  closeModal($('#settingsDialog')); showToast(t('设置已保存'));
});
$('#checkUpdate').addEventListener('click', async () => {
  if (updateResult?.hasUpdate) return globalThis.linktranDesktop.openRelease(updateResult.releaseUrl);
  await checkForDesktopUpdate();
});

$('#messageForm').addEventListener('submit', async event => {
  event.preventDefault(); const input = $('#messageInput'); const text = input.value.trim(); if (sendingMessage || (!text && !pendingAttachments.length)) return;
  const chatId = activeChatId;
  const mentions = [...selectedMentions.values()].filter(mention => text.includes(`@${mention.name}`));
  const attachments = pendingAttachments;
  pendingAttachments = [];
  input.value = ''; input.style.height = 'auto'; selectedMentions.clear(); closeMentionMenu(); renderPendingAttachments();
  sendingMessage = true; $('.send').disabled = true;
  try {
    await sendPendingAttachments(chatId, attachments);
    if (text) await sendMessage(chatId, text, mentions);
  } catch (error) {
    if (activeChatId === chatId) {
      input.value = input.value ? `${text}\n${input.value}` : text;
      input.dispatchEvent(new Event('input'));
      mentions.forEach(mention => selectedMentions.set(mention.id, mention));
      pendingAttachments.unshift(...attachments); renderPendingAttachments();
    } else {
      attachments.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); });
    }
    showToast(error.message);
  } finally {
    sendingMessage = false; $('.send').disabled = false;
  }
});
$('#messageInput').addEventListener('input', event => { event.target.style.height = 'auto'; event.target.style.height = `${event.target.scrollHeight}px`; updateMentionMenu(); });
$('#messageInput').addEventListener('paste', event => {
  const files = clipboardFiles(event.clipboardData);
  if (files.length) { event.preventDefault(); queueAttachments(files); return; }
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
  if (inserted.length < markdown.length) showToast(t('内容已按 {count} 字上限截断', { count: input.maxLength }));
});
$('#messageInput').addEventListener('keydown', event => {
  if (mentionCandidates.length && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
    event.preventDefault();
    if (event.key === 'ArrowDown') mentionIndex = (mentionIndex + 1) % mentionCandidates.length;
    else if (event.key === 'ArrowUp') mentionIndex = (mentionIndex - 1 + mentionCandidates.length) % mentionCandidates.length;
    else if (event.key === 'Enter') return selectMention(mentionIndex);
    else return closeMentionMenu();
    return updateMentionMenu();
  }
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#messageForm').requestSubmit(); }
});
$('#fileInput').addEventListener('change', event => uploadFiles([...event.target.files]));
$('#mentionMenu').addEventListener('mousedown', event => { const button = event.target.closest('[data-mention-index]'); if (button) { event.preventDefault(); selectMention(Number(button.dataset.mentionIndex)); } });
$('#pendingAttachments').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-attachment]'); if (!button) return;
  const [item] = pendingAttachments.splice(Number(button.dataset.removeAttachment), 1);
  if (item?.preview) URL.revokeObjectURL(item.preview); renderPendingAttachments();
});
$('#toggleSidebar').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
document.addEventListener('click', event => { if (innerWidth <= 700 && $('.sidebar').classList.contains('open') && !event.target.closest('.sidebar') && !event.target.closest('#toggleSidebar')) $('.sidebar').classList.remove('open'); });
let dragDepth = 0;
document.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; $('.chat').classList.add('dragging'); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('.chat').classList.remove('dragging'); } });
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; $('.chat').classList.remove('dragging'); uploadFiles([...event.dataTransfer.files]); });
function markActiveChatRead() {
  if (document.visibilityState !== 'visible' || !document.hasFocus() || !unreadCounts.has(activeChatId)) return;
  unreadCounts.delete(activeChatId); updateDocumentTitle(); renderChats();
}
document.addEventListener('visibilitychange', markActiveChatRead);
globalThis.addEventListener('focus', markActiveChatRead);
globalThis.addEventListener('linktran:localechange', () => {
  renderChats(); renderDevices(); updateChatHeader(); renderMessages(); updateDocumentTitle(); renderUpdateStatus(); renderRelayInfo();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (themePreference === 'system') applyTheme(); });
globalThis.linktranDesktop?.onNotificationClick(chatId => selectChat(chatId));

async function init() {
  globalThis.LinktranI18n.apply();
  globalThis.lucide?.createIcons({ attrs: { 'stroke-width': 1.8 } });
  updateIdentity();
  loadRelayInfo().catch(() => {});
  if (globalThis.linktranDesktop) {
    try {
      const currentVersion = await globalThis.linktranDesktop.getVersion();
      const cachedResult = JSON.parse(localStorage.linktranLastUpdateResult || 'null');
      const validCache = cachedResult?.currentVersion === currentVersion
        && typeof cachedResult.latestVersion === 'string'
        && typeof cachedResult.hasUpdate === 'boolean'
        && typeof cachedResult.releaseUrl === 'string';
      if (validCache) updateResult = cachedResult;
      else {
        localStorage.removeItem('linktranLastUpdateResult');
        localStorage.removeItem('linktranLastUpdateCheck');
      }
    } catch {
      localStorage.removeItem('linktranLastUpdateResult');
      localStorage.removeItem('linktranLastUpdateCheck');
    }
  }
  if (globalThis.linktranDesktop && autoUpdateEnabled) {
    const lastCheck = Number(localStorage.linktranLastUpdateCheck || 0);
    if (Date.now() - lastCheck >= 24 * 60 * 60 * 1000) setTimeout(() => checkForDesktopUpdate({ silent: true }), 5000);
  }
  try { await saveProfile(); connect(); } catch (error) { showToast(error.message); setTimeout(init, 1500); }
}
init();
