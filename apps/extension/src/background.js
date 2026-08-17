importScripts('db.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'linktran-save-page', title: '保存到邻传', contexts: ['page', 'link'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'linktran-save-page' || !tab?.url) return;
  await LinktranDB.savePage({ title: tab.title, url: info.linkUrl || tab.url });
  chrome.action.setBadgeText({ text: '1' });
  chrome.action.setBadgeBackgroundColor({ color: '#28785d' });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'save-page') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      const saved = await LinktranDB.savePage(tab); sendResponse({ ok: true, saved });
    }).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'stats') {
    LinktranDB.stats().then(stats => sendResponse({ ok: true, stats })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});
