let selectedTaskForImport = null;
let stateCache = {};
let memberCache = {};
let editingIssueId = null;
let allTasks = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadWorkspaceSwitcher();
  populateCreateTaskDropdowns();
  await loadTemplateOptions();
  await populateAITemplateDropdown();
  await loadBatch();
  await Promise.all([initDirectForm(), loadStateCache(), loadMemberCache()]);
  setupParentSearch();
  bindEvents();
  switchCTMode('direct');
});

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
  PlaneAPI.invalidateIssueCache();
  PlaneAPI._invalidateProjectCache();
  await Storage.setActiveWorkspace(workspaceId);
  await loadWorkspaceSwitcher();
}

// ===== CREATE TASK =====

function populateCreateTaskDropdowns() {
  const bracketEl = document.getElementById('ct-bracket');
  if (bracketEl) bracketEl.innerHTML = BRACKET_OPTIONS.map((b) => `<option value="${b}">[${b}]</option>`).join('');

  const severityEl = document.getElementById('ct-severity');
  if (severityEl) severityEl.innerHTML = SEVERITY_OPTIONS.map((s) => `<option value="${s}">${s}</option>`).join('');

  const priorityEl = document.getElementById('ct-priority');
  if (priorityEl) priorityEl.innerHTML = PRIORITY_OPTIONS.map((p) => `<option value="${p}">${p}</option>`).join('');
}

async function loadTemplateOptions() {
  const templates = await Storage.getTemplates();
  const select = document.getElementById('ct-template');
  if (!select) return;
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
  }
}

async function onTemplateChange() {
  const templateSelect = document.getElementById('ct-template');
  if (!templateSelect) return;
  const templateId = templateSelect.value;
  const modeManual = document.getElementById('ct-mode-manual');

  if (!templateId) {
    if (modeManual) modeManual.style.display = 'none';
    return;
  }

  if (modeManual) modeManual.style.display = 'block';
  renderDoD(templateId);
}

async function renderDoD(templateId) {
  const list = document.getElementById('ct-dod-list');
  if (!list) return;

  let brackets = [];
  if (templateId) {
    const templates = await Storage.getTemplates();
    const tpl = (templates || []).find((t) => t.id === templateId);
    const header = tpl?.header;
    if (header?.segments) {
      brackets = header.segments.filter((s) => !s.startsWith('custom:') && !['severity', 'priority'].includes(s) && s !== 'bracket');
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

  const editor = document.getElementById('ct-dod-editor');
  if (!editor) return;

  if (items.length > 0) {
    editor.innerHTML = '<ul>' + items.map((item) => `<li>${escapeHtml(item)}</li>`).join('') + '</ul>';
  }
}

function addAcRow() {}

function collectFormData() {
  const templateSelect = document.getElementById('ct-template');
  if (!templateSelect) return null;
  const templateId = templateSelect.value;
  const title = document.getElementById('ct-title').value.trim();
  const storyEl = document.getElementById('ct-story-editor');
  const story = storyEl ? storyEl.innerHTML : '';
  const acEl = document.getElementById('ct-ac-editor');
  const acceptanceCriteriaHtml = acEl ? acEl.innerHTML : '';
  const dodEl = document.getElementById('ct-dod-editor');
  const dodHtml = dodEl ? dodEl.innerHTML : '';

  return { templateId, title, story, acceptanceCriteriaHtml, dodHtml };
}

async function generateFromManualForm(data, mode) {
  if (!data.templateId) { showToast('Pilih template terlebih dahulu.', 'error'); return; }
  if (!data.title) { showToast('Masukkan judul task.', 'error'); return; }
  if (!data.story || data.story === '<br>') { showToast('Masukkan story/deskripsi task.', 'error'); return; }

  const plainAc = data.acceptanceCriteriaHtml ? data.acceptanceCriteriaHtml.replace(/<[^>]*>/g, '').trim() : '';
  if (!plainAc) { showToast('Tulis minimal 1 Acceptance Criteria.', 'error'); return; }

  const btn = document.getElementById(mode === 'draft' ? 'ct-save-draft' : 'ct-preview-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

  try {
    const templates = await Storage.getTemplates();
    const tpl = (templates || []).find((t) => t.id === data.templateId);
    if (!tpl) { showToast('Template tidak ditemukan.', 'error'); return; }

    const tplFields = tpl.fields || [];
    const tplFieldKeys = tplFields.map((f) => f.key);

    const segments = tpl.header?.segments || [];
    const bracketOptions = tpl.header?.bracketOptions || [];
    const customLabels = (tpl.header?.customLabels || []).filter((l) =>
      segments.includes('custom:' + l)
    );
    const expectedResult = tpl.header?.expectedResult || '';
    const fieldSchema = tplFields.map((f) => {
      let desc = `${f.label} (${f.type}${f.constraint ? ', ' + f.constraint : ''})`;
      if (f.options && f.options.length > 0) desc += ` [${f.options.join(', ')}]`;
      if (f.description) desc += ` — ${f.description}`;
      return '- ' + f.key + ': ' + desc;
    }).join('\n');

    const parentEl = document.getElementById('ct-parent');
    const parentId = parentEl ? parentEl.value : null;
    const activeBatch = await Storage.getActiveBatch();
    const parentTask = parentId ? (activeBatch?.tasks || []).find((t) => t.id === parentId) : null;

    const prompt = `Generate structured software engineering tasks from the following user input.

Template format context:
- Title segments (brackets): ${bracketOptions.join(', ') || 'None'}
- Custom labels: ${customLabels.join(', ') || 'None'}
- Segments: ${segments.join(', ')}

Expected result / guidance:
${expectedResult || 'Not specified'}
${parentTask ? `\nThis task is a CHILD of "${parentTask.full_title || parentTask.title}". Ensure it follows the parent scope.\n` : ''}

Task fields to fill (for each generated task, determine appropriate values):
${fieldSchema || 'No custom fields defined.'}

User input:
Title: ${data.title}
Story / Description (HTML):
${data.story}

Acceptance Criteria (HTML):
${data.acceptanceCriteriaHtml}

Definition of Done (HTML):
${data.dodHtml}

IMPORTANT RULES:
- BREAK DOWN the user story, acceptance criteria, and DoD to fill values for each task field listed above
- Automatically BREAK DOWN the user input into MULTIPLE single-responsibility tasks
- For example "CRUD" must be split into separate Create, Read, Update, Delete tasks
- For each functional requirement, consider ALL necessary layers: Backend API, Database / Slicing, Frontend consume
- Each task must cover ONLY ONE responsibility (single-responsibility micro-task)
- Generate minimum 2 tasks, maximum 8 tasks
- Use the Story, Acceptance Criteria, and DoD as foundations but enrich them with technical details, edge cases, and comprehensive coverage

CRITICAL — FIELD VALUES:
- You MUST fill EVERY field in the "field_values" object for EACH task (parent AND children)
- Do NOT leave ANY field empty — generate appropriate content for every field
- Even if the user's input doesn't explicitly mention a field, derive it intelligently from context
- EXAMPLES:
   - EXPECTED_RESULT: write a DETAILED expected outcome (3-5 sentences describing the end-to-end expected behavior, including success criteria and user impact)
   - STORY: always include the user story content relevant to this task
   - PARAMETER: derive API parameters from the described functionality
   - FIGMA_LINK: extract Figma/design URL from description, or write "—" if none
   - URL_DOCUMENT: extract doc URL from description, or write "—" if none
   - API: derive the endpoint URL from context
- For dropdown fields, ONLY use values from the allowed options list.
- For checkbox_list fields, use zero or more values from the allowed options list.

PARENT-CHILD STRUCTURE RULES:
- Automatically create parent-child STRUCTURE when tasks are logically related
- Example: "Create Voucher API" (BE, backend) → parent, "Consume Create Voucher API" (FE, frontend) → child
- Every "Slicing" or backend/data-layer task MUST have at least one child "Consume" task (frontend integration)
- Group related UI, API, and data tasks under a single parent
- Maximum depth: 1 level (parent → children, no grandchildren)
- If a task naturally splits into sub-tasks, list them as children of that task

Return ONLY a valid JSON array (no markdown, no backticks):
[
  {
    "title": "[BE] [P1][High] Action-oriented title",
    "story": "Detailed user story and technical description...",
    "acceptance_criteria": ["item1", "item2", "..."],
    "dod": ["item1", "item2", "..."],
    "field_values": {
      "MODULE": "value from story",
      "API": "/api/v1/...",
      "FIGMA_LINK": "https://..."
    },
    "children": [
      {
        "title": "[FE] Consume task",
        "story": "...",
        "acceptance_criteria": ["..."],
        "dod": ["..."],
        "field_values": { ... }
      }
    ]
  }
]`;

    const raw = await AIProvider.generate(prompt);
    const results = JSON.parse(raw.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim());
    const tasksArray = Array.isArray(results) ? results : [results];

    const batch = activeBatch || {
      batch_id: 'batch_' + Date.now(),
      source_prd: '',
      tasks: []
    };

    function flattenTasks(items, parentId) {
      const flat = [];
      let seq = 0;
      items.forEach((item) => {
        const children = item.children || [];
        delete item.children;
        const taskId = 'task_' + Date.now() + '_' + seq++;
        const emptyFields = {};
        tplFieldKeys.forEach((k) => { emptyFields[k] = ''; });
        const payload = { ...emptyFields };
        if (item.field_values) {
          Object.assign(payload, item.field_values);
        }
        payload.story = item.story || data.story || '';
        payload.acceptance_criteria = item.acceptance_criteria || data.acceptanceCriteriaHtml || '';
        payload.dod = item.dod || data.dodHtml || '';
        if ('STORY' in emptyFields && payload.story) payload.STORY = payload.story;
        if ('ACCEPTANCE_CRITERIA' in emptyFields && payload.acceptance_criteria) payload.ACCEPTANCE_CRITERIA = payload.acceptance_criteria;
        if ('EXPECTED_RESULT' in emptyFields && !payload.EXPECTED_RESULT) {
          const storyText = data.story ? data.story.replace(/<[^>]*>/g, '').trim() : '';
          payload.EXPECTED_RESULT = storyText ? `Hasil yang diharapkan: ${storyText.substring(0, 500)}. Semua skenario berjalan sesuai spesifikasi, mencakup success case dan error handling. Pengguna mendapatkan feedback yang jelas dan sistem berperilaku sesuai yang diharapkan.` : '—';
        }
        if ('PARAMETER' in emptyFields && !payload.PARAMETER) payload.PARAMETER = '—';
        if ('FIGMA_LINK' in emptyFields && !payload.FIGMA_LINK && data.story) {
          const figmaMatch = data.story.match(/https:\/\/(?:www\.)?figma\.com\/[^\s<"']+/);
          if (figmaMatch) payload.FIGMA_LINK = figmaMatch[0];
        }
        if ('URL_DOCUMENT' in emptyFields && !payload.URL_DOCUMENT && data.story) {
          const docMatch = data.story.match(/https:\/\/(?:docs\.google\.com|drive\.google\.com|notion\.so|mirro\.com|miro\.com|github\.com)\/[^\s<"']+/);
          if (docMatch) payload.URL_DOCUMENT = docMatch[0];
        }
        tplFieldKeys.forEach((k) => {
          const v = payload[k];
          if (v === undefined || v === null || v === '') payload[k] = '—';
        });
        flat.push({
          id: taskId,
          title: item.title || data.title,
          full_title: item.title || data.title,
          parent_id: parentId || null,
          is_selected: true,
          sync_status: mode === 'draft' ? 'draft' : 'pending',
          payload,
          _fieldOrder: tplFieldKeys
        });
        if (children.length > 0) {
          flat.push(...flattenTasks(children, taskId));
        }
      });
      return flat;
    }

    const flattened = flattenTasks(tasksArray, parentId);
    flattened.forEach((t) => batch.tasks.push(t));
    batch.fieldOrder = tplFieldKeys;
    await Storage.saveActiveBatch(batch);

    showToast(`Task ${mode === 'draft' ? 'saved as draft' : 'generated'}! Check batch for review.`, 'success');
    resetForm();
    switchMode('batch');
    await loadBatch();
  } catch (err) {
    showToast(`Gagal generate: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = mode === 'draft' ? 'Save Draft' : 'Submit to Plane'; }
  }
}

// ===== TOAST =====

function showToast(message, type) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type || 'info'}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('toast--visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===== SUBMIT SINGLE TASK =====

const PRIORITY_MAP = { 'Critical': 'urgent', 'High': 'high', 'Medium': 'medium', 'Low': 'low' };

async function submitTask() {
  const data = collectFormData();
  if (!data) return;
  await generateFromManualForm(data, 'submit');
}

function resetForm() {
  const templateEl = document.getElementById('ct-template');
  if (templateEl) templateEl.value = '';
  const modeManual = document.getElementById('ct-mode-manual');
  if (modeManual) modeManual.style.display = 'none';
  const titleEl = document.getElementById('ct-title');
  if (titleEl) titleEl.value = '';
  const storyEditor = document.getElementById('ct-story-editor');
  if (storyEditor) storyEditor.innerHTML = '';
  const acEditor = document.getElementById('ct-ac-editor');
  if (acEditor) acEditor.innerHTML = '';
  const dodEditor = document.getElementById('ct-dod-editor');
  if (dodEditor) dodEditor.innerHTML = '';
}

// ===== AI MODE (MODE B) =====

function switchCTMode(mode) {
  document.querySelectorAll('[data-ct-mode]').forEach((tab) => {
    tab.classList.toggle('toolbar__tab--active', tab.dataset.ctMode === mode);
  });

  document.getElementById('ct-mode-manual').style.display = mode === 'manual' ? 'block' : 'none';
  document.getElementById('ct-mode-ai').style.display = mode === 'ai' ? 'block' : 'none';
  document.getElementById('ct-mode-direct').style.display = mode === 'direct' ? 'block' : 'none';
  document.getElementById('ct-footer-manual').style.display = mode === 'manual' ? 'flex' : 'none';
  document.getElementById('ct-footer-ai').style.display = mode === 'ai' ? 'flex' : 'none';
  document.getElementById('ct-footer-direct').style.display = mode === 'direct' ? 'flex' : 'none';

  const form = document.getElementById('ct-form');
  if (form) form.style.display = mode === 'direct' ? 'block' : form.style.display;
}

async function populateAITemplateDropdown() {
  const templates = await Storage.getTemplates();
  const select = document.getElementById('ct-ai-template');
  if (!select) return;
  select.innerHTML = '<option value="">— No template context —</option>';
  (templates || []).forEach((tpl) => {
    const opt = document.createElement('option');
    opt.value = tpl.id;
    opt.textContent = tpl.name;
    select.appendChild(opt);
  });
}

// ===== MULTI-SELECT COMPONENT =====

function createMultiSelect(containerId, options, { labelKey = 'name', valueKey = 'id', onChange } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const selected = new Set();

  const trigger = document.createElement('div');
  trigger.className = 'multi-select__trigger';
  trigger.tabIndex = 0;

  const chips = document.createElement('div');
  chips.className = 'multi-select__chips';

  const placeholder = document.createElement('span');
  placeholder.className = 'multi-select__placeholder';
  placeholder.textContent = '— Select —';

  const arrow = document.createElement('span');
  arrow.className = 'multi-select__arrow';
  arrow.textContent = '▼';

  trigger.appendChild(chips);
  chips.appendChild(placeholder);
  trigger.appendChild(arrow);

  const dropdown = document.createElement('div');
  dropdown.className = 'multi-select__dropdown';

  const optionEls = [];
  (options || []).forEach((opt) => {
    const div = document.createElement('div');
    div.className = 'multi-select__option';
    div.dataset.value = opt[valueKey];

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'multi-select__option-checkbox';

    const label = document.createElement('span');
    label.className = 'multi-select__option-label';
    label.textContent = opt[labelKey] || opt[valueKey] || '—';

    div.appendChild(cb);
    div.appendChild(label);

    div.addEventListener('click', (e) => {
      if (e.target !== cb) cb.checked = !cb.checked;
      toggleOption(opt[valueKey], cb.checked, opt[labelKey] || opt[valueKey]);
    });

    cb.addEventListener('change', () => {
      toggleOption(opt[valueKey], cb.checked, opt[labelKey] || opt[valueKey]);
    });

    dropdown.appendChild(div);
    optionEls.push({ el: div, cb, value: opt[valueKey], label: opt[labelKey] || opt[valueKey] });
  });

  container.appendChild(trigger);
  container.appendChild(dropdown);

  function toggleOption(value, isSelected, displayLabel) {
    if (isSelected) {
      selected.add(value);
    } else {
      selected.delete(value);
    }
    updateUI();
    if (onChange) onChange(Array.from(selected));
  }

  function updateUI() {
    chips.innerHTML = '';
    if (selected.size === 0) {
      chips.appendChild(placeholder);
    } else {
      selected.forEach((val) => {
        const opt = optionEls.find((o) => o.value === val);
        const label = opt ? opt.label : val;
        const chip = document.createElement('span');
        chip.className = 'multi-select__chip';
        chip.innerHTML = `${escapeHtml(label)} <span class="multi-select__chip-remove" data-value="${val}">&times;</span>`;
        chip.querySelector('.multi-select__chip-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          selected.delete(val);
          const optEl = optionEls.find((o) => o.value === val);
          if (optEl) optEl.cb.checked = false;
          updateUI();
          if (onChange) onChange(Array.from(selected));
        });
        chips.appendChild(chip);
      });
    }
    optionEls.forEach((o) => {
      o.cb.checked = selected.has(o.value);
      o.el.classList.toggle('multi-select__option--selected', selected.has(o.value));
    });
  }

  trigger.addEventListener('click', () => {
    dropdown.classList.toggle('multi-select__dropdown--open');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('multi-select__dropdown--open');
    }
  });

  return {
    getValue: () => Array.from(selected),
    setValue: (values) => {
      selected.clear();
      (values || []).forEach((v) => selected.add(v));
      optionEls.forEach((o) => { o.cb.checked = selected.has(o.value); });
      updateUI();
    },
    clear: () => {
      selected.clear();
      optionEls.forEach((o) => { o.cb.checked = false; });
      updateUI();
    },
    updateOptions: (newOptions) => {
      dropdown.innerHTML = '';
      optionEls.length = 0;
      selected.clear();
      (newOptions || []).forEach((opt) => {
        const div = document.createElement('div');
        div.className = 'multi-select__option';
        div.dataset.value = opt[valueKey];

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'multi-select__option-checkbox';

        const label = document.createElement('span');
        label.className = 'multi-select__option-label';
        label.textContent = opt[labelKey] || opt[valueKey] || '—';

        div.appendChild(cb);
        div.appendChild(label);

        div.addEventListener('click', (e) => {
          if (e.target !== cb) cb.checked = !cb.checked;
          toggleOption(opt[valueKey], cb.checked, opt[labelKey] || opt[valueKey]);
        });

        cb.addEventListener('change', () => {
          toggleOption(opt[valueKey], cb.checked, opt[labelKey] || opt[valueKey]);
        });

        dropdown.appendChild(div);
        optionEls.push({ el: div, cb, value: opt[valueKey], label: opt[labelKey] || opt[valueKey] });
      });
      updateUI();
    }
  };
}

// ===== DIRECT TO PLANE (MODE C) =====

let dtAssignees, dtLabels, dtModules;
let dtParentSearchTimer;
let dtQuill;

async function initDirectForm() {
  try {
    const [states, cycles, members, labels, modules, estimatePoints] = await Promise.all([
      PlaneAPI.getStates(),
      PlaneAPI.getCycles(),
      PlaneAPI.getMembers(),
      PlaneAPI.getLabels(),
      PlaneAPI.getModules(),
      PlaneAPI.getEstimatePoints()
    ]);

    console.log('[DirectForm] states:', states?.length, 'cycles:', cycles?.length, 'members:', members?.length, 'labels:', labels?.length, 'modules:', modules?.length, 'estimatePoints:', estimatePoints?.length);

    const stateSelect = document.getElementById('dt-state');
    if (stateSelect) {
      stateSelect.innerHTML = '<option value="">— Select status —</option>';
      (states || []).forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name || s.title || s.id;
        stateSelect.appendChild(opt);
      });
    }

    const cycleSelect = document.getElementById('dt-cycle');
    if (cycleSelect) {
      cycleSelect.innerHTML = '<option value="">— No cycle —</option>';
      (cycles || []).forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name || `Cycle ${c.start_date || ''} — ${c.end_date || ''}`;
        cycleSelect.appendChild(opt);
      });
    }

    const memberOptions = (members || []).map((m) => {
      const user = m.member || m;
      return { id: user.id, name: user.display_name || user.email || user.name || user.id };
    });

    const labelOptions = (labels || []).map((l) => ({
      id: l.id,
      name: l.name || l.title || l.id
    }));

    const moduleOptions = (modules || []).map((mod) => ({
      id: mod.id,
      name: mod.name || mod.title || mod.id
    }));

    const estimateField = document.getElementById('estimate-field');
    const estSelect = document.getElementById('dt-estimate');
    if (estimateField && estSelect) {
      const pts = estimatePoints || [];
      if (pts.length > 0) {
        estSelect.style.display = '';
        estSelect.innerHTML = '<option value="">— No estimate —</option>';
        pts.forEach((ep) => {
          const opt = document.createElement('option');
          opt.value = ep.id || String(ep.key);
          opt.textContent = ep.value + (ep.description ? ' (' + ep.description + ')' : '');
          estSelect.appendChild(opt);
        });
        const existingInput = estimateField.querySelector('input[type="number"]');
        if (existingInput) existingInput.remove();
      } else {
        estSelect.style.display = 'none';
        const existingInput = estimateField.querySelector('input[type="number"]');
        if (!existingInput) {
          const numInput = document.createElement('input');
          numInput.type = 'number';
          numInput.min = '0';
          numInput.step = '1';
          numInput.className = 'form-group__input';
          numInput.id = 'dt-estimate-points';
          numInput.placeholder = 'Enter estimate points (e.g. 3)';
          estimateField.appendChild(numInput);
        }
      }
    }

    dtAssignees = createMultiSelect('dt-assignees', memberOptions);
    dtLabels = createMultiSelect('dt-labels', labelOptions);
    dtModules = createMultiSelect('dt-modules', moduleOptions);
  } catch (e) {
    console.error('initDirectForm API error:', e);
    // render empty multi-selects so fields are visible even on API failure
    dtAssignees = createMultiSelect('dt-assignees', []);
    dtLabels = createMultiSelect('dt-labels', []);
    dtModules = createMultiSelect('dt-modules', []);
  }

  const editorEl = document.getElementById('dt-description-editor');
  if (editorEl) {
    dtQuill = editorEl;
  }

  const toolbar = document.getElementById('dt-editor-toolbar');
  if (toolbar) {
    toolbar.querySelectorAll('button[data-cmd]').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        const arg = btn.dataset.arg;
        if (cmd === 'createLink') {
          const url = prompt('Enter URL:');
          if (url) document.execCommand('createLink', false, url);
        } else if (cmd === 'formatBlock' && arg) {
          document.execCommand('formatBlock', false, arg);
        } else if (cmd === 'insertHTML' && arg) {
          document.execCommand('insertHTML', false, arg);
        } else if (cmd === 'insertTable') {
          insertTable();
        } else {
          document.execCommand(cmd, false, null);
        }
        editorEl.focus();
      });
    });
  }
}

function insertTable() {
  const cols = parseInt(prompt('Columns:', '3'), 10) || 3;
  const rows = parseInt(prompt('Rows:', '3'), 10) || 3;
  if (isNaN(cols) || isNaN(rows) || cols < 1 || rows < 1) return;

  let html = '<table><tbody>';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      html += '<td><br></td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table><br>';
  document.execCommand('insertHTML', false, html);
}

function setupParentSearch() {
  const input = document.getElementById('dt-parent-search');
  const results = document.getElementById('dt-parent-results');

  if (!input || !results) return;

  input.addEventListener('input', () => {
    clearTimeout(dtParentSearchTimer);
    const keyword = input.value.trim();
    if (!keyword) {
      results.classList.remove('parent-search-results--open');
      return;
    }
    dtParentSearchTimer = setTimeout(async () => {
      try {
        const tasks = await PlaneAPI.searchIssuesCached(keyword);
        results.innerHTML = '';
        if (!tasks || tasks.length === 0) {
          results.innerHTML = '<div class="parent-search-item" style="color:#94a3b8;padding:12px;text-align:center">No tasks found</div>';
          results.classList.add('parent-search-results--open');
          return;
        }

        const maxResults = 50;
        const shown = tasks.slice(0, maxResults);

        shown.forEach((node) => {
          const keyPrefix = node._projectIdentifier ? node._projectIdentifier + '-' : '';
          const seqStr = keyPrefix + (node.sequence_id || '');
          const sc = getStateColor(node);
          const priorityLower = (node.priority || '').toLowerCase();

          const row = document.createElement('div');
          row.className = 'parent-search-item-row';
          row.innerHTML = `
            <div style="display:flex;align-items:baseline;gap:8px">
              <span class="parent-search-item__key" style="font-size:11px;color:#64748b;white-space:nowrap">${escapeHtml(seqStr)}</span>
              <span class="parent-search-item__title" style="flex:1;font-size:13px">${escapeHtml(node.name || '')}</span>
            </div>
            <div style="display:flex;gap:6px;margin-top:4px">
              <span class="priority-badge priority-badge--${priorityLower}">${node.priority || '—'}</span>
              <span class="status-badge" style="background:${sc};color:${textColorForBg(sc)};font-size:10px;padding:2px 6px">${escapeHtml(getStateName(node))}</span>
              <span style="font-size:10px;color:#94a3b8">${escapeHtml(node._projectIdentifier || '')}</span>
            </div>
          `;
          row.addEventListener('click', () => {
            document.getElementById('dt-parent').value = node.id;
            input.value = (seqStr ? seqStr + ' — ' : '') + (node.name || '');
            results.classList.remove('parent-search-results--open');
          });
          results.appendChild(row);
        });

        if (tasks.length > maxResults) {
          const more = document.createElement('div');
          more.style.cssText = 'padding:8px 12px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0';
          more.textContent = `+ ${tasks.length - maxResults} more results`;
          results.appendChild(more);
        }

        results.classList.add('parent-search-results--open');
      } catch {
        results.innerHTML = '<div class="parent-search-item" style="color:#dc2626;padding:12px;text-align:center">Error loading tasks</div>';
        results.classList.add('parent-search-results--open');
      }
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.remove('parent-search-results--open');
    }
  });
}

async function refreshTree() {
  const searchInfo = document.getElementById('search-info');
  const spinner = document.getElementById('search-spinner');
  const infoText = document.getElementById('search-info-text');
  searchInfo.style.display = 'flex';
  spinner.style.display = 'block';
  infoText.textContent = 'Loading...';
  try {
    const issues = await PlaneAPI.searchIssues();
    allTasks = issues || [];
    renderTaskTree(allTasks);
    if (allTasks.length === 0) {
      searchInfo.style.display = 'flex';
      spinner.style.display = 'none';
      infoText.textContent = 'No tasks found.';
    } else {
      searchInfo.style.display = 'none';
    }
  } catch (err) {
    searchInfo.style.display = 'flex';
    spinner.style.display = 'none';
    infoText.textContent = `Error: ${err.message}`;
    showToast(err.message, 'error');
  } finally {
    spinner.style.display = 'none';
  }
}

function populateDirectForm(task) {
  const stateId = typeof task.state === 'object' && task.state ? (task.state.id || task.state) : task.state;
  document.getElementById('dt-title').value = task.name || '';
  if (dtQuill) dtQuill.innerHTML = task.description_html || '';
  document.getElementById('dt-state').value = stateId || '';
  document.getElementById('dt-priority').value = task.priority || '';
  document.getElementById('dt-cycle').value = task.cycle_id || '';

  if (dtAssignees) {
    const ids = (task.assignees || []).map(a => typeof a === 'object' ? (a.id || a) : a);
    dtAssignees.setValue(ids);
  }
  if (dtLabels) {
    const ids = (task.labels || []).map(l => typeof l === 'object' ? (l.id || l) : l);
    dtLabels.setValue(ids);
  }
  if (dtModules) {
    const ids = (task.module_ids || []).map(m => typeof m === 'object' ? (m.id || m) : m);
    dtModules.setValue(ids);
  }

  const parentId = typeof task.parent === 'object' && task.parent ? (task.parent.id || task.parent) : (task.parent || '');
  document.getElementById('dt-parent').value = parentId;

  if (parentId) {
    updateParentSearchValue(parentId);
  } else {
    document.getElementById('dt-parent-search').value = '';
  }

  document.getElementById('dt-start-date').value = task.start_date || '';
  document.getElementById('dt-target-date').value = task.target_date || '';
  const estEl = document.getElementById('dt-estimate');
  if (estEl && estEl.style.display !== 'none') estEl.value = task.estimate_point || '';
  const estInput = document.getElementById('dt-estimate-points');
  if (estInput) estInput.value = task.estimate_point || '';
}

async function updateParentSearchValue(parentId) {
  const input = document.getElementById('dt-parent-search');
  try {
    const all = await PlaneAPI._fetchAllIssues();
    const parent = all.find(i => i.id === parentId);
    if (parent) {
      const keyPrefix = parent._projectIdentifier ? parent._projectIdentifier + '-' : '';
      const seqStr = keyPrefix + (parent.sequence_id || '');
      input.value = (seqStr ? seqStr + ' — ' : '') + (parent.name || '');
    } else {
      input.value = parentId;
    }
  } catch {
    input.value = parentId;
  }
}

async function submitDirectToPlane() {
  const title = document.getElementById('dt-title').value.trim();
  if (!title) {
    showToast('Title is required', 'error');
    document.getElementById('dt-title').focus();
    return;
  }

  const btn = document.getElementById('dt-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const payload = {
    name: title,
    priority: document.getElementById('dt-priority').value || undefined
  };

  const desc = dtQuill ? dtQuill.innerHTML : '';
  if (desc) payload.description_html = desc;

  const stateVal = document.getElementById('dt-state').value;
  if (stateVal) payload.state = stateVal;

  const assignees = dtAssignees ? dtAssignees.getValue() : [];
  if (assignees.length > 0) payload.assignees = assignees;

  const labels = dtLabels ? dtLabels.getValue() : [];
  if (labels.length > 0) payload.labels = labels;

  const parentVal = document.getElementById('dt-parent').value;
  if (parentVal) payload.parent = parentVal;

  const startDate = document.getElementById('dt-start-date').value;
  if (startDate) payload.start_date = startDate;

  const targetDate = document.getElementById('dt-target-date').value;
  if (targetDate) payload.target_date = targetDate;

  const estSelect = document.getElementById('dt-estimate');
  const estInput = document.getElementById('dt-estimate-points');
  let estimate;
  if (estInput && estInput.style.display !== 'none') {
    estimate = estInput.value;
  } else if (estSelect && estSelect.style.display !== 'none') {
    estimate = estSelect.value;
  }
  if (estimate) payload.estimate_point = estimate;

  const cycleVal = document.getElementById('dt-cycle').value;
  if (cycleVal) payload.sprint = cycleVal;
  const modules = dtModules ? dtModules.getValue() : [];

  try {
    if (editingIssueId) {
      const result = await PlaneAPI.updateIssue(editingIssueId, payload);
      let log = [result.sequence_id || result.id || editingIssueId];
      const warnings = [];

      if (cycleVal) {
        const ok = await PlaneAPI.assignCycle(editingIssueId, cycleVal);
        if (ok) log.push('cycle');
        else warnings.push('cycle');
      }

      for (const modId of modules) {
        const ok = await PlaneAPI.assignModule(editingIssueId, modId);
        if (ok) log.push('module:' + modId.slice(0, 8));
        else warnings.push('module:' + modId.slice(0, 8));
      }

      showToast(`Updated: ${log.join(' | ')}` + (warnings.length ? ` — ${warnings.join(', ')} failed` : ''), warnings.length ? 'warning' : 'success');
      editingIssueId = null;
      resetDirectForm();
      refreshTree();
    } else {
      const result = await PlaneAPI.createIssue(payload);
      const issueId = result.id;
      let log = [result.sequence_id || result.id || 'Unknown'];
      const warnings = [];

      if (cycleVal) {
        const ok = await PlaneAPI.assignCycle(issueId, cycleVal);
        if (ok) log.push('cycle');
        else warnings.push('cycle');
      }

      for (const modId of modules) {
        const ok = await PlaneAPI.assignModule(issueId, modId);
        if (ok) log.push('module:' + modId.slice(0, 8));
        else warnings.push('module:' + modId.slice(0, 8));
      }

      showToast(`Created: ${log.join(' | ')}` + (warnings.length ? ` — ${warnings.join(', ')} failed` : ''), warnings.length ? 'warning' : 'success');
      resetDirectForm();
      refreshTree();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editingIssueId ? 'Update Issue' : 'Submit to Plane';
  }
}

function resetDirectForm() {
  editingIssueId = null;
  document.getElementById('dt-title').value = '';
  if (dtQuill) dtQuill.innerHTML = '';
  document.getElementById('dt-state').value = '';
  document.getElementById('dt-priority').value = '';
  document.getElementById('dt-cycle').value = '';
  if (dtAssignees) dtAssignees.clear();
  if (dtLabels) dtLabels.clear();
  if (dtModules) dtModules.clear();
  document.getElementById('dt-parent').value = '';
  document.getElementById('dt-parent-search').value = '';
  document.getElementById('dt-start-date').value = '';
  document.getElementById('dt-target-date').value = '';
  const estEl = document.getElementById('dt-estimate');
  if (estEl) estEl.value = '';
  const estInput = document.getElementById('dt-estimate-points');
  if (estInput) estInput.value = '';
  document.querySelectorAll('.editing-row').forEach(el => el.classList.remove('editing-row'));
  const cancelBtn = document.getElementById('dt-cancel-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  const submitBtn = document.getElementById('dt-submit-btn');
  if (submitBtn) submitBtn.textContent = '\u{1F4E4} Submit to Plane';
}

async function generateWithAI() {
  const prd = document.getElementById('ct-prd').value.trim();
  const guidance = document.getElementById('ct-ai-guidance').value.trim();
  const tplId = document.getElementById('ct-ai-template').value;
  const statusEl = document.getElementById('ct-ai-status');
  const statusText = document.getElementById('ct-ai-status-text');
  const genBtn = document.getElementById('ct-ai-generate-btn');

  if (prd.length < 50) {
    showToast('PRD minimal 50 karakter.', 'error');
    return;
  }

  const templates = await Storage.getTemplates();
  const template = (templates || []).find(t => t.id === tplId);

  genBtn.disabled = true;
  genBtn.textContent = 'Generating...';
  statusEl.style.display = 'block';
  statusText.textContent = 'AI is breaking down your requirement...';

  try {
    const tasks = await AIProvider.breakDownPRD(prd, template, guidance);

    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('AI returned empty result.');
    }

    const batch = await Storage.getActiveBatch() || {
      batch_id: 'batch_' + Date.now(),
      source_prd: prd.slice(0, 500),
      tasks: []
    };

    let aiTaskCounter = 0;
    tasks.forEach((t) => {
      const fullTitle = `[${t.bracket || 'TASK'}] [${t.severity || 'P3'}][${t.priority || 'Medium'}] ${t.title || 'Untitled'}`;
      batch.tasks.push({
        id: 'task_ai_' + Date.now() + '_' + (aiTaskCounter++) + '_' + Math.random().toString(36).slice(2, 6),
        parent_id: null,
        bracket: t.bracket || '',
        severity: t.severity || 'P3',
        priority: t.priority || 'Medium',
        title: t.title || '',
        full_title: fullTitle,
        is_selected: true,
        payload: {
          story: t.story || '',
          acceptance_criteria: t.acceptance_criteria || [],
          dod: t.dod || []
        },
        sync_status: 'draft'
      });
    });

    await Storage.saveActiveBatch(batch);

    statusText.textContent = `${tasks.length} tasks generated successfully!`;
    setTimeout(() => { statusEl.style.display = 'none'; }, 2000);

    showToast(`${tasks.length} tasks generated by AI!`, 'success');
    document.getElementById('ct-prd').value = '';
    document.getElementById('ct-ai-guidance').value = '';
    switchMode('batch');
    await loadBatch();
  } catch (err) {
    statusText.textContent = `Error: ${err.message}`;
    showToast(`AI generation failed: ${err.message}`, 'error');
  } finally {
    genBtn.disabled = false;
    genBtn.textContent = '\u26A1 Generate with AI';
  }
}

// ===== AI REFINE =====

function showBatchRefineBar() {
  document.getElementById('batch-refine-bar').style.display = 'flex';
  document.getElementById('batch-refine-input').value = '';
  document.getElementById('batch-refine-input').focus();
}

function hideBatchRefineBar() {
  document.getElementById('batch-refine-bar').style.display = 'none';
}

async function applyBatchRefine() {
  const instruction = document.getElementById('batch-refine-input').value.trim();
  if (!instruction) { showToast('Masukkan instruksi refine.', 'error'); return; }

  const batch = await Storage.getActiveBatch();
  if (!batch?.tasks?.length) return;

  const selected = batch.tasks.filter(t => t.is_selected);
  if (selected.length === 0) { showToast('Pilih task yang ingin di-refine.', 'error'); return; }

  const refineBtn = document.getElementById('batch-refine-apply');
  refineBtn.disabled = true;
  refineBtn.textContent = 'Refining...';

  try {
    const results = await AIProvider.refineBulk(selected, instruction);
    if (Array.isArray(results)) {
      results.forEach((r, i) => {
        if (i < selected.length) {
          if (r.story) selected[i].payload.story = r.story;
          if (r.acceptance_criteria) selected[i].payload.acceptance_criteria = r.acceptance_criteria;
          if (r.dod) selected[i].payload.dod = r.dod;
          if (r.title) selected[i].title = r.title;
        }
      });
      await Storage.saveActiveBatch(batch);
      showToast(`${results.length} tasks refined!`, 'success');
      hideBatchRefineBar();
      await loadBatch();
    } else {
      showToast('AI returned invalid format.', 'error');
    }
  } catch (err) {
    showToast(`Refine failed: ${err.message}`, 'error');
  } finally {
    refineBtn.disabled = false;
    refineBtn.textContent = 'Apply';
  }
}

// ===== PARENT TASK DROPDOWN =====

async function populateParentDropdown() {
  const batch = await Storage.getActiveBatch();
  const tasks = batch?.tasks || [];
  const select = document.getElementById('ct-parent');
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">— No parent (top-level) —</option>';

  const parents = tasks.filter(t => !t.parent_id);
  parents.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.full_title || t.title;
    select.appendChild(opt);
  });

  const group = document.getElementById('ct-parent-group');
  if (group) group.style.display = parents.length > 0 ? 'block' : 'none';

  select.value = currentValue;
}

// ===== SAVE DRAFT =====

async function saveDraft() {
  const data = collectFormData();
  if (!data) return;
  await generateFromManualForm(data, 'draft');
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
    let tasks = await PlaneAPI.searchIssues(keyword);
    await Promise.all([loadStateCache(), loadMemberCache()]);

    let parentIds = new Set(tasks.map(t => t.id).filter(Boolean));
    if (parentIds.size > 0) {
      const all = await PlaneAPI._fetchAllIssues();
      const existingIds = new Set(tasks.map(t => t.id));
      const parentToChildren = {};
      all.forEach(i => {
        const pid = (i.parent && typeof i.parent === 'object' ? (i.parent.id || i.parent) : (i.parent || ''));
        if (pid) {
          if (!parentToChildren[pid]) parentToChildren[pid] = [];
          parentToChildren[pid].push(i);
        }
      });
      let queue = Array.from(parentIds);
      while (queue.length > 0) {
        const currentId = queue.shift();
        const children = parentToChildren[currentId] || [];
        children.forEach(child => {
          if (existingIds.has(child.id)) return;
          tasks.push(child);
          existingIds.add(child.id);
          if (parentToChildren[child.id]) {
            queue.push(child.id);
          }
        });
      }
    }

    const childrenMap = {};
    tasks.forEach((t) => {
      const pid = (t.parent && typeof t.parent === 'object' ? (t.parent.id || t.parent) : (t.parent || ''));
      if (pid) {
        if (!childrenMap[pid]) childrenMap[pid] = [];
        childrenMap[pid].push(t);
      }
    });

    renderSearchResults(tasks, childrenMap);
  } catch (err) {
    resultsEl.innerHTML = `<p class="empty-state__text">${escapeHtml(err.message)}</p>`;
  }
}

function renderSearchResults(tasks, childrenMap) {
  const resultsEl = document.getElementById('search-results');

  if (!tasks || tasks.length === 0) {
    resultsEl.innerHTML = '<p class="empty-state__text">No tasks found.</p>';
    return;
  }

  resultsEl.innerHTML = '';
  tasks.forEach((task) => {
    const children = childrenMap ? childrenMap[task.id] : null;
    const hasChildren = children && children.length > 0;

    const item = document.createElement('div');
    item.className = hasChildren ? 'search-result-item search-result-item--parent' : 'search-result-item';
    item.dataset.id = task.id;
    const priorityLower = (task.priority || '').toLowerCase();
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        ${hasChildren ? '<span class="accordion-toggle">▶</span>' : ''}
        <strong style="flex:1;font-size:13px">${escapeHtml(task.name)}</strong>
        ${task.sequence_id ? `<span style="font-size:11px;color:#94a3b8">${escapeHtml(task.sequence_id)}</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;margin-top:4px;align-items:center">
        <span class="priority-badge priority-badge--${priorityLower}">${task.priority || '—'}</span>
        <span class="status-badge" style="background:${getStateColor(task)};color:${textColorForBg(getStateColor(task))}">${escapeHtml(getStateName(task))}</span>
        ${task.project ? `<span style="font-size:11px;color:#94a3b8">${escapeHtml(task.project)}</span>` : ''}
      </div>
      ${hasChildren ? `<div class="accordion-children" style="display:none;margin-top:8px;padding-left:24px">
        <table class="child-table">
          <thead>
            <tr>
              <th class="child-indent"></th>
              <th>Status</th>
              <th class="child-th--title">Title</th>
              <th>Priority</th>
            </tr>
          </thead>
          <tbody>
            ${children.map((c) => `
              <tr>
                <td class="child-indent">└─</td>
                <td><span class="status-badge" style="background:${getStateColor(c)};color:${textColorForBg(getStateColor(c))}">${escapeHtml(getStateName(c))}</span></td>
                <td class="task-table__title">${escapeHtml(c.name)}</td>
                <td><span class="priority-badge priority-badge--${(c.priority || 'medium').toLowerCase()}">${c.priority || '—'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>` : ''}
    `;

    if (hasChildren) {
      const toggle = item.querySelector('.accordion-toggle');
      const childrenEl = item.querySelector('.accordion-children');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = childrenEl.style.display !== 'none';
        childrenEl.style.display = isOpen ? 'none' : 'block';
        toggle.textContent = isOpen ? '▶' : '▼';
      });
    }

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

  const importBtn = document.getElementById('fetch-import-btn');
  importBtn.disabled = true;
  importBtn.textContent = 'Importing...';

  const includeChild = document.getElementById('include-child-tasks').checked;
  let taskData = selectedTaskForImport;
  let children = [];

  if (includeChild) {
    try {
      children = await PlaneAPI.getChildIssues(taskData.id);
    } catch {
      children = [];
    }
  }

  const batch = await Storage.getActiveBatch() || { batch_id: 'batch_' + Date.now(), source_prd: '', tasks: [] };

  const parentId = 'task_import_' + Date.now();
  batch.tasks.push({
    id: parentId,
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

  let childCount = 0;
  (children || []).forEach((child) => {
    batch.tasks.push({
      id: 'task_import_child_' + Date.now() + '_' + childCount,
      parent_id: parentId,
      bracket: '',
      severity: 'P2',
      priority: 'Medium',
      title: child.name,
      full_title: child.name,
      is_selected: true,
      payload: { story: child.description_html || '' },
      sync_status: 'imported'
    });
    childCount++;
  });

  await Storage.saveActiveBatch(batch);

  const totalImported = 1 + childCount;
  showToast(`Imported ${totalImported} task${totalImported > 1 ? 's' : ''} to workspace.`, 'success');
  importBtn.textContent = 'Import to Workspace';
  closeFetchModal();
  switchMode('batch');
  await loadBatch();
}

// ===== STATE LOOKUP =====

function hexBrightness(hex) {
  const c = hex.replace('#','');
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  return (r*299 + g*587 + b*114) / 1000;
}

function textColorForBg(hex) {
  return hexBrightness(hex) > 160 ? '#1e293b' : '#ffffff';
}

async function loadStateCache() {
  try {
    const states = await PlaneAPI.getStates();
    stateCache = {};
    states.forEach((s) => {
      stateCache[s.id] = {
        name: s.name || s.title || '—',
        color: s.color || '#e2e8f0',
        group: s.group || ''
      };
    });
  } catch {
    stateCache = {};
  }
}

async function loadMemberCache() {
  try {
    const members = await PlaneAPI.getMembers();
    memberCache = {};
    members.forEach((m) => {
      const user = m.member || m;
      const id = user.id || m.id;
      if (id) memberCache[id] = user.display_name || user.email || user.name || '—';
    });
  } catch {
    memberCache = {};
  }
}

function getStateName(task) {
  const state = task.state;
  if (!state) return '—';

  if (typeof state === 'object' && state.name) return state.name;

  const detail = task.state_detail;
  if (detail && detail.name) return detail.name;

  if (typeof state === 'string' && stateCache[state]) {
    const cached = stateCache[state];
    return typeof cached === 'object' ? cached.name : cached;
  }

  if (typeof state === 'string') return '—';

  return '—';
}

function getStateColor(task) {
  const state = task.state;
  if (!state) return '#e2e8f0';

  if (typeof state === 'object' && state.color) return state.color;

  const detail = task.state_detail;
  if (detail && detail.color) return detail.color;

  if (typeof state === 'string' && stateCache[state]) {
    const cached = stateCache[state];
    if (typeof cached === 'object' && cached.color) return cached.color;
    return '#e2e8f0';
  }

  return '#e2e8f0';
}

// ===== DASHBOARD SEARCH =====

function buildTaskTree(tasks) {
  const map = {};
  const roots = [];
  tasks.forEach(t => {
    map[t.id] = { ...t, _children: [] };
  });
  tasks.forEach(t => {
    const parentId = (t.parent && typeof t.parent === 'object' ? (t.parent.id || t.parent) : (t.parent || ''));
    if (parentId && map[parentId]) {
      map[parentId]._children.push(map[t.id]);
    } else {
      roots.push(map[t.id]);
    }
  });
  return roots;
}

function renderTreeItem(node, depth, container, renderRow) {
  const hasChildren = node._children.length > 0;
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-item';
  wrapper.style.marginLeft = (depth * 20) + 'px';

  if (hasChildren) {
    const details = document.createElement('details');
    details.className = 'tree-details';
    details.dataset.taskId = node.id;

    const summary = document.createElement('summary');
    summary.className = 'tree-summary';
    renderRow(node, summary, depth, true);
    details.appendChild(summary);

    node._children.forEach(child => {
      renderTreeItem(child, depth + 1, details, renderRow);
    });

    wrapper.appendChild(details);
  } else {
    renderRow(node, wrapper, depth, false);
  }

  container.appendChild(wrapper);
}

async function performSearch() {
  const keyword = document.getElementById('search-input').value.trim();
  if (!keyword) return;

  const searchInfo = document.getElementById('search-info');
  const spinner = document.getElementById('search-spinner');
  const infoText = document.getElementById('search-info-text');
  const tableWrapper = document.getElementById('task-table-wrapper');
  const emptyState = document.getElementById('empty-state');

  searchInfo.style.display = 'flex';
  spinner.style.display = 'block';
  infoText.textContent = 'Searching...';
  tableWrapper.style.display = 'none';
  emptyState.style.display = 'none';

  try {
    let tasks = await PlaneAPI.searchIssues(keyword);
    await Promise.all([loadStateCache(), loadMemberCache()]);

    spinner.style.display = 'none';
    searchInfo.style.display = 'none';

    if (tasks.length === 0) {
      searchInfo.style.display = 'flex';
      spinner.style.display = 'none';
      infoText.textContent = `No tasks found for "${keyword}".`;
      return;
    }

    let parentIds = new Set(tasks.map(t => t.id).filter(Boolean));
    if (parentIds.size > 0) {
      const all = await PlaneAPI._fetchAllIssues();
      const existingIds = new Set(tasks.map(t => t.id));
      const parentToChildren = {};
      all.forEach(i => {
        const pid = (i.parent && typeof i.parent === 'object' ? (i.parent.id || i.parent) : (i.parent || ''));
        if (pid) {
          if (!parentToChildren[pid]) parentToChildren[pid] = [];
          parentToChildren[pid].push(i);
        }
      });
      let queue = Array.from(parentIds);
      while (queue.length > 0) {
        const currentId = queue.shift();
        const children = parentToChildren[currentId] || [];
        children.forEach(child => {
          if (existingIds.has(child.id)) return;
          tasks.push(child);
          existingIds.add(child.id);
          if (parentToChildren[child.id]) {
            queue.push(child.id);
          }
        });
      }
    }

    renderTaskTree(tasks);
  } catch (err) {
    spinner.style.display = 'none';
    infoText.textContent = `Error: ${err.message}`;
    showToast(err.message, 'error');
  }
}

function getAssigneeName(assignees) {
  if (!assignees || !Array.isArray(assignees) || assignees.length === 0) return '—';

  return assignees.map((a) => {
    if (typeof a === 'object' && a) {
      return a.display_name || a.email || a.name || '—';
    }
    if (typeof a === 'string' && memberCache[a]) return memberCache[a];
    return '—';
  }).join(', ');
}

function renderTaskTree(tasks) {
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
  tbody.style.display = 'table-row-group';

  const roots = buildTaskTree(tasks);

  function flattenTree(nodes, depth, result) {
    nodes.forEach(n => {
      result.push({ node: n, depth, hasChildren: n._children.length > 0 });
      if (n._children.length > 0) {
        flattenTree(n._children, depth + 1, result);
      }
    });
    return result;
  }

  const flatRows = flattenTree(roots, 0, []);

  flatRows.forEach((item, idx) => {
    const { node, depth, hasChildren } = item;
    const tr = document.createElement('tr');
    tr.className = 'task-tree-row';
    tr.dataset.depth = depth;
    tr.dataset.parentIdx = idx;
    tr.dataset.id = node.id;
    if (depth > 0) tr.classList.add('task-tree-row--hidden');

    if (depth > 0) {
      let parentIdx = idx - 1;
      while (parentIdx >= 0 && flatRows[parentIdx].depth >= depth) parentIdx--;
      if (parentIdx >= 0) tr.dataset.parentIdx = parentIdx + '';
    }

    const titleStyle = depth > 0 ? `padding-left:${depth * 24 + 4}px` : '';

    const sc = getStateColor(node);
    tr.innerHTML = `
      <td class="td-status">
        ${hasChildren ? '<span class="tree-toggle" data-idx="' + idx + '">▶</span>' : '<span class="tree-toggle tree-toggle--spacer"></span>'}
        <span class="status-badge" style="background:${sc};color:${textColorForBg(sc)}">${escapeHtml(getStateName(node))}</span>
      </td>
      <td class="task-table__title" style="${titleStyle}">${escapeHtml(node.name)}</td>
      <td><span class="priority-badge priority-badge--${node.priority || 'medium'}">${node.priority || '—'}</span></td>
      <td>${escapeHtml(getAssigneeName(node.assignees))}</td>
    `;

    tr.addEventListener('click', () => {
      if (editingIssueId === node.id) return;
      editingIssueId = node.id;
      populateDirectForm(node);
      document.querySelectorAll('.editing-row').forEach(el => el.classList.remove('editing-row'));
      tr.classList.add('editing-row');
      document.getElementById('dt-submit-btn').textContent = '\u270F Update Issue';
      const cancelBtn = document.getElementById('dt-cancel-btn');
      if (cancelBtn) cancelBtn.style.display = 'inline-block';
      tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.tree-toggle[data-idx]').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(toggle.dataset.idx);
      const isOpen = toggle.textContent === '▼';
      toggle.textContent = isOpen ? '▶' : '▼';

      const myDepth = flatRows[idx].depth;
      let i = idx + 1;
      while (i < flatRows.length && flatRows[i].depth > myDepth) {
        tbody.children[i].classList.toggle('task-tree-row--hidden', isOpen);
        i++;
      }
    });
  });
}

// ===== MODE SWITCHING =====

function switchMode(mode) {
  document.querySelectorAll('.toolbar__tab').forEach((tab) => {
    tab.classList.toggle('toolbar__tab--active', tab.dataset.mode === mode);
  });

  document.querySelector('.toolbar__controls--search').style.display = mode === 'search' ? 'flex' : 'none';
  document.querySelector('.toolbar__controls--batch').style.display = mode === 'batch' ? 'flex' : 'none';
  document.querySelector('.footer__actions--search').style.display = mode === 'search' ? 'flex' : 'none';
  document.querySelector('.footer__actions--batch').style.display = mode === 'batch' ? 'flex' : 'none';

  document.getElementById('search-view').style.display = mode === 'search' ? 'block' : 'none';
  document.getElementById('batch-view').style.display = mode === 'batch' ? 'block' : 'none';
}

// ===== BATCH WORKSPACE =====

async function loadBatch() {
  const batch = await Storage.getActiveBatch();
  const tasks = batch?.tasks || [];
  const fo = batch?.fieldOrder;
  if (fo) {
    tasks.forEach((t) => { if (!t._fieldOrder) t._fieldOrder = fo; });
  }
  renderBatchTasks(tasks, fo);
  await populateParentDropdown();
}

function renderTaskCard(task, fieldOrder) {
  const syncClass = `sync-badge--${task.sync_status || 'draft'}`;
  const priorityLower = (task.priority || '').toLowerCase();
  const isChild = !!task.parent_id;

  return `
    <div class="task-card ${task.is_selected ? 'task-card--selected' : ''} ${isChild ? 'task-card--child' : ''}" data-task-id="${escapeHtml(task.id)}">
      <div class="task-card__header">
        <input class="task-card__checkbox" type="checkbox" ${task.is_selected ? 'checked' : ''}>
        <div class="task-card__info">
          <div class="task-card__title">${escapeHtml(task.full_title || task.title)}</div>
          <div class="task-card__meta">
            <span class="priority-badge priority-badge--${priorityLower}">${task.priority || '—'}</span>
            <span class="sync-badge ${syncClass}">${task.sync_status || 'draft'}</span>
          </div>
        </div>
        <div class="task-card__actions">
          ${!isChild ? `<button class="task-card__add-child" title="Add Child">+ Child</button>` : ''}
          <button class="task-card__expand" title="Details">&#8250;</button>
        </div>
      </div>
      <div class="task-card__body">
        ${(() => {
          const payload = task.payload || {};
          const order = fieldOrder || task._fieldOrder;
          let entries = Object.entries(payload).filter(([k]) => !['story', 'acceptance_criteria', 'dod'].includes(k) && k !== '0');
          if (order && order.length > 0) {
            const orderMap = {};
            order.forEach((k, i) => { orderMap[k] = i; });
            entries.sort((a, b) => (orderMap[a[0]] ?? 999) - (orderMap[b[0]] ?? 999));
          }
          if (entries.length === 0) return '';
          return `<div class="task-card__section">
            <div class="task-card__section-title">Task Fields</div>
            <div class="task-card__field-values">${entries.map(([k, v]) =>
              `<div class="task-card__field-row"><span class="task-card__field-key">${escapeHtml(k)}</span><span class="task-card__field-value">${escapeHtml(Array.isArray(v) ? v.join(', ') : String(v))}</span></div>`
            ).join('')}</div>
          </div>`;
        })()}
        <div class="task-card__refine">
          <input class="task-card__refine-input" type="text" placeholder="AI refine instruction for this task...">
          <button class="btn btn--primary btn--sm task-card__refine-btn">Refine</button>
        </div>
      </div>
    </div>`;
}

function renderBatchTasks(tasks, fieldOrder) {
  const list = document.getElementById('batch-task-list');
  const emptyState = document.getElementById('empty-state');
  const count = tasks.length;

  document.getElementById('batch-count').textContent = `${count} task${count !== 1 ? 's' : ''}`;

  if (count === 0) {
    list.innerHTML = '<div class="task-card__empty">No tasks in batch. Create or import tasks to get started.</div>';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  const parents = tasks.filter(t => !t.parent_id);
  const children = tasks.filter(t => t.parent_id);

  let html = '';
  parents.forEach((parent, pi) => {
    html += renderTaskCard(parent, fieldOrder);

    const childList = children.filter(c => c.parent_id === parent.id);
    if (childList.length > 0) {
      childList.forEach((child) => {
        html += renderTaskCard(child, fieldOrder);
      });
    }
  });

  const orphans = children.filter(c => !parents.some(p => p.id === c.parent_id));
  orphans.forEach((child) => {
    html += renderTaskCard(child, fieldOrder);
  });

  list.innerHTML = html;
  bindBatchEvents(tasks);
  updateSelectAllState(tasks);
}

function findTaskById(tasks, id) {
  return tasks.find(t => t.id === id);
}

function bindBatchEvents(tasks) {
  document.querySelectorAll('.task-card__checkbox').forEach((cb) => {
    cb.addEventListener('change', () => {
      const card = cb.closest('.task-card');
      const task = findTaskById(tasks, card.dataset.taskId);
      if (!task) return;
      task.is_selected = cb.checked;
      card.classList.toggle('task-card--selected', cb.checked);
      saveBatchTasks(tasks);
      updateSelectAllState(tasks);
    });
  });

  document.querySelectorAll('.task-card__expand').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const body = btn.closest('.task-card').querySelector('.task-card__body');
      const isOpen = body.classList.toggle('task-card__body--open');
      btn.classList.toggle('task-card__expand--open', isOpen);
    });
  });

  document.querySelectorAll('.task-card__header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox' || e.target.classList.contains('task-card__add-child')) return;
      const btn = header.querySelector('.task-card__expand');
      if (btn) btn.click();
    });
  });

  document.querySelectorAll('.task-card__add-child').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.task-card');
      const parentId = card.dataset.taskId;
      const task = findTaskById(tasks, parentId);
      if (!task) return;
      switchCTMode('manual');
      document.getElementById('ct-parent').value = parentId;
      showToast(`Adding child task under "${task.title}"`, 'info');
    });
  });

  document.querySelectorAll('.task-card__refine-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('.task-card');
      const task = findTaskById(tasks, card.dataset.taskId);
      if (!task) return;
      const input = card.querySelector('.task-card__refine-input');
      const instruction = input.value.trim();
      if (!instruction) { showToast('Masukkan instruksi refine.', 'error'); return; }

      btn.disabled = true;
      btn.textContent = '...';
      try {
        const result = await AIProvider.refine(task, instruction);
        if (result.story) task.payload.story = result.story;
        if (result.acceptance_criteria) task.payload.acceptance_criteria = result.acceptance_criteria;
        if (result.dod) task.payload.dod = result.dod;
        if (result.title) task.title = result.title;
        await saveBatchTasks(tasks);
        showToast('Task refined!', 'success');
        input.value = '';
        await loadBatch();
      } catch (err) {
        showToast(`Refine failed: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Refine';
      }
    });
  });

  const selectAll = document.getElementById('batch-select-all');
  selectAll.checked = false;
  selectAll.indeterminate = false;
  selectAll.onchange = null;
  selectAll.addEventListener('change', (e) => {
    const checked = e.target.checked;
    tasks.forEach((t) => { t.is_selected = checked; });
    document.querySelectorAll('.task-card__checkbox').forEach((cb) => { cb.checked = checked; });
    document.querySelectorAll('.task-card').forEach((card) => {
      card.classList.toggle('task-card--selected', checked);
    });
    saveBatchTasks(tasks);
  });
}

function updateSelectAllState(tasks) {
  const selectAll = document.getElementById('batch-select-all');
  const selected = tasks.filter(t => t.is_selected).length;
  selectAll.checked = selected === tasks.length && tasks.length > 0;
  selectAll.indeterminate = selected > 0 && selected < tasks.length;
}

async function saveBatchTasks(tasks) {
  const batch = await Storage.getActiveBatch() || {};
  batch.tasks = tasks;
  await Storage.saveActiveBatch(batch);
}

async function deleteSelectedTasks() {
  const batch = await Storage.getActiveBatch();
  if (!batch?.tasks?.length) return;

  const selected = batch.tasks.filter(t => t.is_selected);
  if (selected.length === 0) { showToast('No tasks selected.', 'error'); return; }

  const confirmed = confirm(`Hapus ${selected.length} task terpilih dari batch?`);
  if (!confirmed) return;

  batch.tasks = batch.tasks.filter(t => !t.is_selected);
  await Storage.saveActiveBatch(batch);
  showToast(`${selected.length} task dihapus.`, 'success');
  await loadBatch();
}

async function clearBatch() {
  const confirmed = confirm('Hapus semua task dari batch?');
  if (!confirmed) return;

  await Storage.clearActiveBatch();
  showToast('Batch dibersihkan.', 'success');
  await loadBatch();
}

async function submitSelectedTasks() {
  const batch = await Storage.getActiveBatch();
  if (!batch?.tasks?.length) return;

  const selected = batch.tasks.filter(t => t.is_selected);
  if (selected.length === 0) { showToast('No tasks selected.', 'error'); return; }

  const confirmed = confirm(`Submit ${selected.length} task terpilih ke Plane?\n\nParent tasks will be created first, then children linked.`);
  if (!confirmed) return;

  const submitBtn = document.getElementById('batch-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const parents = selected.filter(t => !t.parent_id);
    const children = selected.filter(t => t.parent_id);

    const hasChildren = children.length > 0;

    if (hasChildren) {
      const taskGroups = parents.map((parent) => ({
        parent,
        children: children.filter(c => c.parent_id === parent.id)
      }));

      const orphans = children.filter(c => !parents.some(p => p.id === c.parent_id));

      const results = await PlaneAPI.createHierarchicalBatch(taskGroups);
      let totalCreated = results.reduce((sum, g) => sum + 1 + g.children.filter(r => r.status === 'created').length, 0);

      if (orphans.length > 0) {
        const orphanPayloads = orphans.map((task) => ({
          name: task.full_title || task.title,
          description_html: PlaneAPI._buildDescriptionHtml(task),
          priority: PRIORITY_MAP[task.priority] || 'medium'
        }));
        const orphanResults = await PlaneAPI.createIssuesBulk(orphanPayloads);
        const orphanCreated = orphanResults.filter(r => r.status === 'created').length;
        totalCreated += orphanCreated;
        showToast(`${totalCreated} tasks created (${orphanCreated} orphans as flat).`, 'success');
      } else {
        showToast(`${totalCreated} tasks berhasil dibuat di Plane (hierarchical)!`, 'success');
      }
    } else {
      const payloads = selected.map((task) => ({
        name: task.full_title || task.title,
        description_html: PlaneAPI._buildDescriptionHtml(task),
        priority: PRIORITY_MAP[task.priority] || 'medium'
      }));

      const results = await PlaneAPI.createIssuesBulk(payloads);
      const created = results.filter(r => r.status === 'created').length;
      const failed = results.filter(r => r.status === 'failed').length;

      if (failed > 0) {
        showToast(`${created} created, ${failed} failed.`, 'error');
      } else {
        showToast(`${created} tasks berhasil dibuat di Plane!`, 'success');
      }
    }

    batch.tasks = batch.tasks.filter(t => !t.is_selected);
    await Storage.saveActiveBatch(batch);
    await loadBatch();
  } catch (err) {
    showToast(`Gagal submit batch: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Selected';
  }
}

// ===== HELPERS =====

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== BIND EVENTS =====

function initManualEditors() {
  const insertTable = (cols, rows) => {
    if (cols < 1 || rows < 1) return;
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += '<td><br></td>';
      html += '</tr>';
    }
    html += '</tbody></table><br>';
    return html;
  };

  const initEditor = (toolbarId, editorId) => {
    const toolbar = document.getElementById(toolbarId);
    const editor = document.getElementById(editorId);
    if (!toolbar || !editor) return;

    toolbar.querySelectorAll('button[data-cmd]').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        const arg = btn.dataset.arg;

        if (cmd === 'createLink') {
          const url = prompt('Enter URL:');
          if (url) document.execCommand('createLink', false, url);
        } else if (cmd === 'formatBlock' && arg) {
          document.execCommand('formatBlock', false, arg);
        } else if (cmd === 'insertHTML' && arg) {
          document.execCommand('insertHTML', false, arg);
        } else if (cmd === 'insertTable') {
          const cols = parseInt(prompt('Columns:', '3'), 10) || 3;
          const rows = parseInt(prompt('Rows:', '3'), 10) || 3;
          const tableHtml = insertTable(cols, rows);
          if (tableHtml) document.execCommand('insertHTML', false, tableHtml);
        } else {
          document.execCommand(cmd, false, null);
        }
        editor.focus();
      });
    });
  };

  initEditor('ct-story-toolbar', 'ct-story-editor');
  initEditor('ct-ac-toolbar', 'ct-ac-editor');
  initEditor('ct-dod-toolbar', 'ct-dod-editor');
}

function bindEvents() {
  document.getElementById('fetch-external-btn').addEventListener('click', openFetchModal);
  document.getElementById('fetch-modal-close').addEventListener('click', closeFetchModal);
  document.getElementById('fetch-search-btn').addEventListener('click', searchTasks);
  document.getElementById('fetch-keyword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchTasks();
  });
  document.getElementById('fetch-import-btn').addEventListener('click', importToWorkspace);

  document.getElementById('search-btn').addEventListener('click', performSearch);
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  document.getElementById('refresh-btn').addEventListener('click', () => {
    PlaneAPI.invalidateIssueCache();
    loadWorkspaceSwitcher();
    refreshTree();
  });

  document.getElementById('workspace-switcher').addEventListener('change', (e) => {
    switchWorkspace(e.target.value);
  });

  document.getElementById('manage-workspaces-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('manage-templates-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'templates/templates.html' });
  });

  document.getElementById('fetch-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeFetchModal();
  });

  document.querySelectorAll('.toolbar__tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      switchMode(tab.dataset.mode);
    });
  });

  document.getElementById('batch-submit-btn').addEventListener('click', submitSelectedTasks);
  document.getElementById('batch-delete-btn').addEventListener('click', deleteSelectedTasks);
  document.getElementById('batch-clear-btn').addEventListener('click', clearBatch);

  const templateSelect = document.getElementById('ct-template');
  if (templateSelect) templateSelect.addEventListener('change', onTemplateChange);
  const titleEl = document.getElementById('ct-title');

  initManualEditors();
  const previewBtn = document.getElementById('ct-preview-btn');
  if (previewBtn) previewBtn.addEventListener('click', submitTask);
  const saveDraftBtn = document.getElementById('ct-save-draft');
  if (saveDraftBtn) saveDraftBtn.addEventListener('click', saveDraft);

  document.querySelectorAll('[data-ct-mode]').forEach((tab) => {
    tab.addEventListener('click', () => {
      switchCTMode(tab.dataset.ctMode);
    });
  });

  const aiBtn = document.getElementById('ct-ai-generate-btn');
  if (aiBtn) aiBtn.addEventListener('click', generateWithAI);

  document.getElementById('batch-refine-btn').addEventListener('click', showBatchRefineBar);
  document.getElementById('batch-refine-apply').addEventListener('click', applyBatchRefine);
  document.getElementById('batch-refine-cancel').addEventListener('click', hideBatchRefineBar);
  document.getElementById('batch-refine-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyBatchRefine();
  });

  document.getElementById('dt-submit-btn').addEventListener('click', submitDirectToPlane);
  document.getElementById('dt-cancel-btn').addEventListener('click', () => {
    resetDirectForm();
    document.getElementById('dt-submit-btn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
