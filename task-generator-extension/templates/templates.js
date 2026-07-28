let currentTemplates = [];
let editingTemplateId = null;
let importData = null;
let builderSegments = [];
let builderCustomLabels = [];
let builderFields = [];
let builderBracketOptions = [];
let builderCustomBracketDefs = [];
let builderFieldKeys = [];
let fieldMultiSelect = null;
let bracketMultiSelect = null;
let dragSrcSegment = null;
let dragSrcFieldChip = null;

const STANDARD_FIELDS = [
  { key: 'module', label: 'Module', type: 'text', constraint: 'optional', description: 'Nama modul atau fitur utama yang dikerjakan, misalnya Voucher, Dealer, Produk, atau Kasir.' },
  { key: 'epic', label: 'Epic', type: 'text', constraint: 'optional', description: 'Epic atau fitur besar yang menjadi induk dari task.' },
  { key: 'section', label: 'Section', type: 'text', constraint: 'optional', description: 'Bagian atau halaman dari suatu modul, misalnya List, Detail, Form, Dashboard, atau Setting.' },
  { key: 'component', label: 'Component', type: 'text', constraint: 'optional', description: 'Komponen yang dikerjakan seperti API, Table, Modal, Button, Filter, Export, Import, dan sebagainya.' },
  { key: 'story', label: 'Story', type: 'rich_text', constraint: 'optional', description: 'Menjelaskan kebutuhan dari sudut pandang pengguna atau proses bisnis.' },
  { key: 'expected_result', label: 'Expected Result', type: 'rich_text', constraint: 'optional', description: 'Hasil akhir yang diharapkan setelah task selesai.' },
  { key: 'figma_link', label: 'Link Figma', type: 'url', constraint: 'optional', description: 'Link desain UI/UX yang menjadi acuan implementasi.' },
  { key: 'url_document', label: 'URL / Document', type: 'url', constraint: 'optional', description: 'Link PRD, BRD, FSD, Notion, Mintlify, atau dokumen pendukung lainnya.' },
  { key: 'api', label: 'API', type: 'text', constraint: 'optional', description: 'Endpoint API yang digunakan atau akan dibuat.' },
  { key: 'parameter', label: 'Parameter', type: 'text', constraint: 'optional', description: 'Parameter Request berupa Query, Path Variable, Header, maupun Body Request.' },
  { key: 'environment', label: 'Environment', type: 'dropdown', constraint: 'optional', options: ['Development', 'Staging', 'Production'], description: 'Environment implementasi seperti Development, Staging, atau Production.' },
  { key: 'estimasi_time', label: 'Estimasi Time', type: 'text', constraint: 'optional', description: 'Estimasi waktu penyelesaian task sesuai hasil diskusi tim.' },
  { key: 'note', label: 'Note', type: 'rich_text', constraint: 'optional', description: 'Catatan tambahan yang perlu diketahui oleh tim implementasi.' },
  { key: 'acceptance_criteria', label: 'Acceptance Criteria', type: 'rich_text', constraint: 'optional', description: 'Kriteria yang harus dipenuhi agar task dinyatakan sesuai dengan requirement.' },
  { key: 'business_rule', label: 'Business Rule', type: 'rich_text', constraint: 'optional', description: 'Aturan bisnis yang harus diterapkan selama implementasi.' },
  { key: 'priority', label: 'Priority', type: 'dropdown', constraint: 'optional', options: ['Critical', 'High', 'Medium', 'Low'], description: 'Tingkat prioritas task (Critical, High, Medium, Low).' },
  { key: 'severity', label: 'Severity', type: 'dropdown', constraint: 'optional', options: ['P0', 'P1', 'P2', 'P3', '-'], description: 'Dampak teknis: P0 / P1 / P2 / P3.' },
  { key: 'sprint', label: 'Sprint', type: 'text', constraint: 'optional', description: 'Sprint atau milestone tempat task akan dikerjakan.' },
  { key: 'team', label: 'Team', type: 'text', constraint: 'optional', description: 'Tim yang bertanggung jawab mengerjakan task, seperti Backend, Frontend, Mobile, QA, UI/UX, atau Technical Writer.' },
  { key: 'owner', label: 'Owner', type: 'text', constraint: 'optional', description: 'PIC yang bertanggung jawab terhadap penyelesaian task.' },
  { key: 'dependency', label: 'Dependency', type: 'text', constraint: 'optional', description: 'Ketergantungan terhadap task, sistem, atau tim lain sebelum task dapat dikerjakan atau diselesaikan.' }
];
const STANDARD_FIELD_MAP = {};
STANDARD_FIELDS.forEach(f => { STANDARD_FIELD_MAP[f.key] = f; });

document.addEventListener('DOMContentLoaded', async () => {
  await loadTemplates();
  bindListEvents();
  bindBuilderEvents();
  bindImportEvents();
});

// ========== STORAGE ==========

async function loadTemplates() {
  currentTemplates = await Storage.getTemplates() || [];
  renderTemplateGrid();
}

// ========== VIEW SWITCHING ==========

function showListView() {
  document.getElementById('view-list').style.display = '';
  document.getElementById('view-builder').style.display = 'none';
}

function showBuilderView() {
  document.getElementById('view-list').style.display = 'none';
  document.getElementById('view-builder').style.display = '';
}

// ========== VIEW 1: TEMPLATE LIST ==========

function renderTemplateGrid() {
  const grid = document.getElementById('template-grid');
  const emptyState = document.getElementById('empty-state');
  const noResults = document.getElementById('no-results');
  const query = document.getElementById('search-input').value.trim().toLowerCase();

  const filtered = query
    ? currentTemplates.filter((t) => t.name.toLowerCase().includes(query))
    : currentTemplates;

  grid.innerHTML = '';
  emptyState.style.display = 'none';
  noResults.style.display = 'none';

  if (currentTemplates.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  if (filtered.length === 0) {
    noResults.style.display = 'block';
    return;
  }

  filtered.forEach((tpl) => {
    const card = document.createElement('div');
    card.className = 'template-card';

    const segCount = tpl.header?.segments ? tpl.header.segments.length : 0;

    card.innerHTML = `
      <div class="template-card__header">
        <span class="template-card__name">${escapeHtml(tpl.name)}</span>
        <div class="template-card__more">
          <button class="template-card__more-btn" data-id="${tpl.id}" title="More actions">&#8943;</button>
          <div class="template-card__dropdown" id="dropdown-${tpl.id}">
            <button class="template-card__dropdown-item" data-action="duplicate" data-id="${tpl.id}">Duplicate</button>
            <button class="template-card__dropdown-item" data-action="export" data-id="${tpl.id}">Export JSON</button>
            <button class="template-card__dropdown-item template-card__dropdown-item--danger" data-action="delete" data-id="${tpl.id}">Delete</button>
          </div>
        </div>
      </div>
      <div class="template-card__meta">${tpl.fields.length} field${tpl.fields.length !== 1 ? 's' : ''}${segCount > 0 ? ' &middot; ' + segCount + ' title component' + (segCount !== 1 ? 's' : '') : ''}</div>
      <div class="template-card__body">
        <div class="template-card__fields">
          ${tpl.fields.map((f) => {
            let cls = 'template-card__field-tag';
            if (f.constraint === 'mandatory') cls += ' template-card__field-tag--mandatory';
            else if (f.constraint === 'ai_generated') cls += ' template-card__field-tag--ai';
            else cls += ' template-card__field-tag--optional';
            return `<span class="${cls}">${escapeHtml(f.label)}</span>`;
          }).join('')}
        </div>
      </div>
      <div class="template-card__footer">
        <button class="btn btn--secondary btn--sm" data-action="edit" data-id="${tpl.id}">Edit</button>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.template-card__more-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllDropdowns();
      document.getElementById('dropdown-' + btn.dataset.id).classList.toggle('template-card__dropdown--open');
    });
  });

  grid.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => openEditBuilder(btn.dataset.id));
  });
  grid.querySelectorAll('[data-action="duplicate"]').forEach((btn) => {
    btn.addEventListener('click', () => duplicateTemplate(btn.dataset.id));
  });
  grid.querySelectorAll('[data-action="export"]').forEach((btn) => {
    btn.addEventListener('click', () => exportTemplate(btn.dataset.id));
  });
  grid.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTemplate(btn.dataset.id));
  });
}

function closeAllDropdowns() {
  document.querySelectorAll('.template-card__dropdown--open').forEach((d) => {
    d.classList.remove('template-card__dropdown--open');
  });
}

function duplicateTemplate(id) {
  closeAllDropdowns();
  const tpl = currentTemplates.find((t) => t.id === id);
  if (!tpl) return;
  const clone = {
    id: 'tpl_' + slugify(tpl.name) + '_' + Date.now(),
    name: 'Copy of ' + tpl.name,
    category: tpl.category || 'General',
    header: tpl.header ? JSON.parse(JSON.stringify(tpl.header)) : undefined,
    fields: JSON.parse(JSON.stringify(tpl.fields))
  };
  currentTemplates.push(clone);
  Storage.saveTemplates(currentTemplates);
  renderTemplateGrid();
  showToast('Template duplicated.', 'success');
}

function exportTemplate(id) {
  closeAllDropdowns();
  const tpl = currentTemplates.find((t) => t.id === id);
  if (!tpl) return;
  const data = { name: tpl.name, header: tpl.header, fields: tpl.fields };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = slugify(tpl.name) + '_template.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Template exported.', 'success');
}

async function deleteTemplate(id) {
  closeAllDropdowns();
  if (!confirm('Delete this template?')) return;
  currentTemplates = currentTemplates.filter((t) => t.id !== id);
  await Storage.saveTemplates(currentTemplates);
  renderTemplateGrid();
  showToast('Template deleted.', 'info');
}

// ========== VIEW 2: BUILDER ==========

function openCreateBuilder() {
  editingTemplateId = null;
  document.getElementById('builder-title').textContent = 'Create Template';
  document.getElementById('tpl-name').value = '';
  document.getElementById('header-title').value = '';
  builderSegments = [];
  builderCustomLabels = [];
  builderFieldKeys = [];
  builderBracketOptions = [];
  builderCustomBracketDefs = [];
  initBracketMultiSelect();
  initFieldMultiSelect();
  renderCustomLabelTags();
  renderSegments();
  renderFieldChips();
  updatePreview();
  showBuilderView();
}

function openEditBuilder(id) {
  closeAllDropdowns();
  const tpl = currentTemplates.find((t) => t.id === id);
  if (!tpl) return;

  editingTemplateId = id;
  document.getElementById('builder-title').textContent = 'Edit Template';
  document.getElementById('tpl-name').value = tpl.name;
  document.getElementById('header-title').value = '';

  builderSegments = tpl.header?.segments ? [...tpl.header.segments] : [];
  builderCustomLabels = tpl.header?.customLabels ? [...tpl.header.customLabels] : [];
  builderBracketOptions = tpl.header?.bracketOptions ? [...tpl.header.bracketOptions] : [];
  builderCustomBracketDefs = tpl.header?.customBracketDefs ? [...tpl.header.customBracketDefs] : [];
  builderFieldKeys = tpl.fieldKeys || tpl.header?.fieldKeys || [];

  initBracketMultiSelect();
  if (bracketMultiSelect && builderBracketOptions.length > 0) {
    bracketMultiSelect.setValue(builderBracketOptions);
  }
  initFieldMultiSelect();
  if (fieldMultiSelect && builderFieldKeys.length > 0) {
    fieldMultiSelect.setValue(builderFieldKeys);
  }
  renderCustomLabelTags();
  renderSegments();
  renderFieldChips();
  updatePreview();
  showBuilderView();
}

function closeBuilder() {
  showListView();
}

function syncBracketSegments() {
  const customSegments = builderSegments.filter((s) => s.startsWith('custom:'));
  builderSegments = [...builderBracketOptions, ...customSegments];
  renderSegments();
}

function syncFieldSegments() {
  builderFieldKeys = fieldMultiSelect ? fieldMultiSelect.getValue() : [];
  renderFieldChips();
}

function renderFieldChips() {
  const container = document.getElementById('field-segment-list');
  container.innerHTML = '';

  builderFieldKeys.forEach((key, idx) => {
    const field = STANDARD_FIELD_MAP[key];
    if (!field) return;
    const chip = document.createElement('div');
    chip.className = 'segment-chip segment-chip--field';
    chip.draggable = true;
    chip.dataset.idx = idx;
    chip.innerHTML = `<span class="segment-chip__handle">&#8942;&#8942;</span><span class="segment-chip__label">${escapeHtml(field.label)}</span>`;
    container.appendChild(chip);

    chip.addEventListener('dragstart', (e) => {
      dragSrcFieldChip = idx;
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      dragSrcFieldChip = null;
    });
    chip.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrcFieldChip === null || dragSrcFieldChip === idx) return;
      const moved = builderFieldKeys.splice(dragSrcFieldChip, 1)[0];
      builderFieldKeys.splice(idx, 0, moved);
      if (fieldMultiSelect) fieldMultiSelect.setValue(builderFieldKeys);
      renderFieldChips();
      updatePreview();
    });
  });
}

function initFieldMultiSelect() {
  const container = document.getElementById('field-multiselect');
  container.innerHTML = '';

  const selected = new Set(builderFieldKeys);

  const trigger = document.createElement('div');
  trigger.className = 'multi-select__trigger';
  trigger.tabIndex = 0;

  const chips = document.createElement('div');
  chips.className = 'multi-select__chips';

  const placeholder = document.createElement('span');
  placeholder.className = 'multi-select__placeholder';
  placeholder.textContent = '— Pilih field —';

  const arrow = document.createElement('span');
  arrow.className = 'multi-select__arrow';
  arrow.textContent = '\u25BC';

  trigger.appendChild(chips);
  chips.appendChild(placeholder);
  trigger.appendChild(arrow);

  const dropdown = document.createElement('div');
  dropdown.className = 'multi-select__dropdown';

  const optionEls = [];
  STANDARD_FIELDS.forEach((opt) => {
    const div = document.createElement('div');
    div.className = 'multi-select__option';
    div.dataset.value = opt.key;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'multi-select__option-checkbox';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'multi-select__option-label';
    labelWrap.innerHTML = `${escapeHtml(opt.label)}<div class="multi-select__option-desc">${escapeHtml(opt.description)}</div>`;

    div.appendChild(cb);
    div.appendChild(labelWrap);

    div.addEventListener('click', (e) => {
      if (e.target !== cb) cb.checked = !cb.checked;
      toggleFieldOption(opt.key, cb.checked);
    });

    cb.addEventListener('change', () => {
      toggleFieldOption(opt.key, cb.checked);
    });

    dropdown.appendChild(div);
    optionEls.push({ el: div, cb, value: opt.key });
  });

  container.appendChild(trigger);
  container.appendChild(dropdown);

  function toggleFieldOption(key, isSelected) {
    if (isSelected) {
      selected.add(key);
    } else {
      selected.delete(key);
    }
    builderFieldKeys = Array.from(selected);
    syncFieldSegments();
    updateUI();
    updatePreview();
  }

  function updateUI() {
    chips.innerHTML = '';
    if (selected.size === 0) {
      chips.appendChild(placeholder);
    } else {
      selected.forEach((key) => {
        const field = STANDARD_FIELD_MAP[key];
        const label = field ? field.label : key;
        const chip = document.createElement('span');
        chip.className = 'multi-select__chip';
        chip.innerHTML = `${escapeHtml(label)} <button class="multi-select__chip-remove" data-value="${key}">&times;</button>`;
        chip.querySelector('.multi-select__chip-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          selected.delete(key);
          builderFieldKeys = Array.from(selected);
          const optEl = optionEls.find((o) => o.value === key);
          if (optEl) optEl.cb.checked = false;
          syncFieldSegments();
          updateUI();
          updatePreview();
        });
        chips.appendChild(chip);
      });
    }
    optionEls.forEach((o) => {
      o.cb.checked = selected.has(o.value);
      o.el.classList.toggle('multi-select__option--selected', selected.has(o.value));
    });
    arrow.classList.toggle('multi-select__arrow--open', dropdown.classList.contains('multi-select__dropdown--open'));
  }

  trigger.addEventListener('click', () => {
    dropdown.classList.toggle('multi-select__dropdown--open');
    trigger.classList.toggle('multi-select__trigger--open');
    arrow.classList.toggle('multi-select__arrow--open');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('multi-select__dropdown--open');
      trigger.classList.remove('multi-select__trigger--open');
      arrow.classList.remove('multi-select__arrow--open');
    }
  });

  updateUI();

  fieldMultiSelect = {
    getValue: () => Array.from(selected),
    setValue: (values) => {
      selected.clear();
      (values || []).forEach((v) => selected.add(v));
      builderFieldKeys = Array.from(selected);
      updateUI();
    },
    clear: () => {
      selected.clear();
      builderFieldKeys = [];
      updateUI();
    }
  };
}

function initBracketMultiSelect() {
  const container = document.getElementById('bracket-multiselect');
  container.innerHTML = '';

  const selected = new Set(builderBracketOptions);

  const trigger = document.createElement('div');
  trigger.className = 'multi-select__trigger';
  trigger.tabIndex = 0;

  const chips = document.createElement('div');
  chips.className = 'multi-select__chips';

  const placeholder = document.createElement('span');
  placeholder.className = 'multi-select__placeholder';
  placeholder.textContent = '— Pilih bracket —';

  const arrow = document.createElement('span');
  arrow.className = 'multi-select__arrow';
  arrow.textContent = '\u25BC';

  trigger.appendChild(chips);
  chips.appendChild(placeholder);
  trigger.appendChild(arrow);

  const dropdown = document.createElement('div');
  dropdown.className = 'multi-select__dropdown';

  const TARGET_BRACKETS = ['RESEARCH', 'DISCUSSION', 'BE', 'FE', 'ME', 'BUG', 'DEPLOY', 'ADJUSTMENT', 'PRIORITY', 'SEVERITY'];
  const options = BRACKET_OPTIONS_FULL.filter((b) => TARGET_BRACKETS.includes(b.value));

  const optionEls = [];
  options.forEach((opt) => {
    const div = document.createElement('div');
    div.className = 'multi-select__option';
    div.dataset.value = opt.value;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'multi-select__option-checkbox';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'multi-select__option-label';
    labelWrap.innerHTML = `[${escapeHtml(opt.value)}] ${escapeHtml(opt.label)}<div class="multi-select__option-desc">${escapeHtml(opt.description)}</div>`;

    div.appendChild(cb);
    div.appendChild(labelWrap);

    div.addEventListener('click', (e) => {
      if (e.target !== cb) cb.checked = !cb.checked;
      toggleBracketOption(opt.value, cb.checked);
    });

    cb.addEventListener('change', () => {
      toggleBracketOption(opt.value, cb.checked);
    });

    dropdown.appendChild(div);
    optionEls.push({ el: div, cb, value: opt.value });
  });

  builderCustomBracketDefs.forEach((def) => {
    const div = document.createElement('div');
    div.className = 'multi-select__option';
    div.dataset.value = def.value;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'multi-select__option-checkbox';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'multi-select__option-label';
    const labelPart = def.label ? ` ${escapeHtml(def.label)}` : '';
    const descPart = def.description ? `<div class="multi-select__option-desc">${escapeHtml(def.description)}</div>` : '';
    labelWrap.innerHTML = `[${escapeHtml(def.value)}]${labelPart}${descPart}`;

    div.appendChild(cb);
    div.appendChild(labelWrap);

    div.addEventListener('click', (e) => {
      if (e.target !== cb) cb.checked = !cb.checked;
      toggleBracketOption(def.value, cb.checked);
    });

    cb.addEventListener('change', () => {
      toggleBracketOption(def.value, cb.checked);
    });

    dropdown.appendChild(div);
    optionEls.push({ el: div, cb, value: def.value });
  });

  container.appendChild(trigger);
  container.appendChild(dropdown);

  function toggleBracketOption(value, isSelected) {
    if (isSelected) {
      selected.add(value);
    } else {
      selected.delete(value);
    }
    builderBracketOptions = Array.from(selected);
    syncBracketSegments();
    updateUI();
    updatePreview();
  }

  function updateUI() {
    chips.innerHTML = '';
    if (selected.size === 0) {
      chips.appendChild(placeholder);
    } else {
      selected.forEach((val) => {
        const chip = document.createElement('span');
        chip.className = 'multi-select__chip';
        chip.innerHTML = `[${escapeHtml(val)}] <button class="multi-select__chip-remove" data-value="${val}">&times;</button>`;
        chip.querySelector('.multi-select__chip-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          selected.delete(val);
          builderBracketOptions = Array.from(selected);
          const optEl = optionEls.find((o) => o.value === val);
          if (optEl) optEl.cb.checked = false;
          syncBracketSegments();
          updateUI();
          updatePreview();
        });
        chips.appendChild(chip);
      });
    }
    optionEls.forEach((o) => {
      o.cb.checked = selected.has(o.value);
      o.el.classList.toggle('multi-select__option--selected', selected.has(o.value));
    });
    arrow.classList.toggle('multi-select__arrow--open', dropdown.classList.contains('multi-select__dropdown--open'));
  }

  trigger.addEventListener('click', () => {
    dropdown.classList.toggle('multi-select__dropdown--open');
    trigger.classList.toggle('multi-select__trigger--open');
    arrow.classList.toggle('multi-select__arrow--open');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('multi-select__dropdown--open');
      trigger.classList.remove('multi-select__trigger--open');
      arrow.classList.remove('multi-select__arrow--open');
    }
  });

  updateUI();

  bracketMultiSelect = {
    getValue: () => Array.from(selected),
    setValue: (values) => {
      selected.clear();
      (values || []).forEach((v) => selected.add(v));
      builderBracketOptions = Array.from(selected);
      updateUI();
    },
    clear: () => {
      selected.clear();
      builderBracketOptions = [];
      updateUI();
    },
    addOption: (value, label, description) => {
      const div = document.createElement('div');
      div.className = 'multi-select__option';
      div.dataset.value = value;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'multi-select__option-checkbox';
      cb.checked = true;

      const labelWrap = document.createElement('div');
      labelWrap.className = 'multi-select__option-label';
      const labelPart = label ? ` ${escapeHtml(label)}` : '';
      const descPart = description ? `<div class="multi-select__option-desc">${escapeHtml(description)}</div>` : '';
      labelWrap.innerHTML = `[${escapeHtml(value)}]${labelPart}${descPart}`;

      div.appendChild(cb);
      div.appendChild(labelWrap);

      div.addEventListener('click', (e) => {
        if (e.target !== cb) cb.checked = !cb.checked;
        toggleBracketOption(value, cb.checked);
      });

      cb.addEventListener('change', () => {
        toggleBracketOption(value, cb.checked);
      });

      dropdown.appendChild(div);
      optionEls.push({ el: div, cb, value });

      selected.add(value);
      builderBracketOptions = Array.from(selected);
      builderCustomBracketDefs.push({ value, label, description });
      syncBracketSegments();
      updateUI();
      updatePreview();
    }
  };
}

function openCustomBracketModal() {
  document.getElementById('cb-modal').classList.add('modal-overlay--open');
  document.getElementById('cb-value').value = '';
  document.getElementById('cb-label').value = '';
  document.getElementById('cb-desc').value = '';
  document.getElementById('cb-value').focus();
}

function closeCustomBracketModal() {
  document.getElementById('cb-modal').classList.remove('modal-overlay--open');
}

function addCustomBracketOption() {
  const valueInput = document.getElementById('cb-value');
  const labelInput = document.getElementById('cb-label');
  const descInput = document.getElementById('cb-desc');
  const value = valueInput.value.trim().toUpperCase();
  const label = labelInput.value.trim();
  const description = descInput.value.trim();

  if (!value) { showToast('Value is required.', 'error'); valueInput.focus(); return; }
  if (!/^[A-Z0-9_]+$/.test(value)) { showToast('Value must be uppercase letters, numbers, and underscores only.', 'error'); valueInput.focus(); return; }

  const TARGET_BRACKETS = ['RESEARCH', 'DISCUSSION', 'BE', 'FE', 'ME', 'BUG', 'DEPLOY', 'ADJUSTMENT', 'PRIORITY', 'SEVERITY'];
  if (TARGET_BRACKETS.includes(value)) { showToast('Value already exists as a default bracket.', 'error'); valueInput.focus(); return; }
  if (builderCustomBracketDefs.some((d) => d.value === value)) { showToast('Custom bracket with this value already exists.', 'error'); valueInput.focus(); return; }

  bracketMultiSelect.addOption(value, label, description);

  closeCustomBracketModal();
  showToast(`Custom bracket [${value}] added.`, 'success');
}

// ===== CUSTOM LABELS =====

function renderCustomLabelTags() {
  const container = document.getElementById('cl-tags');
  container.innerHTML = '';

  builderCustomLabels.forEach((label, i) => {
    const tag = document.createElement('span');
    tag.className = 'custom-labels__tag';
    tag.innerHTML = `${escapeHtml(label)}<button class="custom-labels__tag-remove" data-idx="${i}">&times;</button>`;
    tag.querySelector('.custom-labels__tag-remove').addEventListener('click', () => {
      removeCustomLabel(i);
    });
    container.appendChild(tag);
  });
}

function addCustomLabel() {
  const input = document.getElementById('cl-input');
  const val = input.value.trim().toUpperCase();
  if (!val) return;
  if (builderCustomLabels.includes(val)) { input.value = ''; return; }

  builderCustomLabels.push(val);
  const segKey = 'custom:' + val;
  builderSegments.push(segKey);

  input.value = '';
  renderCustomLabelTags();
  renderSegments();
  updatePreview();
}

function removeCustomLabel(i) {
  const label = builderCustomLabels[i];
  builderCustomLabels.splice(i, 1);
  builderSegments = builderSegments.filter((s) => s !== 'custom:' + label);

  renderCustomLabelTags();
  renderSegments();
  updatePreview();
}

// ===== SEGMENTS =====

function renderSegments() {
  const container = document.getElementById('segment-list');
  container.innerHTML = '';

  builderSegments.forEach((seg, idx) => {
    const chip = document.createElement('div');
    let label, variant;

    if (seg.startsWith('custom:')) {
      label = '[' + seg.replace('custom:', '') + ']';
      variant = 'custom';
    } else {
      label = '[' + seg + ']';
      variant = 'bracket';
    }

    chip.className = 'segment-chip' + (variant ? ' segment-chip--' + variant : '');
    chip.draggable = true;
    chip.dataset.idx = idx;
    chip.innerHTML = `<span class="segment-chip__handle">&#8942;&#8942;</span><span class="segment-chip__label">${label}</span>`;
    container.appendChild(chip);

    chip.addEventListener('dragstart', (e) => {
      dragSrcSegment = idx;
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      dragSrcSegment = null;
    });
    chip.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrcSegment === null || dragSrcSegment === idx) return;
      const moved = builderSegments.splice(dragSrcSegment, 1)[0];
      builderSegments.splice(idx, 0, moved);
      renderSegments();
      updatePreview();
    });
  });
}



// ===== PREVIEW =====

function updatePreview() {
  updateTitlePreview();
  updateFormPreview();
}

function updateTitlePreview() {
  const title = document.getElementById('header-title').value.trim();
  const parts = [];

  builderSegments.forEach((seg) => {
    if (seg.startsWith('custom:')) {
      parts.push('[' + seg.replace('custom:', '') + ']');
    } else {
      parts.push('[' + seg + ']');
    }
  });

  if (title) parts.push(title);

  const result = parts.length > 0 ? parts.join(' ') : '—';
  document.getElementById('title-result').textContent = result;
  document.getElementById('preview-title').textContent = result;
}

function updateFormPreview() {
  const container = document.getElementById('preview-form');
  const resolvedFields = builderFieldKeys
    .map((key) => STANDARD_FIELD_MAP[key])
    .filter(Boolean);

  if (resolvedFields.length === 0) {
    container.innerHTML = '<p class="preview__empty">Select fields to see preview.</p>';
    return;
  }

  container.innerHTML = resolvedFields
    .filter((f) => f.label)
    .map((field) => {
      const label = escapeHtml(field.label);
      const required = field.constraint === 'mandatory' ? '<span class="required">*</span>' : '';
      const ph = escapeHtml(field.label);
      const desc = field.description ? `<p class="form-group__desc">${escapeHtml(field.description)}</p>` : '';

      if (field.type === 'dropdown' && field.options && field.options.length > 0) {
        const opts = field.options.map((o) => `<option>${escapeHtml(o)}</option>`).join('');
        return `<div class="preview__field">
          <div class="preview__field-label">${label} ${required}</div>
          <select class="preview__field-select" disabled><option>— Select —</option>${opts}</select>
          ${desc}
        </div>`;
      }

      if (field.type === 'rich_text') {
        return `<div class="preview__field">
          <div class="preview__field-label">${label} ${required}</div>
          <textarea class="preview__field-textarea" disabled placeholder="${ph}"></textarea>
          ${desc}
        </div>`;
      }

      if (field.type === 'checkbox_list' && field.options && field.options.length > 0) {
        const checks = field.options.map((o) =>
          `<label><input type="checkbox" disabled> ${escapeHtml(o)}</label>`
        ).join('');
        return `<div class="preview__field">
          <div class="preview__field-label">${label} ${required}</div>
          <div class="preview__field-checkbox">${checks}</div>
          ${desc}
        </div>`;
      }

      const inputType = field.type === 'url' ? 'url' : 'text';
      return `<div class="preview__field">
        <div class="preview__field-label">${label} ${required}</div>
        <input class="preview__field-input" type="${inputType}" disabled placeholder="${ph}">
        ${desc}
      </div>`;
    }).join('');
}

// ===== SAVE =====

function saveBuilder() {
  const name = document.getElementById('tpl-name').value.trim();

  if (!name) { showToast('Template name is required.', 'error'); return; }

  const fields = builderFieldKeys
    .map((key) => {
      const f = STANDARD_FIELD_MAP[key];
      if (!f) return null;
      const out = { key: f.key, label: f.label, type: f.type, constraint: f.constraint };
      if (f.options && f.options.length > 0 && (f.type === 'dropdown' || f.type === 'checkbox_list')) {
        out.options = [...f.options];
      }
      return out;
    })
    .filter(Boolean);

  if (fields.length === 0) { showToast('Select at least one field.', 'error'); return; }

  const header = {
    segments: [...builderSegments],
    customLabels: [...builderCustomLabels],
    bracketOptions: [...builderBracketOptions],
    customBracketDefs: [...builderCustomBracketDefs]
  };

  if (editingTemplateId) {
    const index = currentTemplates.findIndex((t) => t.id === editingTemplateId);
    if (index !== -1) {
      currentTemplates[index] = {
        id: editingTemplateId,
        name,
        category: currentTemplates[index].category || 'General',
        header,
        fields,
        fieldKeys: [...builderFieldKeys]
      };
    }
    showToast('Template updated.', 'success');
  } else {
    const newId = 'tpl_' + slugify(name) + '_' + Date.now();
    currentTemplates.push({ id: newId, name, category: 'General', header, fields, fieldKeys: [...builderFieldKeys] });
    showToast('Template created.', 'success');
  }

  Storage.saveTemplates(currentTemplates);
  renderTemplateGrid();
  showListView();
}

// ===== IMPORT =====

function openImportModal() {
  importData = null;
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('import-preview-content').innerHTML = '';
  document.getElementById('import-modal-confirm').disabled = true;
  document.getElementById('import-modal').classList.add('modal-overlay--open');
}

function closeImportModal() {
  document.getElementById('import-modal').classList.remove('modal-overlay--open');
  importData = null;
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.name || !Array.isArray(data.fields) || data.fields.length === 0) {
        showToast('Invalid format. Required: name, fields[].', 'error');
        return;
      }
      for (const f of data.fields) {
        if (!f.key || !f.label || !f.type) {
          showToast('Each field must have key, label, and type.', 'error');
          return;
        }
      }
      importData = data;
      document.getElementById('import-preview').style.display = 'block';
      document.getElementById('import-preview-content').innerHTML = `
        <div class="import-preview__name">${escapeHtml(data.name)}</div>
        <div class="import-preview__fields">${data.fields.length} field${data.fields.length !== 1 ? 's' : ''}: ${data.fields.map((f) => escapeHtml(f.label)).join(', ')}</div>
      `;
      document.getElementById('import-modal-confirm').disabled = false;
    } catch {
      showToast('Failed to parse JSON file.', 'error');
    }
  };
  reader.readAsText(file);
}

async function confirmImport() {
  if (!importData) return;
  const tpl = {
    id: 'tpl_' + slugify(importData.name) + '_' + Date.now(),
    name: importData.name,
    category: importData.category || 'General',
    header: importData.header || undefined,
    fields: importData.fields.map((f) => ({
      key: f.key, label: f.label, type: f.type,
      constraint: f.constraint || 'optional',
      options: f.options || undefined,
      placeholder: f.placeholder || undefined,
      defaultValue: f.defaultValue || undefined,
      description: f.description || undefined
    }))
  };
  currentTemplates.push(tpl);
  await Storage.saveTemplates(currentTemplates);
  renderTemplateGrid();
  closeImportModal();
  showToast('Template imported.', 'success');
}

// ===== UTILS =====

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast toast--' + (type || 'info');
  setTimeout(() => toast.classList.add('toast--visible'), 10);
  setTimeout(() => toast.classList.remove('toast--visible'), 3000);
}

// ===== EVENT BINDINGS =====

function bindListEvents() {
  document.getElementById('create-template-btn').addEventListener('click', openCreateBuilder);
  document.getElementById('import-template-btn').addEventListener('click', openImportModal);
  document.getElementById('search-input').addEventListener('input', renderTemplateGrid);

  document.getElementById('back-to-app').addEventListener('click', () => {
    chrome.tabs.create({ url: 'app/app.html' });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.template-card__more')) {
      closeAllDropdowns();
    }
  });
}

function bindBuilderEvents() {
  document.getElementById('builder-back').addEventListener('click', closeBuilder);
  document.getElementById('builder-cancel').addEventListener('click', closeBuilder);
  document.getElementById('builder-save').addEventListener('click', saveBuilder);

  document.getElementById('cl-add-btn').addEventListener('click', addCustomLabel);
  document.getElementById('cl-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCustomLabel(); }
  });

  document.getElementById('cb-open-modal').addEventListener('click', openCustomBracketModal);
  document.getElementById('cb-modal-add').addEventListener('click', addCustomBracketOption);
  document.getElementById('cb-modal-close').addEventListener('click', closeCustomBracketModal);
  document.getElementById('cb-modal-cancel').addEventListener('click', closeCustomBracketModal);
  document.getElementById('cb-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCustomBracketModal();
  });
  document.getElementById('cb-desc').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCustomBracketOption(); }
  });

  document.getElementById('header-title').addEventListener('input', updatePreview);
  document.getElementById('tpl-name').addEventListener('input', updatePreview);
}

function bindImportEvents() {
  document.getElementById('import-file-input').addEventListener('change', handleImportFile);
  document.getElementById('import-modal-confirm').addEventListener('click', confirmImport);
  document.getElementById('import-modal-cancel').addEventListener('click', closeImportModal);
  document.getElementById('import-modal-close').addEventListener('click', closeImportModal);
  document.getElementById('import-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeImportModal();
  });
}
