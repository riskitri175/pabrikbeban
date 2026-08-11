let currentSettings = null;
let editingWorkspaceId = null;
let fetchedProjects = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  renderWorkspaceTable();
  bindEvents();
});

async function loadSettings() {
  currentSettings = await Storage.getSettingsDecrypted();
  if (!currentSettings) {
    currentSettings = {
      plane_base_url: 'https://app.plane.so',
      plane_api_key: '',
      ai_provider: 'gemini',
      ai_api_key: '',
      workspaces: [],
      active_workspace_id: ''
    };
    return;
  }

  document.getElementById('plane-base-url').value = currentSettings.plane_base_url || '';
  document.getElementById('plane-api-key').value = currentSettings.plane_api_key || '';
  document.getElementById('ai-provider').value = currentSettings.ai_provider || 'gemini';
  document.getElementById('ai-api-key').value = currentSettings.ai_api_key || '';
}

function renderWorkspaceTable() {
  const tbody = document.getElementById('workspace-table-body');
  const empty = document.getElementById('workspace-empty');
  tbody.innerHTML = '';

  const workspaces = currentSettings.workspaces || [];

  if (workspaces.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  workspaces.forEach((ws) => {
    const isActive = ws.id === currentSettings.active_workspace_id;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(ws.name)}</strong></td>
      <td>${escapeHtml(ws.workspace_slug)}</td>
      <td>${ws.project_name ? escapeHtml(ws.project_name) : escapeHtml(ws.project_id || '—')}</td>
      <td><input type="radio" name="ws-default" class="ws-radio" data-id="${ws.id}" ${isActive ? 'checked' : ''}></td>
      <td>
        <button class="btn btn--secondary btn--sm ws-edit" data-id="${ws.id}">Edit</button>
        <button class="btn btn--danger btn--sm ws-delete" data-id="${ws.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.ws-radio').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) setActiveWorkspace(radio.dataset.id);
    });
  });
  tbody.querySelectorAll('.ws-edit').forEach((btn) => {
    btn.addEventListener('click', () => openEditWorkspace(btn.dataset.id));
  });
  tbody.querySelectorAll('.ws-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteWorkspace(btn.dataset.id));
  });
}

function setActiveWorkspace(id) {
  currentSettings.active_workspace_id = id;
  renderWorkspaceTable();
  saveAllSettings();
  showToast('settings-toast', `Active workspace updated`, true);
}

function openAddWorkspace() {
  editingWorkspaceId = null;
  fetchedProjects = [];
  document.getElementById('modal-title').textContent = 'Add Workspace';
  document.getElementById('ws-name').value = '';
  document.getElementById('ws-slug').value = '';
  document.getElementById('ws-project').innerHTML = '<option value="">— Select project —</option>';
  document.getElementById('ws-project').disabled = true;
  document.getElementById('fetch-projects-btn').disabled = true;
  document.getElementById('fetch-status').textContent = 'Enter workspace slug first, then click Fetch Projects.';
  document.getElementById('workspace-modal').classList.add('modal-overlay--open');
}

function openEditWorkspace(id) {
  const ws = (currentSettings.workspaces || []).find((w) => w.id === id);
  if (!ws) return;

  editingWorkspaceId = id;
  fetchedProjects = ws.project_id ? [{ id: ws.project_id, name: ws.project_name || ws.project_id }] : [];

  document.getElementById('modal-title').textContent = 'Edit Workspace';
  document.getElementById('ws-name').value = ws.name;
  document.getElementById('ws-slug').value = ws.workspace_slug;

  const select = document.getElementById('ws-project');
  select.innerHTML = '<option value="">— Select project —</option>';
  if (ws.project_id) {
    const opt = document.createElement('option');
    opt.value = ws.project_id;
    opt.textContent = ws.project_name || ws.project_id;
    opt.selected = true;
    select.appendChild(opt);
  }
  select.disabled = true;
  document.getElementById('fetch-projects-btn').disabled = false;
  document.getElementById('fetch-status').textContent = fetchedProjects.length > 0
    ? `${fetchedProjects.length} project(s) loaded.`
    : 'Click Fetch Projects to reload.';

  document.getElementById('workspace-modal').classList.add('modal-overlay--open');
}

function closeModal() {
  document.getElementById('workspace-modal').classList.remove('modal-overlay--open');
}

async function fetchProjects() {
  const slug = document.getElementById('ws-slug').value.trim();
  const statusEl = document.getElementById('fetch-status');
  const select = document.getElementById('ws-project');
  const btn = document.getElementById('fetch-projects-btn');

  if (!slug) {
    statusEl.textContent = 'Please enter a workspace slug first.';
    return;
  }

  btn.disabled = true;
  statusEl.textContent = 'Fetching projects...';
  select.innerHTML = '<option value="">Loading...</option>';

  try {
    const projects = await PlaneAPI.getWorkspaceProjects(slug);
    fetchedProjects = projects;

    select.innerHTML = '<option value="">— Select project —</option>';
    projects.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.identifier})`;
      select.appendChild(opt);
    });

    select.disabled = false;
    statusEl.textContent = `${projects.length} project(s) found. Select one.`;
  } catch (err) {
    statusEl.textContent = `Failed: ${err.message}. Check URL & API Key.`;
    select.innerHTML = '<option value="">— Select project —</option>';
    select.disabled = true;
  } finally {
    btn.disabled = false;
  }
}

function saveWorkspace() {
  const name = document.getElementById('ws-name').value.trim();
  const slug = document.getElementById('ws-slug').value.trim();
  const projectId = document.getElementById('ws-project').value;
  const projectName = projectId
    ? (fetchedProjects.find((p) => p.id === projectId)?.name || projectId)
    : '';

  if (!name) { alert('Workspace name is required.'); return; }
  if (!slug) { alert('Workspace slug is required.'); return; }
  if (!projectId) { alert('Please select a project.'); return; }

  if (editingWorkspaceId) {
    const idx = (currentSettings.workspaces || []).findIndex((w) => w.id === editingWorkspaceId);
    if (idx !== -1) {
      currentSettings.workspaces[idx] = {
        id: editingWorkspaceId,
        name,
        workspace_slug: slug,
        project_id: projectId,
        project_name: projectName
      };
    }
  } else {
    if (!currentSettings.workspaces) currentSettings.workspaces = [];
    const newId = 'ws_' + Date.now();
    currentSettings.workspaces.push({
      id: newId,
      name,
      workspace_slug: slug,
      project_id: projectId,
      project_name: projectName
    });
    if (!currentSettings.active_workspace_id) {
      currentSettings.active_workspace_id = newId;
    }
  }

  renderWorkspaceTable();
  closeModal();
  saveAllSettings();
}

async function deleteWorkspace(id) {
  if (!confirm('Delete this workspace?')) return;
  currentSettings.workspaces = (currentSettings.workspaces || []).filter((w) => w.id !== id);
  if (currentSettings.active_workspace_id === id) {
    currentSettings.active_workspace_id = (currentSettings.workspaces[0] || {}).id || '';
  }
  renderWorkspaceTable();
  saveAllSettings();
}

// === Save Settings ===

async function saveAllSettings() {
  const settings = {
    plane_base_url: document.getElementById('plane-base-url').value.trim().replace(/\/+$/, ''),
    plane_api_key: document.getElementById('plane-api-key').value.trim(),
    ai_provider: document.getElementById('ai-provider').value,
    ai_api_key: document.getElementById('ai-api-key').value.trim(),
    workspaces: currentSettings.workspaces || [],
    active_workspace_id: currentSettings.active_workspace_id || ''
  };

  if (settings.plane_base_url && !settings.plane_base_url.startsWith('https://')) {
    showToast('settings-toast', 'Plane Base URL must start with https://', false);
    return;
  }

  await Storage.saveSettings(settings);
  currentSettings = await Storage.getSettingsDecrypted();
  showToast('settings-toast', 'All settings saved successfully!', true);
}

async function testPlaneConnection() {
  const statusEl = document.getElementById('plane-connection-status');
  const url = document.getElementById('plane-base-url').value.trim().replace(/\/+$/, '');
  const key = document.getElementById('plane-api-key').value.trim();

  if (!url || !key) {
    statusEl.className = 'badge badge--error';
    statusEl.textContent = 'Fill URL & API Key first';
    return;
  }

  statusEl.textContent = 'Testing...';
  statusEl.className = 'badge badge--default';

  try {
    const response = await fetch(`${url}/api/v1/users/me/`, {
      method: 'GET',
      headers: { 'X-API-Key': key, 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      statusEl.className = 'badge badge--success';
      statusEl.textContent = 'Connected';
    } else if (response.status === 403) {
      statusEl.className = 'badge badge--error';
      statusEl.textContent = 'Invalid API Key';
    } else if (response.status === 404) {
      statusEl.className = 'badge badge--error';
      statusEl.textContent = 'Wrong URL (API not found)';
    } else {
      statusEl.className = 'badge badge--error';
      statusEl.textContent = `Failed (${response.status})`;
    }
  } catch {
    statusEl.className = 'badge badge--error';
    statusEl.textContent = 'Connection Error';
  }
}

async function testAIConnection() {
  const statusEl = document.getElementById('ai-connection-status');
  const provider = document.getElementById('ai-provider').value;
  const key = document.getElementById('ai-api-key').value.trim();

  if (!key) {
    statusEl.className = 'badge badge--error';
    statusEl.textContent = 'Fill API Key first';
    return;
  }

  statusEl.textContent = 'Testing...';
  statusEl.className = 'badge badge--default';

  const endpoints = {
    openai: { url: 'https://api.openai.com/v1/models', headers: { Authorization: `Bearer ${key}` } },
    gemini: { url: `https://generativelanguage.googleapis.com/v1/models?key=${key}`, headers: {} },
    anthropic: { url: 'https://api.anthropic.com/v1/messages', method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-3-5-haiku-latest', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }) },
    deepseek: { url: 'https://api.deepseek.com/v1/models', headers: { Authorization: `Bearer ${key}` } }
  };

  const config = endpoints[provider];
  if (!config) return;

  try {
    const fetchOptions = { method: config.method || 'GET', headers: config.headers };
    if (config.body) fetchOptions.body = config.body;
    const response = await fetch(config.url, fetchOptions);
    if (response.ok || response.status === 401) {
      statusEl.className = 'badge badge--success';
      statusEl.textContent = 'API Key Valid';
    } else {
      statusEl.className = 'badge badge--error';
      statusEl.textContent = `Failed (${response.status})`;
    }
  } catch {
    statusEl.className = 'badge badge--error';
    statusEl.textContent = 'Connection Error';
  }
}

function showToast(id, message, success) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = 'toast ' + (success ? 'toast--success' : 'toast--error');
  setTimeout(() => { el.textContent = ''; el.className = 'toast'; }, 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function bindEvents() {
  document.getElementById('save-settings').addEventListener('click', saveAllSettings);

  document.getElementById('back-to-app').addEventListener('click', () => {
    chrome.tabs.create({ url: 'app/app.html' });
  });

  document.getElementById('toggle-plane-key').addEventListener('click', () => togglePassword('plane-api-key', 'toggle-plane-key'));
  document.getElementById('toggle-ai-key').addEventListener('click', () => togglePassword('ai-api-key', 'toggle-ai-key'));

  document.getElementById('test-plane-connection').addEventListener('click', testPlaneConnection);
  document.getElementById('test-ai-connection').addEventListener('click', testAIConnection);

  document.getElementById('add-workspace-btn').addEventListener('click', openAddWorkspace);
  document.getElementById('fetch-projects-btn').addEventListener('click', fetchProjects);

  document.getElementById('ws-slug').addEventListener('input', () => {
    const slug = document.getElementById('ws-slug').value.trim();
    document.getElementById('fetch-projects-btn').disabled = !slug;
  });

  document.getElementById('modal-save').addEventListener('click', saveWorkspace);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('workspace-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

}

function togglePassword(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}
