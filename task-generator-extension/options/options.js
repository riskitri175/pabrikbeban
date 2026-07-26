let currentSettings = null;
let editingWorkspaceId = null;
let editingTemplateId = null;
let fetchedProjects = [];
let currentTemplates = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadTemplates();
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

// === Template Manager ===

async function loadTemplates() {
  currentTemplates = await Storage.getTemplates() || [];
  renderTemplateTable();
}

function renderTemplateTable() {
  const tbody = document.getElementById('template-table-body');
  const empty = document.getElementById('template-empty');

  tbody.innerHTML = '';

  if (currentTemplates.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  currentTemplates.forEach((tpl) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(tpl.name)}</strong></td>
      <td>${escapeHtml(tpl.category)}</td>
      <td>${tpl.fields.length} fields</td>
      <td>
        <button class="btn btn--secondary btn--sm template-edit" data-id="${tpl.id}">Edit</button>
        <button class="btn btn--danger btn--sm template-delete" data-id="${tpl.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.template-edit').forEach((btn) => {
    btn.addEventListener('click', () => openEditTemplate(btn.dataset.id));
  });
  tbody.querySelectorAll('.template-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteTemplate(btn.dataset.id));
  });
}

function openAddTemplate() {
  editingTemplateId = null;
  document.getElementById('template-modal-title').textContent = 'Add Template';
  document.getElementById('template-name').value = '';
  document.getElementById('template-category').value = 'General';
  document.getElementById('field-list').innerHTML = '';
  addFieldRow();
  document.getElementById('template-modal').classList.add('modal-overlay--open');
}

function openEditTemplate(id) {
  const tpl = currentTemplates.find((t) => t.id === id);
  if (!tpl) return;

  editingTemplateId = id;
  document.getElementById('template-modal-title').textContent = 'Edit Template';
  document.getElementById('template-name').value = tpl.name;
  document.getElementById('template-category').value = tpl.category;
  document.getElementById('field-list').innerHTML = '';

  tpl.fields.forEach((field) => addFieldRow(field));
  if (tpl.fields.length === 0) addFieldRow();

  document.getElementById('template-modal').classList.add('modal-overlay--open');
}

function closeTemplateModal() {
  document.getElementById('template-modal').classList.remove('modal-overlay--open');
}

function addFieldRow(field) {
  const container = document.getElementById('field-list');
  const row = document.createElement('div');
  row.className = 'field-row';

  const key = field?.key || '';
  const label = field?.label || '';
  const type = field?.type || 'text';
  const constraint = field?.constraint || 'mandatory';

  row.innerHTML = `
    <div>
      <span class="field-row__label">Label</span>
      <input class="form-group__input field-label" type="text" value="${escapeHtml(label)}" maxlength="50" placeholder="e.g. Figma Link">
    </div>
    <div>
      <span class="field-row__label">Key</span>
      <input class="form-group__input field-key" type="text" value="${escapeHtml(key)}" placeholder="figma_link" pattern="^[a-z0-9_]+$">
    </div>
    <div>
      <span class="field-row__label">Type</span>
      <select class="form-group__input field-type">
        <option value="text" ${type === 'text' ? 'selected' : ''}>Text</option>
        <option value="rich_text" ${type === 'rich_text' ? 'selected' : ''}>Rich Text</option>
        <option value="dropdown" ${type === 'dropdown' ? 'selected' : ''}>Dropdown</option>
        <option value="checkbox_list" ${type === 'checkbox_list' ? 'selected' : ''}>Checkbox List</option>
        <option value="url" ${type === 'url' ? 'selected' : ''}>URL</option>
      </select>
    </div>
    <div>
      <span class="field-row__label">Constraint</span>
      <select class="form-group__input field-constraint">
        <option value="mandatory" ${constraint === 'mandatory' ? 'selected' : ''}>Mandatory</option>
        <option value="optional" ${constraint === 'optional' ? 'selected' : ''}>Optional</option>
        <option value="ai_generated" ${constraint === 'ai_generated' ? 'selected' : ''}>AI-Generated</option>
        <option value="fixed_input" ${constraint === 'fixed_input' ? 'selected' : ''}>Fixed Input</option>
      </select>
    </div>
    <button class="field-row__remove" title="Remove field">&times;</button>
  `;

  const labelInput = row.querySelector('.field-label');
  const keyInput = row.querySelector('.field-key');

  labelInput.addEventListener('input', () => {
    if (!editingTemplateId || !keyInput.value) {
      keyInput.value = slugify(labelInput.value);
    }
  });

  row.querySelector('.field-row__remove').addEventListener('click', () => {
    row.remove();
  });

  container.appendChild(row);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function getFieldData() {
  const rows = document.querySelectorAll('.field-row');
  return Array.from(rows).map((row) => ({
    label: row.querySelector('.field-label').value.trim(),
    key: row.querySelector('.field-key').value.trim(),
    type: row.querySelector('.field-type').value,
    constraint: row.querySelector('.field-constraint').value
  })).filter((f) => f.label && f.key);
}

function saveTemplate() {
  const name = document.getElementById('template-name').value.trim();
  const category = document.getElementById('template-category').value;
  const fields = getFieldData();

  if (!name) {
    alert('Template name is required.');
    return;
  }

  if (fields.length === 0) {
    alert('At least one field is required.');
    return;
  }

  if (editingTemplateId) {
    const index = currentTemplates.findIndex((t) => t.id === editingTemplateId);
    if (index !== -1) {
      currentTemplates[index] = { id: editingTemplateId, name, category, fields };
    }
  } else {
    const newId = 'tpl_' + slugify(name) + '_' + Date.now();
    currentTemplates.push({ id: newId, name, category, fields });
  }

  Storage.saveTemplates(currentTemplates);
  renderTemplateTable();
  closeTemplateModal();
}

async function deleteTemplate(id) {
  if (!confirm('Delete this template?')) return;
  currentTemplates = currentTemplates.filter((t) => t.id !== id);
  await Storage.saveTemplates(currentTemplates);
  renderTemplateTable();
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

  document.getElementById('add-template-btn').addEventListener('click', openAddTemplate);
  document.getElementById('add-field-btn').addEventListener('click', () => addFieldRow());
  document.getElementById('template-modal-save').addEventListener('click', saveTemplate);
  document.getElementById('template-modal-cancel').addEventListener('click', closeTemplateModal);
  document.getElementById('template-modal-close').addEventListener('click', closeTemplateModal);
  document.getElementById('template-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTemplateModal();
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
