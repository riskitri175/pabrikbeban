# **Product Requirement Document (PRD)**

## **AI-Assisted Task Generator & Multi-Tool Sync Engine**

**Form Factor:** Google Chrome Extension (Manifest V3 \- Unpacked Distribution, Full Tab + Popup)

### **Document Control & Metadata**

| Property | Detail |
| :---- | :---- |
| **Document Version** | v1.3.0 (Master Unified Document \- Priority & Local ZIP Distribution) |
| **Status** | Approved for Development Handoff |
| **Author / Roles** | Professional Project Manager & Solution Architect |
| **Form Factor** | Google Chrome Extension (Side Panel API & Options Page) |
| **Distribution Method** | Client-Only Local Build (ZIP Package / Load Unpacked Developer Mode) |
| **Target Integration** | Plane API (Phase 1), Extensible to Jira & Linear (Phase 2\) |
| **SOP Reference** | Dokumen "Panduan Pembuatan Task" |

## **1\. Executive Summary & Objective**

### **1.1 Latar Belakang**

Pembuatan tiket/task teknis rekayasa perangkat lunak yang mematuhi standar SOP (Bracket, Severity/Priority, Single Responsibility/Micro-tasks, DoD, Metadata, Technical Reference) membutuhkan waktu dan ketelitian tinggi. Miskomunikasi antar-tim sering terjadi jika detail task kurang memadai.

### **1.2 Form Factor Rationale (Mengapa Chrome Extension?)**

Mengubah tools ini menjadi Google Chrome Extension memberikan keuntungan UI/UX yang sangat efisien. **Full Tab View (`app/app.html`)** menjadi interface utama dengan split layout `2fr 1fr` — dashboard task di kiri dan panel create task di kanan. **Popup** (`popup/popup.html`) sebagai beranda cepat untuk membuka Full Tab atau Settings.

### **1.3 Objective Utama**

* **Memangkas Waktu Tasking:** Mengurangi waktu pembuatan backlog/task hingga **70–80%** dari requirement mentah.  
* **Standarisasi Otomatis:** Memastikan **100%** task yang dihasilkan mematuhi aturan baku pada dokumen "Panduan Pembuatan Task".  
* **Interactive Editing & Review:** Menyediakan ruang preview interaktif untuk peninjauan, pengeditan manual/AI, serta penyuntingan massal (*bulk*) sebelum task resmi terbuat di Plane.  
* **Bi-directional Sync:** Terintegrasi langsung dengan Plane API untuk pembuatan, pencarian, penarikan (*fetch tree hierarchy*), dan pembaruan task secara langsung.

## **2\. System Architecture & Component Design**

Plaintext  
\+-----------------------------------------------------------------------------------+  
|                     CHROME EXTENSION MANIFEST V3 ARCHITECTURE                     |  
\+-----------------------------------------------------------------------------------+  
|                                                                                   |  
|  \[ POPUP \] (chrome-extension://.../popup/popup.html) \- Floating Popup            |  
|  ├─► Tombol "Buka Task Generator" → opens Full Tab                                |  
|  └─► Tombol "Settings" → opens Options Page                                       |  
|                                                                                   |  
|  \[ FULL TAB \] (chrome-extension://.../app/app.html) \- Main Workspace (2fr 1fr)   |  
|  ├─► LEFT PANEL (2/3): Dashboard + Search + Batch View                            |  
|  │   ├─► Workspace Selector + Refresh                                              |  
|  │   ├─► Search / Batch tab toggle                                                |  
|  │   ├─► Task search & filter (search Plane)                                      |  
|  │   ├─► Batch list: cards, checkbox, expand/collapse, select all, delete, submit |  
|  │   ├─► AI Refine bar (per-task & bulk)                                          |  
|  │   ├─► External Search & Fetch Modal (import existing Plane tasks)              |  
|  │   └─► Footer actions: Fetch External, Submit, AI Refine, Delete, Clear         |  
|  │                                                                                 |  
|  └─► RIGHT PANEL (1/3): Create Task (3 modes)                                     |  
|      ├─► Mode A: By Template (Manual form guided)                                  |  
|      ├─► Mode B: By Requirement (AI breakdown)                                    |  
|      └─► Mode C: Direct to Plane (WYSIWYG editor, multi-select, parent search)    |  
|                                                                                   |  
|  \[ OPTIONS PAGE \] (chrome-extension://.../options/options.html) \- Settings Tab   |  
|  ├─► API Settings: Plane (base URL, API key, test connection)                     |  
|  ├─► AI Provider: OpenAI / Gemini / Anthropic / DeepSeek                          |  
|  ├─► Multi-Workspace Manager: CRUD workspace + fetch projects from Plane          |  
|  ├─► Template Manager: list, add, edit, delete template + dynamic field builder   |  
|  └─► Connection test buttons + validation badges                                  |  
|                                                                                   |  
|  \[ SIDE PANEL \] (chrome-extension://.../sidepanel/sidepanel.html) \- Legacy View  |  
|  └─► Side panel view (dipertahankan untuk kompatibilitas)                         |  
|                                                                                   |  
|  \[ LOCAL & ENCRYPTED STORAGE \] (chrome.storage.local)                             |  
|  └─► Storage lokal terenkripsi (AES-256) untuk Token API, Templates, Draft Tasks  |  
\+-----------------------------------------------------------------------------------+

## **3\. User Personas & Access Control**

| Persona | Deskripsi Peran | Hak Akses & Tanggung Jawab |
| :---- | :---- | :---- |
| **Admin / Lead PM / SA** | Mengatur arsitektur sistem, membuat/mengonfigurasi template task, serta mengatur kredensial API. | Mengelola Template Builder, Field Constraints, System Prompt Rules, & API Integration Settings via options.html. |
| **Operational PM / BA** | Menyusun task harian, menginput requirement, mengarahkan instruksi AI, merevisi, dan mengirim task ke Plane. | Memilih Template, Input PRD, Trigger AI Generator, Preview & Inline Edit, Bulk Submit to Plane via sidepanel.html. |

## **4\. End-to-End User Flow**

### **Phase 0: Installation, Setup & Template Management via options.html**

\[ Unzip File Extension \] ──► \[ Load Unpacked di chrome://extensions \] ──► \[ Klik Extension → Popup \] ──► \[ Buka Settings → Options Page \] ──► \[ Input Kredensial API (Plane & AI) \] ──► \[ Set Custom Template \] ──► \[ Kelola Multi-Workspace \]

### **Phase 1: Operational Task Generation & Sync Flow via Full Tab (app/app.html)**

Plaintext  
\[ Klik Extension → Popup → "Buka Task Generator" \]  
                  │  
                  ▼  
             \[ FULL TAB: Split Layout \]  
          ┌───────────────────┬──────────────────────┐  
          │  LEFT PANEL (2/3) │  RIGHT PANEL (1/3)   │  
          │                   │                      │  
          │  Toolbar:         │  Mode tabs:          │  
          │  ┌──────┬──────┐  │  ┌────┬────┬────┐   │  
          │  │Search│Batch │  │  │Direct│Tmpl│AI│   │  
          │  └──────┴──────┘  │  └────┴────┴────┘   │  
          │                   │                      │  
          │  Search View:     │  Mode A: By Template │  
          │  - Cari task Plane│  - Pilih template    │  
          │  - Filter status  │  - Isi form dinamis  │  
          │                   │  - Submit to Plane   │  
          │  Batch View:      │                      │  
          │  - Task cards     │  Mode B: By AI       │  
          │  - Expand/edit    │  - Paste PRD         │  
          │  - Bulk refine AI │  - AI breakdown      │  
          │  - Submit/Delete  │  - Review & edit     │  
          │                   │                      │  
          │  Fetch Modal:     │  Mode C: Direct      │  
          │  - Search Plane   │  - WYSIWYG editor    │  
          │  - Import task    │  - Assignees/labels  │  
          │  - Include child  │  - Parent search     │  
          │                   │  - Submit/Update     │  
          └───────────────────┴──────────────────────┘

## **5\. Detail Spesifikasi Halaman, Field Input, & Aturan Validasi**

### **Halaman 1: Settings & Template Builder (options.html / Full Tab View)**

*Halaman tempat mengatur integrasi API dan membangun struktur template task secara dinamis.*

| Section | Nama Field / Elemen | Tipe Component | Status | Pilihan Option / Scope | Validasi & Rule |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **API Settings** | Target Management Tool | Dropdown | Mandatory | Plane (Phase 1), Jira, Linear | Default: **Plane**. |
|  | Plane Base URL | Text Input | Mandatory | Default: \[https://app.plane.so\](https://app.plane.so) | Harus berformat URL valid (https://). |
|  | Plane API Key / Token | Password Input | Mandatory | Teks terenkripsi (Masked ••••) | Token akses API Plane. |
|  | Test Connection Button | Action Button | Action | Trigger Ping Request | Menampilkan badge **Connected** (Hijau) jika sukses, **Failed** (Merah) jika error. |
|  | AI Provider | Dropdown | Mandatory | OpenAI, Google Gemini, Anthropic, DeepSeek | Provider AI yang digunakan. |
|  | AI API Key | Password Input | Mandatory | Teks terenkripsi (Masked ••••) | Wajib diisi untuk modul AI. Memiliki tombol *Test AI Connection*. |
| **Template Manager** | Template List | Data Table | System | List of Templates | Menampilkan nama, kategori, dan tombol Action (Edit/Delete). |
|  | Button "Add Template" | Primary Button | Action | Open Builder Modal | Membuka Form Builder Template Baru. |
|  | Template Name | Text Input | Mandatory | Max 50 karakter | Harus unik, tidak boleh sama dengan template lain. |
|  | Category Domain | Dropdown | Mandatory | Research, UI/UX Slicing, Backend API, Integration, General | Domain kategori pengerjaan. |
| **Dynamic Field Builder** | Repeater Form | Mandatory | Min. 1 field | Menyusun atribut field custom. |  |
|  | ↳ Field Label | Text Input | Mandatory | Max 50 karakter | Label tampilan UI (cth: Link Figma). |
|  | ↳ Field Key | Text Input | Mandatory | Auto-slugify (snake\_case) | Unik di dalam template yang sama (^\[a-z0-9\_\]+$). |
|  | ↳ Input Type | Dropdown | Mandatory | Text, Rich Text, Dropdown, Checkbox List, URL | Tipe data elemen form. |
|  | ↳ Constraint | Dropdown | Mandatory | Mandatory, Optional, AI-Generated, Fixed Input | Aturan pengisian data. |

### **Halaman 2: Main Dashboard Extension (sidepanel.html \- Default View)**

*Tampilan awal panel samping saat icon extension diklik.*

| Nama Field / Elemen | Tipe Component | Status | Pilihan Option / Scope | Deskripsi, Behavior, & Validasi |
| :---- | :---- | :---- | :---- | :---- |
| **Workspace Header** | Info Badge / Bar | System | Fetched from Plane API | Menampilkan nama Workspace & Project Plane yang sedang aktif. |
| **Search Bar Task** | Text Input \+ Icon | Optional | Min. 3 karakter | Pencarian task di Plane berdasarkan Keyword atau Issue Key (cth: PROJ-123). |
| **Filter Status / Epic** | Dropdown Filter | Optional | Fetched from Plane API | Memfilter tampilan task berdasarkan status atau Epic. |
| **Task Data Table** | Data Table | System | Table Component | **State Awal (Kosong):** Menampilkan ilustrasi empty state \+ teks *"Belum ada task. Klik Create Task untuk memulai."*  **State Terisi:** Menampilkan daftar task (Issue Key, Title, Priority, Status, Actions). |
| **Button "Create Task"** | Primary CTA Button | Action | Redirects to Create Page | Membuka Halaman Create Task. |
| **Button "Fetch External"** | Secondary Icon Button | Action | Opens Search Modal | Membuka modal pencarian dan penarikan task dari Plane. |

### **Halaman 3: Halaman Create Task (app.html \- Right Panel)**

*Menyediakan tiga opsi pembuatan task melalui Tab Navigation Toggle.*

#### **Tab Mode A: Create Task by Template (Manual / Guided Form)**

*Digunakan jika PM ingin mengisi form task secara terstruktur satu per satu secara manual.*

| Nama Field / Elemen | Tipe Component | Status | Validasi & Rule |
| :---- | :---- | :---- | :---- |
| **Select Template** | Dropdown Selector | Mandatory | Memilih template target (cth: *Backend API Template*). |
| **Dynamic Form Render** | Auto-Generated Form | Dynamic | Form otomatis me-render field sesuai settingan template terpilih (Judul, Priority, Story, Acceptance Criteria, Endpoint, dll). |
| **Button "Preview Task"** | Primary Button | Action | Mengompilasi form input menjadi item task dan berpindah ke Halaman Preview. |

#### **Tab Mode B: Create Task by Requirement (AI Automatic Breakdown)**

*Digunakan jika PM ingin menempelkan (paste) requirement/PRD mentah dan membiarkan AI memecahnya menjadi micro-tasks terstruktur.*

| Nama Field / Elemen | Tipe Component | Status | Validasi & Rule |
| :---- | :---- | :---- | :---- |
| **Select Template** | Dropdown Selector | Mandatory (Pre-Condition) | Memilih template acuan aturan untuk AI. Wajib dipilih sebelum input PRD aktif. |
| **PRD / Requirement Text** | Rich Text / Textarea | Mandatory | Minimal 50 karakter. Tempat menempelkan deskripsi kebutuhan fitur. |
| **Include Page Content** | Toggle Switch | Optional | Jika True, extension otomatis membaca teks pilihan pada tab browser yang sedang dibuka. |
| **AI Custom Guidance** | Textarea | Optional | Max 300 karakter. Catatan instruksi khusus untuk AI (cth: *"Pecah task khusus untuk tim Mobile saja"*). |
| **Button "Generate with AI"** | Primary Button (AI Icon) | Action | Memicu AI Engine. State: Loading (Skeleton Screen & Progress Bar). Membuka Halaman Preview. |

#### **Tab Mode C: Direct to Plane**

*Digunakan jika PM ingin langsung membuat issue ke Plane tanpa melalui template/AI workflow.*

| Nama Field / Elemen | Tipe Component | Status | Validasi & Rule |
| :---- | :---- | :---- | :---- |
| **Title** | Text Input | Mandatory | Max 200 karakter. Judul issue. |
| **Description** | Rich Text / ContentEditable | Optional | WYSIWYG editor dengan toolbar (bold, italic, list, heading, link, table). |
| **State** | Dropdown | Optional | Daftar state dari Plane API (Backlog, Todo, In Progress, Done, dll). |
| **Priority** | Dropdown | Optional | Urgent, High, Medium, Low. |
| **Cycle** | Dropdown | Optional | Daftar cycle/sprint dari Plane API. |
| **Assignees** | Multi-Select Checkbox List | Optional | Memilih assignee dari member Plane. |
| **Labels** | Multi-Select Checkbox List | Optional | Memilih label dari Plane. |
| **Modules** | Multi-Select Checkbox List | Optional | Memilih module/epic dari Plane. |
| **Parent Task** | Autocomplete Search Input | Optional | Cari parent task dari Plane berdasarkan nama/key. Dropdown hasil pencarian. |
| **Start Date** | Date Picker | Optional | Tanggal mulai pengerjaan. |
| **Target Date** | Date Picker | Optional | Tanggal target selesai. |
| **Estimate Points** | Dropdown | Optional | Story points dari Plane. |
| **Button "Submit to Plane"** | Primary Button | Action | Submit issue ke Plane API. State: loading + disabled. Setelah sukses: reset form + toast. |

### **Halaman 4: Preview & Interactive Workspace (app.html \- Batch View)**

*Workspace krusial tempat meninjau, mengedit, memicu AI refinement, dan memilih task sebelum dikirim ke Plane.*

| Section | Nama Field / Elemen | Tipe Component | Status | Validasi & Rule |
| :---- | :---- | :---- | :---- | :---- |
| **Navigation** | Task Tree Breakdown | Accordion / Tree View | System | Visualisasi hirarki Parent Task (Epic) dan Child Micro-Tasks. |
|  | Node Selection Checkbox | Checkbox per Node | Optional | Memilih task untuk dikirim atau diabaikan (Mendukung Select All). |
| **Task Editor** | Bracket Category | Dropdown | Mandatory | Choices: \[BE\], \[FE\], \[ME\], \[API\], \[DB\], \[TEST\], \[RESEARCH\], \[UX\], \[UI\], \[DOC\], \[ADJUSTMENT\], dll. |
|  | Severity | Dropdown | Mandatory | Choices: P0, P1, P2, P3, \-. |
|  | Priority | Dropdown | Mandatory | Choices: Critical, High, Medium, Low. |
|  | Action \+ Object Title | Text Input | Mandatory | Max 120 karakter. Teks judul tanpa bracket (cth: *Fix Duplicate Point Calculation*). |
|  | Full Generated Title | ReadOnly Badge | System | Format SOP: \[BRACKET\] \[Severity\]\[Priority\] Action \+ Object. |
|  | Requirement Story | Rich Text Editor | Mandatory | Penjelasan cerita pengguna (*As a user...*). |
|  | Acceptance Criteria | Repeater List | Mandatory | Min. 1 item checklist kriteria keterterimaan. |
|  | Definition of Done (DoD) | Checkbox List | Mandatory | Auto-populated checklist sesuai tipe Bracket. |
|  | Warning Badge Alert | Yellow Badge Alert | System | Muncul jika terdapat tag \[PERLU DILENGKAPI PM\] atau \[ASUMSI\] pada task. |
| **AI Refine** | Per-Task / Bulk AI Bar | Text Input \+ Send Icon | Optional | Mengirimkan prompt revisi ke AI (cth: *"Tambahkan validasi rate limiting dan test case security pada task ini"*). |
| **Actions** | Button "Submit Selected" | Success Primary Button | Action | Mengirim task terpilih ke Plane API. State: Submitting... $\\rightarrow$ Toast Success. |
|  | Button "Save Draft" | Secondary Button | Action | Menyimpan task di chrome.storage.local tanpa mengirim ke Plane. |

### **Halaman 5: Search & Fetch External Task View (app.html \- Modal Search)**

*Modal / drawer yang digunakan untuk mencari task eksisting di Plane, menarik hirarki task tersebut ke workspace extension, lalu mengeditnya.*

| Nama Field / Elemen | Tipe Component | Status | Validasi & Rule |
| :---- | :---- | :---- | :---- |
| **Search Keyword / Key** | Text Input | Mandatory | Min. 3 karakter atau format Issue Key valid (^\[A-Z0-9\]+-\[0-9\]+$). |
| **Include Child Tasks** | Toggle Switch | Optional | Default: True. Otomatis menarik seluruh subtask di bawahnya. |
| **Search Result List** | Data Table List | System | Menampilkan daftar task (Key, Title, Status, Priority). |
| **Button "Import to Workspace"** | Secondary Button | Action | Memindahkan task eksisting dari Plane ke Preview Workspace untuk diedit/ditambahi subtask. |

## **6\. Functional Requirements Matrix**

| Module ID | Feature Name | Description & SOP Rule Alignment | Priority Execution Phase |
| :---- | :---- | :---- | :---- |
| **FR-TMP-01** | Dynamic Template Builder | Admin dapat membuat template custom (Core & Specific Fields) via Options Page. | **Phase 1A ✅** |
| **FR-TMP-02** | Preserved SOP Presets | Extension menyediakan preset template baku sesuai dokumen "Panduan Pembuatan Task". | **Phase 1A ✅** |
| **FR-INT-01** | Plane API Integration | Mengirim task terpilih (individual/bulk) ke Plane API menggunakan REST API Transformer. | **Phase 1B ✅** |
| **FR-PRV-01** | Visual Tree Hierarchy View | Menampilkan struktur Parent Epic dan Child Micro-Tasks dalam tampilan Tree View. | **Phase 1B ✅** |
| **FR-PRV-02** | Direct Inline Manual Editor | PM dapat mengubah teks, metadata, priority, atau isi field apa pun secara langsung di preview. | **Phase 1B ✅** |
| **FR-SRCH-01** | External Task Search & Fetch | Mencari dan menarik hirarki task eksisting di Plane ke workspace extension untuk diperbarui. | **Phase 1B ✅** |
| **FR-DIR-01** | Direct to Plane Issue | Membuat issue langsung ke Plane tanpa template/AI — WYSIWYG, assignees, labels, modules, parent search. | **Phase 1B ✅** |
| **FR-GEN-01** | Requirement Payload Input | PM dapat menempelkan PRD atau mengambil teks dari tab aktif Chrome. | **Phase 1C ✅** |
| **FR-GEN-02** | Auto Micro-Task Breakdown | AI otomatis memecah 1 PRD menjadi beberapa micro-task (>2-3 hari, multi-team, beda layer). | **Phase 1C ✅** |
| **FR-GEN-03** | SOP Naming Standard Enforcer | AI wajib menghasilkan judul berformat: [BRACKET] [Severity][Priority] Action + Object. | **Phase 1C ✅** |
| **FR-GEN-04** | Missing Info Tagging | AI wajib memberi tag [ASUMSI] atau [PERLU DILENGKAPI PM] pada informasi yang kurang. | **Phase 1C ✅** |
| **FR-PRV-03** | AI-Assisted Editing (Bulk/Single) | PM dapat memberikan prompt revisi ke AI pada 1 task atau beberapa task terpilih sekaligus. | **Phase 1C ✅** |
| **FR-AI-01** | DeepSeek AI Provider | Dukungan provider DeepSeek sebagai opsi AI keempat selain OpenAI, Gemini, Anthropic. | **Phase 1C ✅** |

## **7\. Non-Functional Requirements (NFR)**

* **NFR-PERF-01 (AI Breakdown Speed):** Eksekusi AI breakdown dari 1 PRD menjadi 5–10 micro-tasks terstruktur tidak boleh melebihi **15 detik**.  
* **NFR-PERF-02 (Batch Push Speed):** Eksekusi bulk submission 20 task ke Plane API harus selesai dalam **\< 5 detik** menggunakan asynchronous batching.  
* **NFR-SEC-01 (Encrypted Storage):** Kredensial rahasia (AI API Key & Plane API Token) wajib disimpan terenkripsi (AES-256) pada chrome.storage.local.  
* **NFR-UX-01 (Responsive Layout):** Antarmuka Full Tab dioptimalkan dengan split layout **2fr 1fr** (min. 380px per panel), tata letak collapsible accordion di batch view.  
* **NFR-RELIABILITY-01 (Retry & Rollback):** Jika koneksi terputus saat bulk submit, sistem menandai task yang gagal dan menyediakan tombol **Retry Failed Tasks**.

## **8\. Technical Solution Architecture & Data Model**

### **8.1 Data Model Scheme (chrome.storage.local)**

JSON  
{  
  "settings": {  
    "target\_tool": "plane",  
    "plane\_base\_url": "https://app.plane.so",  
    "plane\_api\_key": "enc\_aes256\_...",  
    "ai\_provider": "gemini",  
    "ai\_api\_key": "enc\_aes256\_...",  
    "workspaces": \[  
      {  
        "id": "ws\_1721812345",  
        "name": "My Company",  
        "workspace\_slug": "my-workspace",  
        "project\_id": "proj-uuid-123",  
        "project\_name": "Project Alpha"  
      }  
    \],  
    "active\_workspace\_id": "ws\_1721812345"  
  },  
  "templates": \[  
    {  
      "id": "tpl\_backend\_api",  
      "name": "Backend API Implementation",  
      "category": "Backend API",  
      "fields": \[  
        { "key": "endpoint", "label": "API Endpoint", "type": "text", "constraint": "mandatory" },  
        { "key": "http\_method", "label": "HTTP Method", "type": "dropdown", "options": \["GET", "POST", "PUT", "DELETE"\] }  
      \]  
    }  
  \],  
  "active\_workspace\_batch": {  
    "batch\_id": "batch\_98765",  
    "source\_prd": "Fitur Voucher Redemption...",  
    "tasks": \[  
      {  
        "id": "task\_tmp\_1",  
        "parent\_id": null,  
        "bracket": "BE",  
        "severity": "P1",  
        "priority": "High",  
        "title": "Create Voucher Redemption API",  
        "full\_title": "\[BE\] \[P1\]\[High\] Create Voucher Redemption API",  
        "is\_selected": true,  
        "payload": {  
          "story": "Sebagai pengguna...",  
          "acceptance\_criteria": \["Voucher berkurang", "Histori tersimpan"\],  
          "endpoint": "POST /api/v1/voucher/redeem"  
        },  
        "sync\_status": "draft"  
      }  
    \]  
  }  
}

### **8.2 Plane REST API Payload & Endpoint Specification**

Dalam ekosistem Plane, entitas *task* direpresentasikan sebagai **Issue** yang berada di bawah hierarki Workspace \-\> Project.

#### **HTTP Endpoint Details**

* **Method:** POST  
* **URL Format:** https://{plane\_base\_url}/api/v1/workspaces/{workspace\_slug}/projects/{project\_id}/issues/  
* **Headers:**  
* HTTP

X-API-Key: \<API\_KEY\_USER\>  
Content-Type: application/json

*   
* 

#### **Complete JSON Payload Structure**

JSON  
{  
  "name": "\[BE\] \[P1\]\[High\] Create Voucher Redemption API",  
  "description\_html": "\<h3\>User Story\</h3\>\<p\>As a user, I want to redeem voucher...\</p\>\<h3\>Acceptance Criteria\</h3\>\<ul\>\<li\>Voucher berkurang\</li\>\<li\>Histori tersimpan\</li\>\</ul\>\<h3\>Definition of Done\</h3\>\<ul\>\<li\>\[x\] Unit Test Coverage \> 80%\</li\>\<li\>\[x\] API Doc Updated\</li\>\</ul\>",  
  "priority": "high",  
  "state": "\<STATE\_UUID\_FOR\_TODO\>",  
  "parent": "\<PARENT\_ISSUE\_UUID\>",  
  "assignees": \["\<USER\_UUID\_1\>"\],  
  "labels": \["\<LABEL\_UUID\_1\>"\],  
  "module": "\<MODULE\_UUID\>",  
  "sprint": "\<CYCLE\_UUID\>",  
  "estimate\_point": 3  
}

### **8.3 Field Mapping Transformer (To Plane API)**

| Generator / Extension Field | Plane API Field | Value Transformer & Mapping Logic | Status Context |
| :---- | :---- | :---- | :---- |
| **Full Title** | name | Concat format SOP: \[BRACKET\] \[Severity\]\[Priority\] Action \+ Object | Mandatory |
| **Content Sections** | description\_html | Gabungan User Story, Acceptance Criteria, DoD Checklist, & Specific Fields (cth: Endpoint/Figma) yang di-render menjadi HTML terstruktur (\<h3\>, \<ul\>, \<li\>, \<pre\>). | Mandatory |
| **Priority** | priority | Direct enum mapping (lowercase): urgent, high, medium, low, none. | Mandatory |
| **Task State** | state | UUID dari State Target di Plane (cth: *Backlog*, *Todo*, atau *In Progress*). Default: State UUID *Todo/Backlog*. | Optional / Default |
| **Parent Reference** | parent | UUID dari Parent Issue (digunakan untuk membentuk hirarki Parent-Child). null jika task tersebut adalah Epic/Parent utama. | Conditional |
| **Assignees** | assignees | Array of User UUIDs (\["\<USER\_UUID\>"\]) yang akan ditugaskan. | Optional |
| **Labels** | labels | Array of Label UUIDs (\["\<LABEL\_UUID\>"\]) untuk kategorisasi tambahan. | Optional |
| **Epic / Feature Module** | module | Module UUID di Plane untuk mengelompokkan task ke Epic/Fitur tertentu. | Optional |
| **Sprint / Cycle** | sprint | Cycle/Sprint UUID di Plane untuk perencanaan iterasi pengerjaan. | Optional |
| **Estimate Points** | estimate\_point | Numeric Point / Story Point jika fitur *Estimates* diaktifkan pada instance Plane. | Optional |

### **8.4 Hierarchical Task Creation & Sync Execution Flow**

Plaintext  
\[ START BATCH SUBMIT \]  
          │  
          ▼  
┌────────────────────────────────────────────────────────┐  
│ STEP 1: CREATE PARENT TASKS                            │  
│ Send POST Request for Parent Task (parent \= null)     │  
└─────────────────────────┬──────────────────────────────┘  
                          │  
                          ▼  
┌────────────────────────────────────────────────────────┐  
│ STEP 2: RECEIVE RESPONSE & EXTRACT PARENT ID           │  
│ Extract \`id\` (UUID) from Plane REST API Response Payload│  
└─────────────────────────┬──────────────────────────────┘  
                          │  
                          ▼  
┌────────────────────────────────────────────────────────┐  
│ STEP 3: CREATE CHILD TASKS (ASYNC BATCHING)            │  
│ Set "parent": "\<PARENT\_UUID\_STEP\_2\>"                   │  
│ Send Async POST Requests for all Child Tasks           │  
└─────────────────────────┬──────────────────────────────┘  
                          │  
                          ▼  
\[ COMPLETE \- TOAST NOTIFICATION & UPDATE DRAFT STATUS \]

## **9\. Distribution, Local Storage & Onboarding Strategy**

### **9.1 Client-Only Execution Model & ZIP Distribution**

* **Distribution Method:** Aplikasi di-build menjadi satu folder distribusi statis yang dicompress menjadi file .zip. User menginstal extension melalui menu chrome://extensions dengan mengaktifkan **Developer mode** dan mengklik **Load unpacked**.  
* **Zero Backend Infrastructure:** Seluruh proses komunikasi ke Plane API dan AI Provider dieksekusi secara langsung (*direct fetch*) dari background script/sidepanel browser user ke endpoint target.  
* **Data Isolation:** chrome.storage.local mengisolasi seluruh data (API Keys, Plane URL, Draft Tasks, Custom Template) di dalam profile browser user masing-masing.

### **9.2 Default SOP Presets (First-Time Installation)**

Agar user yang baru menginstal tidak kebingungan membuat template dari nol, sistem menyediakan **Pre-configured SOP Templates** yang otomatis terinjeksi ke chrome.storage.local saat extension pertama kali diinstal (*Event Listener:* chrome.runtime.onInstalled).

Template bawaan ini mencakup:

1. **Backend API Template** (Core fields: Endpoint, HTTP Method, Query/Body Params).  
2. **UI/UX Slicing Template** (Core fields: Figma Link, Responsive Scope, Component Tree).  
3. **Bug Fix / Adjustment Template** (Core fields: Reproduction Steps, Expected vs Actual Behavior).

### **9.3 First-Time User Onboarding Flow**

Plaintext  
\[ User Load Unpacked Extension (ZIP / Developer Mode) \]  
                          │  
                          ▼  
        \[ Event: chrome.runtime.onInstalled \]  
         ├── Injeksi Default Templates ke Storage Local  
         └── Buka Otomatis Options Page (\`options.html\`)  
                          │  
                          ▼  
        \[ Onboarding Banner / Setup Wizard \]  
         ├── Step 1: Input Plane Base URL & API Key ──► \[ Klik "Test Connection" \]  
         ├── Step 2: Input AI API Key (Optional)    ──► \[ Klik "Test AI Connection" \]  
         └─► Step 3: Siap Digunakan\! Redirect ke Side Panel.

## **10\. Revised Release Roadmap**

Roadmap pengembangan kini dibagi menjadi 3 iterasi berdasarkan prioritas teknis yang disepakati:

Plaintext  
┌───────────────────────────────────────────────────────────────────────────┐  
│ PHASE 1A: SETTINGS & CONFIGURATION INFRASTRUCTURE (SPRINT 1\)             │  
├───────────────────────────────────────────────────────────────────────────┤  
│ ├── Extension Options Page (\`options.html\` Full Tab View)                │  
│ ├── Local Encrypted Storage Engine (\`chrome.storage.local\` \+ AES-256)     │  
│ ├── Plane API Settings (Base URL, API Token, Workspace/Project Mapping)   │  
│ ├── Plane Connection Ping Tester Button & Validation Badges               │  
│ ├── Onboarding First-Time Setup Wizard (\`chrome.runtime.onInstalled\`)     │  
│ └── Dynamic Template Builder UI & SOP Presets Local Storage               │  
└───────────────────────────────────────────────────────────────────────────┘  
                                     │  
                                     ▼  
┌───────────────────────────────────────────────────────────────────────────┐  
│ PHASE 1B: PLANE INTEGRATION & MANUAL TASK SYNC (SPRINT 2\)                 │  
├───────────────────────────────────────────────────────────────────────────┤  
│ ├── Extension Side Panel Dashboard (\`sidepanel.html\` UI Skeleton)         │  
│ ├── Create Task Mode A: By Template (Manual Form Guided Mode)             │  
│ ├── Preview & Interactive Workspace (Manual Inline Editor & Checkboxes)   │  
│ ├── Plane REST API Client Adapter (\`POST /issues/\` & Field Transformer)   │  
│ ├── Hierarchical Parent-Child Sequential Sync Engine (2-Step Batching)    │  
│ └── External Search & Fetch Modal (Import/Update Task Existing Plane)     │  
└───────────────────────────────────────────────────────────────────────────┘  
                                     │  
                                     ▼  
┌───────────────────────────────────────────────────────────────────────────┐  
│ PHASE 1C: AI INTELLIGENCE & AUTO-GENERATION ENGINE (SPRINT 3\)             │  
├───────────────────────────────────────────────────────────────────────────┤  
│ ├── AI Provider Integration Settings (OpenAI, Gemini, Anthropic API)     │  
│ ├── Create Task Mode B: By Requirement (PRD Raw Input Form)               │  
│ ├── AI Automatic Micro-Task Breakdown Logic                               │  
│ ├── SOP Naming Standard Enforcer (\`\[BRACKET\] \[Severity\]\[Priority\]\`)       │  
│ ├── Missing Info Tagging (\`\[ASUMSI\]\` & \`\[PERLU DILENGKAPI PM\]\`)           │  
│ └── Interactive Workspace AI Refine Bar (Bulk/Single Task Prompting)      │  
└───────────────────────────────────────────────────────────────────────────┘

### **Persiapan Struktur Kode (Project Folder Structure)**

Untuk memulai eksekusi **Phase 1A (Settings & Configuration Infrastructure)**, kita akan menyiapkan struktur folder project Chrome Extension Manifest V3 seperti berikut:

Plaintext  
task-generator-extension/  
├── manifest.json                 \# Manifest V3 Configuration  
├── background.js                 \# Service Worker (Install Event & Storage Init)  
├── assets/                       \# Extension Icons & Static Media  
│   ├── icon-16.png  
│   ├── icon-48.png  
│   └── icon-128.png  
├── app/                          \# Main Workspace UI (Full Tab, split layout 2fr 1fr)  
│   ├── app.html  
│   ├── app.css  
│   └── app.js  
├── popup/                        \# Popup Beranda (floating popup)  
│   ├── popup.html  
│   ├── popup.css  
│   └── popup.js  
├── options/                      \# Settings & Template Builder (Full Tab)  
│   ├── options.html  
│   ├── options.css  
│   └── options.js  
├── sidepanel/                    \# Legacy Side Panel View (dipertahankan)  
│   ├── sidepanel.html  
│   ├── sidepanel.css  
│   └── sidepanel.js  
└── utils/                        \# Reusable Modules & API Adapters  
    ├── storage.js                \# Encrypted Local Storage Helper (AES-256)  
    ├── plane-api.js              \# Plane REST API Client (+ hierarchical batch)  
    ├── templates-preset.js       \# Pre-configured SOP Templates  
    └── ai-provider.js            \# AI Provider Service (OpenAI, Gemini, Anthropic, DeepSeek)

### **Draft Awal manifest.json (Manifest V3)**

JSON  
{  
  "manifest\_version": 3,  
  "name": "AI Task Generator & Multi-Tool Sync",  
  "version": "1.3.0",  
  "description": "Generate SOP-standard tasks and sync directly to Plane API.",  
  "permissions": \[  
    "storage",  
    "activeTab",  
    "scripting"  
  \],  
  "host\_permissions": \[  
    "https://\*/\*"  
  \],  
  "background": {  
    "service\_worker": "background.js"  
  },  
  "action": {  
    "default\_title": "AI Task Generator",  
    "default\_popup": "popup/popup.html"  
  },  
  "options\_page": "options/options.html",  
  "icons": {  
    "16": "assets/icon-16.png",  
    "48": "assets/icon-48.png",  
    "128": "assets/icon-128.png"  
  }  
}

### **Status Terkini**

| Phase | Status | Modul |
|-------|--------|-------|
| **Phase 1A** | ✅ Selesai | Settings, Storage, Templates, Options Page, Multi-Workspace |
| **Phase 1B** | ✅ Selesai | Full Tab, Mode A (Template), Mode C (Direct), Batch View, Search & Fetch, Submit ke Plane, Hierarchical Sync |
| **Phase 1C** | ✅ Selesai | AI Provider (OpenAI/Gemini/Anthropic/DeepSeek), Mode B (AI Breakdown), SOP Enforcer, Missing Info Tagging, AI Refine Bar |

