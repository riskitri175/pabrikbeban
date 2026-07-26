# Progress Pengerjaan — AI Task Generator & Multi-Tool Sync Engine

**Status:** ✅ All Phases Complete (Phase 1A + 1B + 1C)
**Last Updated:** 2026-07-26 — Direct to Plane, DeepSeek, Full Tab final

---

## Todo List

### Sesi 1 ✅ — Init folder structure + manifest.json
- [x] Buat `docs/rule.md` — Aturan pengerjaan
- [x] Buat `docs/progress.md` — Progress tracker
- [x] Buat folder `assets/`, `options/`, `sidepanel/`, `utils/`
- [x] Buat `manifest.json` (Manifest V3)
- [x] Buat `background.js` — onInstalled + inject default templates + open options page
- [x] Buat `assets/icon-{16,48,128}.png` — placeholder icons

### Sesi 2 ✅ — Storage + Templates
- [x] `utils/storage.js` — AES-256 encrypt/decrypt, chrome.storage.local wrapper
- [x] `utils/templates-preset.js` — 3 default templates + bracket/severity/priority enums + DoD checklists

### Sesi 3 ✅ — Options Page
- [x] `options/options.html` — layout: API Settings section + Template Manager section + Modal Builder
- [x] `options/options.css` — styling: form, table, modal, badges, buttons
- [x] `options/options.js` — load/save settings, test plane + AI connection, template CRUD, field builder repeater

### Sesi 4 ✅ — Sidepanel Skeleton + Plane API + Icons
- [x] `sidepanel/sidepanel.html` — Dashboard: Workspace Header, Search, Task Table, Create/Fetch buttons
- [x] `sidepanel/sidepanel.css` — Responsive layout for 380px–450px, modal, badges
- [x] `sidepanel/sidepanel.js` — Workspace info, search, fetch modal, import to workspace
- [x] `utils/plane-api.js` — Full client: ping, searchIssues, getChildIssues, createIssue, createIssuesBulk, createHierarchicalBatch, buildDescriptionHtml

### Sesi 5 ✅ — Testing & Debug
- [x] Validasi manifest.json (JSON valid)
- [x] Syntax check semua JS files (no errors)
- [x] ZIP package created: `task-generator-extension-v1.3.0.zip`

### Popup Beranda ✅
- [x] Buat `popup/popup.html` + `popup.css` + `popup.js` — beranda extension
- [x] Tombol **Buka Side Panel** (`chrome.sidePanel.open`)
- [x] Tombol **Settings** (`chrome.runtime.openOptionsPage`)
- [x] Update `manifest.json` — `default_popup: popup/popup.html`
- [x] Update `background.js` — `setPanelBehavior({ openPanelOnActionClick: false })`

### Phase 1B Sesi 1 ✅ — Create Task by Template (Mode A)
- [x] Update `sidepanel/sidepanel.html` — dua view (Dashboard + Create Task) dengan toggle
- [x] Update `sidepanel/sidepanel.js` — template dropdown, dynamic form render, bracket/severity/priority, full title auto-generate, AC repeater, DoD checklist, custom fields render, save draft
- [x] Update `sidepanel/sidepanel.css` — styles for create task form, form-row, textarea, ac-row, dod-item, badge preview

### Phase 1.2 ✅ — Restore Template Manager
- [x] Tambah **Template Manager** section di `options/options.html`
- [x] Tambah **Template Modal** (add/edit field repeater) di `options/options.html`
- [x] Restore template CRUD functions di `options/options.js` (load, render, add, edit, delete, field builder)
- [x] Bind events template buttons
- [x] ZIP package updated

### Full Tab + Split Layout (Opsi B) ✅
- [x] Migrasi dari sidepanel ke full tab (`app/app.html`, `app/app.css`, `app/app.js`)
- [x] Grid layout `2fr 1fr` — dashboard kiri, create task panel kanan
- [x] Popup beranda: tombol [Buka Task Generator] buka tab baru ke `app/app.html`
- [x] Update `manifest.json` — hapus `sidePanel` permission, pakai `default_popup`

### AI Provider Integration ✅ — Phase 1C #1
- [x] `utils/ai-provider.js` — service untuk OpenAI, Gemini, Anthropic
- [x] `generate(prompt)` — API call ke chat completion endpoints
- [x] `breakDownPRD(prd, template, guidance)` — breakdown PRD ke structured tasks
- [x] `refine(task, instruction)` — per-task AI refine
- [x] `refineBulk(tasks, instruction)` — bulk AI refine
- [x] `_parseJSON(raw)` — parse AI response even with markdown backticks

### Mode B: Create by Requirement ✅ — Phase 1C #2
- [x] Tab Mode A / Mode B di panel kanan
- [x] PRD textarea + template reference + custom guidance
- [x] Loading state dengan spinner
- [x] Error handling + toast feedback
- [x] Auto-add generated tasks ke batch dan switch ke Batch tab

### AI Refine Bar ✅ — Phase 1C #6
- [x] Per-task refine input di expandable card body
- [x] Bulk refine bar (input + Apply/Cancel)
- [x] Refine button in batch footer
- [x] Enter key support

### Direct to Plane (Mode C) ✅ — Phase 1B #8
- [x] Tab "Direct to Plane" di panel kanan — input title, description (WYSIWYG editor), state, priority, cycle
- [x] Multi-select components: assignees, labels, modules (fetch dari Plane API)
- [x] Parent task search dengan autocomplete dropdown
- [x] Start date / target date picker
- [x] Estimate points selector
- [x] Submit & Update issue langsung ke Plane API

### AI Provider: DeepSeek ✅ — Phase 1C #7
- [x] Tambah `deepseek` ke dropdown AI Provider di options
- [x] Implementasi `_callDeepSeek()` di `utils/ai-provider.js`

### External Search & Fetch (Live) ✅ — Phase 1B #7
- [x] Improved search result cards: key, title, priority badge, status badge, project
- [x] Enter key support di search field
- [x] Import child tasks — fetch children via `getChildIssues()` dan tambah ke batch dengan parent_id benar
- [x] Loading state saat import
- [x] Auto-switch ke Batch tab setelah import

### Hierarchical Sync Engine (UI) ✅ — Phase 1B #6
- [x] Parent Task dropdown di form create (menampilkan top-level tasks dari batch)
- [x] Save parent_id saat draft task sebagai child
- [x] Tree hierarchy di batch view: parent cards → indented child cards
- [x] "+ Child" button di setiap parent task → auto-select parent di form
- [x] Submit Selected: deteksi parent-child → pakai `createHierarchicalBatch()` untuk tasks berelasi
- [x] Flat submit via `createIssuesBulk()` untuk tasks tanpa parent-child

### Preview & Interactive Workspace ✅ — Phase 1B #5
- [x] Tab mode Search/Batch di toolbar kiri
- [x] Batch view: daftar task cards dengan checkbox, priority badge, sync status
- [x] Select All checkbox, expand/collapse detail per task (story, AC, DoD)
- [x] Delete Selected — hapus task terpilih dari batch
- [x] Clear All — bersihkan seluruh batch
- [x] Submit Selected — kirim task terpilih ke Plane via `PlaneAPI.createIssuesBulk()`
- [x] Auto-save batch ke storage setiap perubahan
- [x] Beralih otomatis ke Batch tab setelah save draft / import

### Submit ke Plane API ✅ — Phase 1B #4
- [x] Ubah `previewTask()` jadi `submitTask()` — panggil `PlaneAPI.createIssue()`
- [x] Validasi form sebelum submit: template, title, story, AC
- [x] Konfirmasi dialog sebelum kirim
- [x] Map priority (Critical→urgent, High→high, Medium→medium, Low→low)
- [x] Build `description_html` via `PlaneAPI._buildDescriptionHtml()`
- [x] Toast notification sukses/gagal
- [x] Reset form setelah submit sukses
- [x] Loading state pada tombol submit (disabled + "Submitting...")

### Phase 1.1 ✅ — Multi-Workspace (Perubahan Rencana)
- [x] Update `utils/storage.js` — tambah `workspaces[]`, `active_workspace_id`, helper `getActiveWorkspace()` & `setActiveWorkspace()`
- [x] Update `utils/plane-api.js` — `_getConfig()` ambil slug & project dari active workspace, tambah `getWorkspaceProjects()`
- [x] Update `background.js` — default settings format baru
- [x] Restruktur `options/options.html` — pisah Plane URL+API Key (global), Workspace Manager (multi)
- [x] Update `options/options.js` — workspace CRUD, fetch projects dari Plane API, set active
- [x] Update `options/options.css` — new styles: desc, hint, sticky actions, active badge
- [x] Update `sidepanel/sidepanel.html` — dropdown workspace switcher di header
- [x] Update `sidepanel/sidepanel.js` — switcher logic + manage workspaces link ke options
- [x] Validasi syntax semua file

---

## Phase 1A — Settings & Configuration Infrastructure

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 1 | Dokumen Aturan Project (`docs/rule.md`) | ✅ Selesai | Panduan coding convention, struktur folder, security best practices |
| 2 | Dokumen Progress Tracker (`docs/progress.md`) | ✅ Selesai | Tracking progress per module, update setiap selesai kerja |
| 3 | Init Struktur Folder Project & `manifest.json` | ✅ Selesai | Folder & file skeleton sesuai PRD Section 9 |
| 4 | `utils/storage.js` | ✅ Selesai | Encrypted storage helper (AES-256) |
| 5 | `utils/templates-preset.js` | ✅ Selesai | 3 default SOP templates + enums + DoD |
| 6 | `background.js` | ✅ Selesai | Service Worker — onInstalled, storage init |
| 7 | `options/options.html` + `options.css` + `options.js` | ✅ Selesai | Halaman Settings & Template Builder |
| 8 | Plane Connection Ping Tester | ✅ Selesai | Test connection button & validation badges |
| 9 | `sidepanel/sidepanel.html` + `sidepanel.css` + `sidepanel.js` | ✅ Selesai | Dashboard skeleton + search + fetch modal |
| 10 | `utils/plane-api.js` | ✅ Selesai | Plane REST API client + hierarchical batch creation |
| 11 | `assets/icon-{16,48,128}.png` | ✅ Selesai | Placeholder icons |
| 12 | Testing & Packaging | ✅ Selesai | Validasi sintaks + ZIP package created |
| 13 | Multi-Workspace (Phase 1.1) | ✅ Selesai | CRUD workspace + project fetcher + switcher |
| 14 | Template Manager Restore (Phase 1.2) | ✅ Selesai | Kembalikan template CRUD + field builder + modal |

## Phase 1B — Plane Integration & Manual Task Sync

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 1 | Full Tab Dashboard (`app/app.html`) | ✅ Selesai | Migrasi dari sidepanel ke full tab, split layout 2fr 1fr |
| 2 | Create Task by Template (Mode A) | ✅ Selesai | Manual form guided mode di panel kanan |
| 3 | Submit to Plane API | ✅ Selesai | `submitTask()` → `PlaneAPI.createIssue()` + toast + loading |
| 4 | Plane REST API Client (`utils/plane-api.js`) | ✅ Selesai | POST /issues/ & Field Transformer + hierarchical batch |
| 5 | Preview & Interactive Workspace | ✅ Selesai | Batch list cards, expand details, select/delete/submit, clear batch |
| 6 | Hierarchical Sync Engine (UI) | ✅ Selesai | Parent-child dropdown, tree view, + Child button, hierarchical submit |
| 7 | External Search & Fetch Modal (Live) | ✅ Selesai | Better result cards, child import, Enter key, loading state |
| 8 | Direct to Plane (Mode C) | ✅ Selesai | Submit/update issue langsung ke Plane, WYSIWYG editor, multi-select assignees/labels/modules, parent search |

## Phase 1C — AI Intelligence & Auto-Generation Engine

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 1 | AI Provider Integration | ✅ Selesai | `utils/ai-provider.js` — OpenAI, Gemini, Anthropic |
| 2 | Create Task by Requirement (Mode B) | ✅ Selesai | PRD input, AI breakdown, tab mode switching |
| 3 | AI Auto Micro-Task Breakdown | ✅ Selesai | `breakDownPRD()` — built into `ai-provider.js` |
| 4 | SOP Naming Standard Enforcer | ✅ Selesai | Prompt-level enforcement + inline refine |
| 5 | Missing Info Tagging | ✅ Selesai | AI prompt: tag missing info `[PERLU DILENGKAPI PM]` |
| 6 | AI Refine Bar | ✅ Selesai | Per-task refine + bulk refine in batch view |
| 7 | DeepSeek AI Provider | ✅ Selesai | Tambahan provider DeepSeek di options + `_callDeepSeek()` |
