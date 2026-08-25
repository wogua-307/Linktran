(function () {
  const translations = {
    '邻传': 'Linktran', '局域网传输': 'LAN Transfer', '已连接': 'Connected', '会话': 'Chats',
    '新建群聊': 'New group chat', '会话类型': 'Chat type', '群聊': 'Groups', '单聊': 'Direct',
    '在线设备 · 点击单聊': 'Online devices · Click to chat', '仅限当前局域网': 'Local network only',
    '会话内容相互独立': 'Each chat has separate history', '打开会话列表': 'Open chat list',
    '共享空间': 'Shared space', '所有在线设备': 'All online devices', '手机扫码连接': 'Connect by QR code',
    '手机连接': 'Mobile connection', '松开发送到当前会话': 'Drop to send to this chat', '选择文件': 'Choose files',
    '选择表情': 'Choose emoji', '输入消息…': 'Type a message…', '发送': 'Send', '表情选择器': 'Emoji picker',
    '选择要加入群聊的在线设备': 'Select online devices to add', '群聊名称': 'Group name',
    '例如：项目讨论': 'Example: Project discussion', '取消': 'Cancel', '创建群聊': 'Create group',
    '设备资料': 'Device profile', '其他设备将看到此昵称和头像': 'Other devices will see this name and avatar',
    '关闭': 'Close', '选择头像': 'Choose avatar', 'PNG、JPG 或 WebP': 'PNG, JPG, or WebP',
    '设备昵称': 'Device name', '界面语言': 'Language', '全局设置': 'Settings',
    '管理当前设备的软件偏好': 'Manage application preferences on this device', '保存设置': 'Save settings',
    '设置已保存': 'Settings saved', '外观主题': 'Theme', '跟随系统': 'System', '浅色': 'Light', '深色': 'Dark',
    '自动检查更新': 'Automatically check for updates', '每天最多检查一次 GitHub Release': 'Check GitHub Releases at most once a day',
    '立即检查': 'Check now', '正在检查更新…': 'Checking for updates…', '尚未检查更新': 'Not checked yet',
    '当前版本 {version} 已是最新版本': 'Version {version} is up to date', '发现新版本 v{version}': 'Version v{version} is available',
    '前往下载': 'Download', '检查更新失败': 'Unable to check for updates',
    '正在识别中转节点…': 'Identifying relay…', '中转节点：{name}': 'Relay: {name}', '本机中转': 'This device is the relay',
    '中转节点': 'Relay', '桌面客户端 · 应用数据': 'Desktop client · App data', 'Web 服务 · 项目数据': 'Web service · Project data',
    '有人@你': 'Mentioned you', '移除附件': 'Remove attachment', '消息发送中，请稍候': 'Message is being sent. Please wait.',
    '新消息提醒': 'New message notifications',
    '在其他会话收到消息时显示提醒': 'Show alerts for messages received in other chats', '保存资料': 'Save profile',
    '手机与电脑需连接同一个 Wi-Fi': 'Your phone and computer must use the same Wi-Fi',
    '手机连接二维码': 'Mobile connection QR code', '局域网地址': 'LAN address', '选择局域网地址': 'Select LAN address',
    '复制连接地址': 'Copy connection address', '完成': 'Done', '设备': 'Device',
    '复制失败，请手动选择消息内容': 'Copy failed. Please select the message manually.',
    '发送了文件：{name}': 'Sent a file: {name}', '无法获取局域网地址': 'Unable to load LAN addresses',
    '未发现可用的局域网地址': 'No available LAN address found', '匿名设备': 'Anonymous device',
    '未知系统': 'Unknown OS', '客户端': 'Desktop', '移动端': 'Mobile', '浏览器插件': 'Browser extension',
    '连接中断，正在重连…': 'Connection lost. Reconnecting…', '[文件] {name}': '[File] {name}',
    '所有设备都能看到': 'Visible to all devices', '暂无消息': 'No messages yet', '（本机）': ' (this device)',
    '当前设备': 'Current device', '点击发起单聊': 'Click to start a chat', '{count} 台设备在线': '{count} devices online',
    '在线': 'Online', '离线': 'Offline', '{count} 位成员': '{count} members', '这里还没有消息': 'No messages here yet',
    '复制消息': 'Copy message', '我': 'Me', '消息已复制': 'Message copied', '正在发送 {name} · {percent}%': 'Sending {name} · {percent}%',
    '网络连接失败': 'Network connection failed', '{count} 个文件发送完成': '{count} files sent',
    '暂无其他在线设备': 'No other devices online', '请选择 PNG、JPG 或 WebP 图片': 'Choose a PNG, JPG, or WebP image',
    '头像读取失败': 'Failed to read avatar', '头像格式不支持': 'Unsupported avatar format',
    '请至少选择一台设备': 'Select at least one device', '连接地址已复制': 'Connection address copied',
    '请输入设备昵称': 'Enter a device name', '设备资料已更新': 'Device profile updated',
    '内容已按 {count} 字上限截断': 'Content was truncated to the {count}-character limit'
  };

  const supported = ['zh-CN', 'en'];
  const normalize = value => String(value || '').toLowerCase().startsWith('en') ? 'en' : 'zh-CN';
  let locale = normalize(localStorage.linktranLocale || navigator.language);
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();

  function t(source, values = {}) {
    let result = locale === 'en' ? (translations[source] || source) : source;
    for (const [key, value] of Object.entries(values)) result = result.replaceAll(`{${key}}`, value);
    return result;
  }

  function apply(root = document) {
    const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.parentElement || ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) continue;
      if (!originalText.has(node)) originalText.set(node, node.nodeValue);
      const source = originalText.get(node); const trimmed = source.trim();
      if (translations[trimmed]) node.nodeValue = source.replace(trimmed, t(trimmed));
    }
    root.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach(el => {
      if (!originalAttributes.has(el)) originalAttributes.set(el, Object.fromEntries(['title', 'aria-label', 'placeholder', 'alt'].map(name => [name, el.getAttribute(name)])));
      for (const [name, value] of Object.entries(originalAttributes.get(el))) if (value && translations[value]) el.setAttribute(name, t(value));
    });
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    root.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.documentElement.lang = locale;
  }

  function setLocale(next) {
    locale = normalize(next); localStorage.linktranLocale = locale; apply();
    globalThis.dispatchEvent(new CustomEvent('linktran:localechange', { detail: locale }));
  }

  globalThis.LinktranI18n = { t, apply, setLocale, getLocale: () => locale, supported };
})();
