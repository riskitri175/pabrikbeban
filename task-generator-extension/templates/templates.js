let currentTemplates = [];
let editingTemplateId = null;
let importData = null;
let builderSegments = [];
let builderCustomLabels = [];
let builderFields = [];
let builderBracketOptions = [];
let builderCustomBracketDefs = [];
let bracketMultiSelect = null;
let dragSrcSegment = null;
let dragSrcField = null;

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
  document.querySelectorAll('.field-card__dropdown--open').forEach((d) => {
    d.classList.remove('field-card__dropdown--open');
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
  builderFields = [];
  builderBracketOptions = [];
  builderCustomBracketDefs = [];
  initBracketMultiSelect();
  renderCustomLabelTags();
  renderSegments();
  renderFieldCards();
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
  builderFields = tpl.fields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined }));

  initBracketMultiSelect();
  if (bracketMultiSelect && builderBracketOptions.length > 0) {
    bracketMultiSelect.setValue(builderBracketOptions);
  }
  renderCustomLabelTags();
  renderSegments();
  renderFieldCards();
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

// ===== FIELD CARDS =====

function renderFieldCards() {
  const container = document.getElementById('field-list');
  container.innerHTML = '';

  builderFields.forEach((field, idx) => {
    const card = createFieldCard(field, idx);
    container.appendChild(card);
  });
}

function createFieldCard(field, idx) {
  const card = document.createElement('div');
  card.className = 'field-card';
  card.draggable = true;
  card.dataset.idx = idx;

  const constraintBadge = {
    mandatory: 'field-card__badge--mandatory',
    optional: 'field-card__badge--optional',
    ai_generated: 'field-card__badge--ai',
    fixed_input: 'field-card__badge--fixed'
  }[field.constraint] || 'field-card__badge--optional';

  card.innerHTML = `
    <div class="field-card__header">
      <span class="field-card__drag">&#8942;&#8942;</span>
      <span class="field-card__name">${escapeHtml(field.label || 'Untitled Field')}</span>
      <div class="field-card__badges">
        <span class="field-card__badge field-card__badge--type">${escapeHtml(field.type)}</span>
        <span class="field-card__badge ${constraintBadge}">${escapeHtml(field.constraint)}</span>
      </div>
      <button class="field-card__toggle" title="Expand">&#9662;</button>
      <div class="field-card__more">
        <button class="field-card__more-btn" title="More">&#8943;</button>
        <div class="field-card__dropdown">
          <button class="field-card__dropdown-item" data-action="duplicate-field">Duplicate</button>
          <button class="field-card__dropdown-item field-card__dropdown-item--danger" data-action="delete-field">Delete</button>
        </div>
      </div>
    </div>
    <div class="field-card__body">
      <div class="field-card__row">
        <div class="form-group">
          <label class="form-group__label">Label</label>
          <input class="form-group__input fc-label" type="text" value="${escapeHtml(field.label)}" maxlength="50" placeholder="e.g. Figma Link">
        </div>
        <div class="form-group">
          <label class="form-group__label">Key</label>
          <input class="form-group__input fc-key" type="text" value="${escapeHtml(field.key)}" placeholder="figma_link" pattern="^[a-z0-9_]+$">
        </div>
      </div>
      <div class="field-card__row">
        <div class="form-group">
          <label class="form-group__label">Type</label>
          <select class="form-group__input fc-type">
            <option value="text" ${field.type === 'text' ? 'selected' : ''}>Text</option>
            <option value="rich_text" ${field.type === 'rich_text' ? 'selected' : ''}>Rich Text</option>
            <option value="dropdown" ${field.type === 'dropdown' ? 'selected' : ''}>Dropdown</option>
            <option value="checkbox_list" ${field.type === 'checkbox_list' ? 'selected' : ''}>Checkbox List</option>
            <option value="url" ${field.type === 'url' ? 'selected' : ''}>URL</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-group__label">Constraint</label>
          <select class="form-group__input fc-constraint">
            <option value="mandatory" ${field.constraint === 'mandatory' ? 'selected' : ''}>Mandatory</option>
            <option value="optional" ${field.constraint === 'optional' ? 'selected' : ''}>Optional</option>
            <option value="ai_generated" ${field.constraint === 'ai_generated' ? 'selected' : ''}>AI-Generated</option>
            <option value="fixed_input" ${field.constraint === 'fixed_input' ? 'selected' : ''}>Fixed Input</option>
          </select>
        </div>
      </div>
      <div class="options-editor ${(field.type === 'dropdown' || field.type === 'checkbox_list') ? 'options-editor--visible' : ''}">
        <p class="options-editor__label">Options</p>
        <div class="options-editor__tags"></div>
        <div class="options-editor__add">
          <input class="options-editor__add-input" type="text" placeholder="Add option..." maxlength="60">
          <button class="btn btn--secondary btn--sm oe-add-btn">+</button>
        </div>
      </div>
      <div class="field-advanced">
        <button class="field-advanced__toggle">&#9662; Advanced</button>
        <div class="field-advanced__body">
          <div class="field-card__row">
            <div class="form-group">
              <label class="form-group__label">Placeholder</label>
              <input class="form-group__input fc-placeholder" type="text" value="${escapeHtml(field.placeholder || '')}" placeholder="Placeholder text">
            </div>
            <div class="form-group">
              <label class="form-group__label">Default Value</label>
              <input class="form-group__input fc-default" type="text" value="${escapeHtml(field.defaultValue || '')}" placeholder="Default value">
            </div>
          </div>
          <div class="field-card__row field-card__row--full">
            <div class="form-group">
              <label class="form-group__label">Description / Help Text</label>
              <input class="form-group__input fc-description" type="text" value="${escapeHtml(field.description || '')}" placeholder="Brief help text for this field">
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const toggle = card.querySelector('.field-card__toggle');
  const body = card.querySelector('.field-card__body');

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    body.classList.toggle('field-card__body--open');
    toggle.classList.toggle('field-card__toggle--open');
  });

  card.querySelector('.field-card__header').addEventListener('click', () => {
    body.classList.toggle('field-card__body--open');
    toggle.classList.toggle('field-card__toggle--open');
  });

  card.querySelector('.field-card__drag').addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  const moreBtn = card.querySelector('.field-card__more-btn');
  const dropdown = card.querySelector('.field-card__dropdown');
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllDropdowns();
    dropdown.classList.toggle('field-card__dropdown--open');
  });

  card.querySelector('[data-action="duplicate-field"]').addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllDropdowns();
    const clone = JSON.parse(JSON.stringify(field));
    clone.label = 'Copy of ' + clone.label;
    clone.key = clone.key + '_copy';
    builderFields.splice(idx + 1, 0, clone);
    renderFieldCards();
    updatePreview();
  });

  card.querySelector('[data-action="delete-field"]').addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllDropdowns();
    builderFields.splice(idx, 1);
    renderFieldCards();
    updatePreview();
  });

  const labelInput = card.querySelector('.fc-label');
  const keyInput = card.querySelector('.fc-key');

  labelInput.addEventListener('input', () => {
    field.label = labelInput.value.trim();
    if (!editingTemplateId || !keyInput.value) {
      field.key = slugify(labelInput.value);
      keyInput.value = field.key;
    }
    card.querySelector('.field-card__name').textContent = field.label || 'Untitled Field';
    updatePreview();
  });

  keyInput.addEventListener('input', () => {
    field.key = keyInput.value.trim();
  });

  const typeSelect = card.querySelector('.fc-type');
  typeSelect.addEventListener('change', () => {
    field.type = typeSelect.value;
    card.querySelector('.field-card__badge--type').textContent = field.type;
    const oe = card.querySelector('.options-editor');
    if (field.type === 'dropdown' || field.type === 'checkbox_list') {
      oe.classList.add('options-editor--visible');
    } else {
      oe.classList.remove('options-editor--visible');
    }
    updatePreview();
  });

  const constraintSelect = card.querySelector('.fc-constraint');
  constraintSelect.addEventListener('change', () => {
    field.constraint = constraintSelect.value;
    const badge = card.querySelectorAll('.field-card__badge')[1];
    badge.textContent = field.constraint;
    badge.className = 'field-card__badge ' + ({
      mandatory: 'field-card__badge--mandatory',
      optional: 'field-card__badge--optional',
      ai_generated: 'field-card__badge--ai',
      fixed_input: 'field-card__badge--fixed'
    }[field.constraint] || 'field-card__badge--optional');
    updatePreview();
  });

  const placeholderInput = card.querySelector('.fc-placeholder');
  placeholderInput.addEventListener('input', () => {
    field.placeholder = placeholderInput.value.trim();
    updatePreview();
  });

  const defaultInput = card.querySelector('.fc-default');
  defaultInput.addEventListener('input', () => {
    field.defaultValue = defaultInput.value.trim();
  });

  const descInput = card.querySelector('.fc-description');
  descInput.addEventListener('input', () => {
    field.description = descInput.value.trim();
    updatePreview();
  });

  const advToggle = card.querySelector('.field-advanced__toggle');
  const advBody = card.querySelector('.field-advanced__body');
  advToggle.addEventListener('click', () => {
    advBody.classList.toggle('field-advanced__body--open');
    advToggle.innerHTML = advBody.classList.contains('field-advanced__body--open')
      ? '&#9652; Advanced'
      : '&#9662; Advanced';
  });

  renderOptionsEditor(card, field);

  card.addEventListener('dragstart', (e) => {
    if (e.target.closest('.field-card__drag') || e.target === card) {
      dragSrcField = idx;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    } else {
      e.preventDefault();
    }
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    dragSrcField = null;
  });
  card.addEventListener('dragover', (e) => {
    if (dragSrcField === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  card.addEventListener('drop', (e) => {
    if (dragSrcField === null || dragSrcField === idx) return;
    e.preventDefault();
    const moved = builderFields.splice(dragSrcField, 1)[0];
    builderFields.splice(idx, 0, moved);
    renderFieldCards();
    updatePreview();
  });

  return card;
}

function renderOptionsEditor(card, field) {
  const tagsContainer = card.querySelector('.options-editor__tags');
  const addInput = card.querySelector('.options-editor__add-input');
  const addBtn = card.querySelector('.oe-add-btn');

  if (!field.options) field.options = [];

  function renderTags() {
    tagsContainer.innerHTML = '';
    field.options.forEach((opt, oi) => {
      const tag = document.createElement('span');
      tag.className = 'options-editor__tag';
      tag.innerHTML = `${escapeHtml(opt)}<button class="options-editor__tag-remove" data-oi="${oi}">&times;</button>`;
      tag.querySelector('.options-editor__tag-remove').addEventListener('click', () => {
        field.options.splice(oi, 1);
        renderTags();
        updatePreview();
      });
      tagsContainer.appendChild(tag);
    });
  }

  function addOption() {
    const val = addInput.value.trim();
    if (!val) return;
    if (field.options.includes(val)) { addInput.value = ''; return; }
    field.options.push(val);
    addInput.value = '';
    renderTags();
    updatePreview();
  }

  addBtn.addEventListener('click', addOption);
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addOption(); }
  });

  renderTags();
}

function addNewField() {
  builderFields.push({
    key: '',
    label: '',
    type: 'text',
    constraint: 'mandatory',
    options: [],
    placeholder: '',
    defaultValue: '',
    description: ''
  });
  renderFieldCards();
  const cards = document.querySelectorAll('.field-card');
  const last = cards[cards.length - 1];
  if (last) {
    last.querySelector('.field-card__body').classList.add('field-card__body--open');
    last.querySelector('.field-card__toggle').classList.add('field-card__toggle--open');
    last.querySelector('.fc-label').focus();
  }
  updatePreview();
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

  if (builderFields.length === 0) {
    container.innerHTML = '<p class="preview__empty">Add fields to see preview.</p>';
    return;
  }

  container.innerHTML = builderFields
    .filter((f) => f.label)
    .map((field) => {
      const label = escapeHtml(field.label);
      const required = field.constraint === 'mandatory' ? '<span class="required">*</span>' : '';
      const ph = escapeHtml(field.placeholder || field.label);
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

  const fields = builderFields
    .filter((f) => f.label && f.key)
    .map((f) => {
      const out = { key: f.key, label: f.label, type: f.type, constraint: f.constraint };
      if (f.options && f.options.length > 0 && (f.type === 'dropdown' || f.type === 'checkbox_list')) {
        out.options = [...f.options];
      }
      if (f.placeholder) out.placeholder = f.placeholder;
      if (f.defaultValue) out.defaultValue = f.defaultValue;
      if (f.description) out.description = f.description;
      return out;
    });

  if (fields.length === 0) { showToast('At least one field with label and key is required.', 'error'); return; }

  const keys = fields.map((f) => f.key);
  if (keys.length !== new Set(keys).size) { showToast('Field keys must be unique.', 'error'); return; }

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
        fields
      };
    }
    showToast('Template updated.', 'success');
  } else {
    const newId = 'tpl_' + slugify(name) + '_' + Date.now();
    currentTemplates.push({ id: newId, name, category: 'General', header, fields });
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
    if (!e.target.closest('.template-card__more') && !e.target.closest('.field-card__more')) {
      closeAllDropdowns();
    }
  });
}

function bindBuilderEvents() {
  document.getElementById('builder-back').addEventListener('click', closeBuilder);
  document.getElementById('builder-cancel').addEventListener('click', closeBuilder);
  document.getElementById('builder-save').addEventListener('click', saveBuilder);
  document.getElementById('add-field-btn').addEventListener('click', addNewField);

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
