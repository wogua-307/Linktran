const nameInput = document.querySelector('#deviceName');
const feedback = document.querySelector('#feedback');
const count = document.querySelector('#messageCount');

async function refresh() {
  const profile = await LinktranDB.get('profiles', 'self');
  nameInput.value = profile?.name || '';
  const response = await chrome.runtime.sendMessage({ type: 'stats' });
  count.textContent = response.stats?.messages || 0;
}

document.querySelector('#saveProfile').addEventListener('click', async () => {
  const name = nameInput.value.trim();
  if (!name) return void (feedback.textContent = '请输入设备昵称');
  await LinktranDB.put('profiles', { id: 'self', name, updatedAt: Date.now() });
  feedback.textContent = '设备资料已保存';
});

document.querySelector('#savePage').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ type: 'save-page' });
  feedback.textContent = response.ok ? '当前网页已保存' : response.error;
  await refresh();
});

refresh().catch(error => { feedback.textContent = error.message; });
