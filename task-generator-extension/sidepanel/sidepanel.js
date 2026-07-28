let selectedTaskForImport = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadWorkspaceSwitcher();
  populateCreateTaskDropdowns();
  bindEvents();
});

// ===== VIEW SWITCHING =====

function showDashboard() {
  document.getElementById('view-dashboard').style.display = 'block';
  document.getElementById('view-create-task').style.display = 'none';
}

function showCreateTask() {
  document.getElementById('view-dashboard').style.display = 'none';
  document.getElementById('view-create-task').style.display = 'block';
  loadTemplateOptions();
}

// ===== WORKSPACE SWITCHER =====

async function loadWorkspaceSwitcher() {
  const settings = await Storage.getSettingsDecrypted();
  const select = document.getElementById('workspace-switcher');
  select.innerHTML = '';

  const workspaces = settings?.workspaces || [];

  if (workspaces.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— No workspace —';
    opt.disabled = true;
    select.appendChild(opt);
    return;
  }

  workspaces.forEach((ws) => {
    const opt = document.createElement('option');
    opt.value = ws.id;
    opt.textContent = `${ws.name} / ${ws.project_name || ws.project_id}`;
    if (ws.id === settings.active_workspace_id) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

async function switchWorkspace(workspaceId) {
  if (!workspaceId) return;
  await Storage.setActiveWorkspace(workspaceId);
  await loadWorkspaceSwitcher();
}

// ===== CREATE TASK =====

function populateCreateTaskDropdowns() {
  // header components now rendered dynamically by renderHeaderComponents
}

async function loadTemplateOptions() {
  const templates = await Storage.getTemplates();
  const select = document.getElementById('ct-template');
  const currentValue = select.value;
  select.innerHTML = '<option value="">— Select template —</option>';

  (templates || []).forEach((tpl) => {
    const opt = document.createElement('option');
    opt.value = tpl.id;
    opt.textContent = tpl.name;
    select.appendChild(opt);
  });

  select.value = currentValue;

  if (select.value) {
    onTemplateChange();
  } else {
    document.getElementById('ct-form').style.display = 'none';
  }
}

function onTemplateChange() {
  const templateId = document.getElementById('ct-template').value;
  const form = document.getElementById('ct-form');

  if (!templateId) {
    form.style.display = 'none';
    return;
  }

  form.style.display = 'block';
  renderHeaderComponents(templateId);
  updateFullTitle();
  renderDoD();
  renderCustomFields(templateId);
}

async function renderHeaderComponents(templateId) {
  const container = document.getElementById('ct-header-components');
  if (!container) return;
  container.innerHTML = '';

  const templates = await Storage.getTemplates();
  const tpl = (templates || []).find((t) => t.id === templateId);
  const header = tpl?.header;

  if (!header || !header.segments || header.segments.length === 0) {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-group__label" for="ct-bracket">Bracket Category</label>
        <select class="form-group__input" id="ct-bracket">
          <option value="">— Select bracket —</option>
          ${BRACKET_OPTIONS.map((b) => `<option value="${b}">[${b}]</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-group__label" for="ct-severity">Severity</label>
          <select class="form-group__input" id="ct-severity">
            <option value="">— Select —</option>
            ${SEVERITY_OPTIONS.map((s) => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-group__label" for="ct-priority">Priority</label>
          <select class="form-group__input" id="ct-priority">
            <option value="">— Select —</option>
            ${PRIORITY_OPTIONS.map((p) => `<option value="${p}">${p}</option>`).join('')}
          </select>
        </div>
      </div>`;
    container.querySelector('#ct-bracket').addEventListener('change', () => { updateFullTitle(); renderDoD(); });
    container.querySelector('#ct-severity').addEventListener('change', updateFullTitle);
    container.querySelector('#ct-priority').addEventListener('change', updateFullTitle);
    return;
  }

  const hasSegment = (name) => header.segments.includes(name);

  if (hasSegment('bracket')) {
    container.innerHTML += `
      <div class="form-group">
        <label class="form-group__label">Bracket (multi-select)</label>
        <select class="form-group__input" id="ct-bracket" multiple size="6">
          ${BRACKET_OPTIONS_FULL.map((b) => `<option value="${b.value}">[${b.value}] ${escapeHtml(b.label)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-group__label" for="ct-severity">Severity</label>
          <select class="form-group__input" id="ct-severity">
            ${SEVERITY_OPTIONS.map((s) => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-group__label" for="ct-priority">Priority</label>
          <select class="form-group__input" id="ct-priority">
            ${PRIORITY_OPTIONS.map((p) => `<option value="${p}">${p}</option>`).join('')}
          </select>
        </div>
      </div>`;
  }

  const customLabels = header.customLabels || [];
  const activeLabels = header.segments.filter((s) => s.startsWith('custom:')).map((s) => s.replace('custom:', ''));
  if (activeLabels.length > 0) {
    container.innerHTML += `
      <div class="form-group">
        <label class="form-group__label">Custom Labels</label>
        ${activeLabels.map((label) =>
          `<label class="dod-item"><input type="checkbox" class="ct-custom-label" data-label="${escapeHtml(label)}"> [${escapeHtml(label)}]</label>`
        ).join('')}
      </div>`;
  }

  const bracketEl = container.querySelector('#ct-bracket');
  if (bracketEl) {
    bracketEl.addEventListener('change', () => { updateFullTitle(); renderDoD(); });
  }
  container.querySelectorAll('#ct-severity, #ct-priority').forEach((el) => {
    el.addEventListener('change', updateFullTitle);
  });
  container.querySelectorAll('.ct-custom-label').forEach((el) => {
    el.addEventListener('change', updateFullTitle);
  });
}

function updateFullTitle() {
  const title = document.getElementById('ct-title').value.trim();
  const parts = [];

  const bracketSelect = document.getElementById('ct-bracket');
  if (bracketSelect) {
    if (bracketSelect.multiple) {
      const selected = Array.from(bracketSelect.selectedOptions).map((o) => o.value);
      selected.forEach((v) => parts.push('[' + v + ']'));
    } else {
      const v = bracketSelect.value;
      if (v) parts.push('[' + v + ']');
    }
  }

  document.querySelectorAll('.ct-custom-label:checked').forEach((cb) => {
    parts.push('[' + cb.dataset.label + ']');
  });

  const severityEl = document.getElementById('ct-severity');
  const priorityEl = document.getElementById('ct-priority');
  if (severityEl) {
    const sv = severityEl.value;
    const pv = priorityEl ? priorityEl.value : '';
    if (sv && pv) parts.push('[' + sv + '][' + pv + ']');
    else if (sv) parts.push('[' + sv + ']');
    else if (pv) parts.push('[' + pv + ']');
  }

  if (title) parts.push(title);

  document.getElementById('ct-full-title').textContent = parts.length > 0 ? parts.join(' ') : '—';
}

function renderDoD() {
  const list = document.getElementById('ct-dod-list');
  if (!list) return;

  const bracketEl = document.getElementById('ct-bracket');
  let brackets = [];
  if (bracketEl) {
    if (bracketEl.multiple) {
      brackets = Array.from(bracketEl.selectedOptions).map((o) => o.value);
    } else {
      const v = bracketEl.value;
      if (v) brackets = [v];
    }
  }

  const seen = new Set();
  const items = [];
  brackets.forEach((b) => {
    getDoDForBracket(b).forEach((item) => {
      if (!seen.has(item)) {
        seen.add(item);
        items.push(item);
      }
    });
  });

  list.innerHTML = items.map(
    (item, i) => `<label class="dod-item"><input type="checkbox" checked> ${escapeHtml(item)}</label>`
  ).join('');
}

function renderCustomFields(templateId) {
  const container = document.getElementById('ct-custom-fields');

  Storage.getTemplates().then((templates) => {
    const tpl = (templates || []).find((t) => t.id === templateId);
    if (!tpl || !tpl.fields || tpl.fields.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = tpl.fields.map((field) => {
      const label = escapeHtml(field.label);
      const key = field.key;
      const ph = escapeHtml(field.placeholder || field.label);
      const desc = field.description ? `<p class="form-group__hint">${escapeHtml(field.description)}</p>` : '';
      const defVal = field.defaultValue ? escapeHtml(field.defaultValue) : '';

      if (field.type === 'dropdown' && field.options) {
        const opts = field.options.map((o) => `<option value="${escapeHtml(o)}" ${o === field.defaultValue ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
        return `
          <div class="form-group">
            <label class="form-group__label" for="cf-${key}">${label}</label>
            <select class="form-group__input" id="cf-${key}" data-field-key="${key}">
              <option value="">— Select —</option>
              ${opts}
            </select>
            ${desc}
          </div>`;
      }

      if (field.type === 'rich_text') {
        return `
          <div class="form-group">
            <label class="form-group__label" for="cf-${key}">${label}</label>
            <textarea class="form-group__textarea" id="cf-${key}" data-field-key="${key}" rows="2" placeholder="${ph}">${defVal}</textarea>
            ${desc}
          </div>`;
      }

      if (field.type === 'checkbox_list') {
        return `
          <div class="form-group">
            <label class="form-group__label">${label}</label>
            <div id="cf-${key}">${(field.options || []).map((o) =>
              `<label class="dod-item"><input type="checkbox" data-field-key="${key}" value="${escapeHtml(o)}"> ${escapeHtml(o)}</label>`
            ).join('')}</div>
            ${desc}
          </div>`;
      }

      return `
        <div class="form-group">
          <label class="form-group__label" for="cf-${key}">${label}</label>
          <input class="form-group__input" type="${field.type === 'url' ? 'url' : 'text'}" id="cf-${key}" data-field-key="${key}" placeholder="${ph}" value="${defVal}">
          ${desc}
        </div>`;
    }).join('');
  });
}

function addAcRow() {
  const container = document.getElementById('ct-ac-list');
  const row = document.createElement('div');
  row.className = 'ac-row';
  row.innerHTML = `
    <input class="ac-row__input" type="text" placeholder="e.g. User can redeem voucher">
    <button class="ac-row__remove" title="Remove">&times;</button>
  `;
  row.querySelector('.ac-row__remove').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function collectFormData() {
  const templateId = document.getElementById('ct-template').value;
  const bracketEl = document.getElementById('ct-bracket');
  let bracket = '', bracketArr = [];
  if (bracketEl) {
    if (bracketEl.multiple) {
      bracketArr = Array.from(bracketEl.selectedOptions).map((o) => o.value);
      bracket = bracketArr.join(',');
    } else {
      bracket = bracketEl.value;
      bracketArr = bracket ? [bracket] : [];
    }
  }
  const severity = document.getElementById('ct-severity').value;
  const priority = document.getElementById('ct-priority').value;
  const title = document.getElementById('ct-title').value.trim();
  const story = document.getElementById('ct-story').value.trim();

  const acInputs = document.querySelectorAll('#ct-ac-list .ac-row__input');
  const acceptanceCriteria = Array.from(acInputs).map((inp) => inp.value.trim()).filter(Boolean);

  const dodChecked = [];
  document.querySelectorAll('#ct-dod-list .dod-item input[type="checkbox"]').forEach((cb) => {
    if (cb.checked) dodChecked.push(cb.parentElement.textContent.trim());
  });

  const customFields = {};
  document.querySelectorAll('#ct-custom-fields [data-field-key]').forEach((el) => {
    const key = el.dataset.fieldKey;
    if (el.type === 'checkbox') {
      if (!customFields[key]) customFields[key] = [];
      if (el.checked) customFields[key].push(el.value);
    } else {
      customFields[key] = el.value;
    }
  });

  const fullTitle = document.getElementById('ct-full-title').textContent;

  return {
    templateId,
    bracket,
    bracketArr,
    severity,
    priority,
    title,
    fullTitle,
    story,
    acceptanceCriteria,
    dod: dodChecked,
    customFields
  };
}

function previewTask() {
  const data = collectFormData();

  if (!data.templateId) { alert('Please select a template.'); return; }
  if (!data.title) { alert('Please enter an Action + Object Title.'); return; }
  if (!data.story) { alert('Please enter a Requirement Story.'); return; }
  if (data.acceptanceCriteria.length === 0) { alert('Please add at least one Acceptance Criterion.'); return; }

  alert(`Preview coming soon in Phase 1B Sesi 2.\n\nTask: ${data.fullTitle}\nAC: ${data.acceptanceCriteria.length} items\nDoD: ${data.dod.length} items`);
}

async function saveDraft() {
  const data = collectFormData();
  if (!data.templateId) { alert('Please select a template.'); return; }
  if (!data.title) { alert('Please enter a title.'); return; }

  const task = {
    id: 'task_draft_' + Date.now(),
    parent_id: null,
    bracket: data.bracket,
    severity: data.severity,
    priority: data.priority,
    title: data.title,
    full_title: data.fullTitle,
    is_selected: true,
    payload: {
      story: data.story,
      acceptance_criteria: data.acceptanceCriteria,
      dod: data.dod,
      ...data.customFields
    },
    sync_status: 'draft'
  };

  const batch = await Storage.getActiveBatch() || {
    batch_id: 'batch_' + Date.now(),
    source_prd: '',
    tasks: []
  };
  batch.tasks.push(task);
  await Storage.saveActiveBatch(batch);
  alert('Task saved as draft.');
}

// ===== FETCH EXTERNAL MODAL =====

function openFetchModal() {
  document.getElementById('fetch-keyword').value = '';
  document.getElementById('search-results').innerHTML = '<p class="empty-state__text">Enter a keyword to search.</p>';
  selectedTaskForImport = null;
  document.getElementById('fetch-import-btn').disabled = true;
  document.getElementById('fetch-modal').classList.add('modal-overlay--open');
}

function closeFetchModal() {
  document.getElementById('fetch-modal').classList.remove('modal-overlay--open');
}

async function searchTasks() {
  const keyword = document.getElementById('fetch-keyword').value.trim();
  const resultsEl = document.getElementById('search-results');

  if (keyword.length < 3) {
    resultsEl.innerHTML = '<p class="empty-state__text">Min. 3 characters.</p>';
    return;
  }

  resultsEl.innerHTML = '<p class="empty-state__text">Searching...</p>';

  try {
    const tasks = await PlaneAPI.searchIssues(keyword);
    renderSearchResults(tasks);
  } catch {
    resultsEl.innerHTML = '<p class="empty-state__text">Search failed. Check connection.</p>';
  }
}

function renderSearchResults(tasks) {
  const resultsEl = document.getElementById('search-results');

  if (!tasks || tasks.length === 0) {
    resultsEl.innerHTML = '<p class="empty-state__text">No tasks found.</p>';
    return;
  }

  resultsEl.innerHTML = '';
  tasks.forEach((task) => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.dataset.id = task.id;
    item.innerHTML = `
      <strong>${escapeHtml(task.name)}</strong>
      <br>
      <small>${task.project || ''} — ${task.state || ''}</small>
    `;
    item.addEventListener('click', () => selectSearchResult(item, task));
    resultsEl.appendChild(item);
  });
}

function selectSearchResult(el, task) {
  document.querySelectorAll('.search-result-item').forEach((i) => i.classList.remove('search-result-item--selected'));
  el.classList.add('search-result-item--selected');
  selectedTaskForImport = task;
  document.getElementById('fetch-import-btn').disabled = false;
}

async function importToWorkspace() {
  if (!selectedTaskForImport) return;

  const includeChild = document.getElementById('include-child-tasks').checked;
  let taskData = selectedTaskForImport;

  if (includeChild) {
    try {
      const children = await PlaneAPI.getChildIssues(taskData.id);
      taskData.children = children || [];
    } catch {
      taskData.children = [];
    }
  }

  const batch = await Storage.getActiveBatch() || { batch_id: 'batch_' + Date.now(), source_prd: '', tasks: [] };
  batch.tasks.push({
    id: 'task_import_' + Date.now(),
    parent_id: null,
    bracket: '',
    severity: 'P2',
    priority: 'Medium',
    title: taskData.name,
    full_title: taskData.name,
    is_selected: true,
    payload: { story: taskData.description_html || '' },
    sync_status: 'imported'
  });

  await Storage.saveActiveBatch(batch);
  alert(`Imported "${taskData.name}" to workspace.`);
  closeFetchModal();
}

// ===== DASHBOARD SEARCH =====

async function performSearch() {
  const keyword = document.getElementById('search-input').value.trim();
  const filter = document.getElementById('status-filter').value;

  if (keyword.length < 3) {
    return;
  }

  try {
    const tasks = await PlaneAPI.searchIssues(keyword);
    renderTaskTable(tasks);
  } catch {
    alert('Search failed. Check your connection and settings.');
  }
}

function renderTaskTable(tasks) {
  const emptyState = document.getElementById('empty-state');
  const tableWrapper = document.getElementById('task-table-wrapper');
  const tbody = document.getElementById('task-table-body');

  if (!tasks || tasks.length === 0) {
    emptyState.style.display = 'flex';
    tableWrapper.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  tableWrapper.style.display = 'block';
  tbody.innerHTML = '';

  tasks.forEach((task) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(task.project || '—')}</td>
      <td class="task-table__title">${escapeHtml(task.name)}</td>
      <td><span class="priority-badge priority-badge--${task.priority || 'medium'}">${task.priority || '—'}</span></td>
      <td><span class="status-badge">${task.state || '—'}</span></td>
      <td><button class="btn btn--secondary btn--sm" data-id="${task.id}">Edit</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== HELPERS =====

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== BIND EVENTS =====

function bindEvents() {
  document.getElementById('create-task-btn').addEventListener('click', showCreateTask);
  document.getElementById('back-to-dashboard').addEventListener('click', showDashboard);

  document.getElementById('fetch-external-btn').addEventListener('click', openFetchModal);
  document.getElementById('fetch-modal-close').addEventListener('click', closeFetchModal);
  document.getElementById('fetch-search-btn').addEventListener('click', searchTasks);
  document.getElementById('fetch-import-btn').addEventListener('click', importToWorkspace);

  document.getElementById('search-btn').addEventListener('click', performSearch);
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadWorkspaceSwitcher();
  });

  document.getElementById('workspace-switcher').addEventListener('change', (e) => {
    switchWorkspace(e.target.value);
  });

  document.getElementById('manage-workspaces-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('fetch-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeFetchModal();
  });

  document.getElementById('ct-template').addEventListener('change', onTemplateChange);
  document.getElementById('ct-title').addEventListener('input', updateFullTitle);

  document.getElementById('ct-add-ac').addEventListener('click', addAcRow);
  document.getElementById('ct-preview-btn').addEventListener('click', previewTask);
  document.getElementById('ct-save-draft').addEventListener('click', saveDraft);
}
