document.getElementById('open-app').addEventListener('click', async () => {
  await chrome.tabs.create({ url: 'app/app.html' });
  window.close();
});

document.getElementById('open-templates').addEventListener('click', async () => {
  await chrome.tabs.create({ url: 'templates/templates.html' });
  window.close();
});

document.getElementById('open-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
