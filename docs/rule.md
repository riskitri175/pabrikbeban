# Aturan Pengerjaan Project — AI Task Generator & Multi-Tool Sync Engine

## Tech Stack
- **Form Factor:** Google Chrome Extension (Manifest V3)
- **UI:** Vanilla HTML + CSS + JavaScript (No framework, no bundler, no npm)
- **Storage:** chrome.storage.local — AES-256 untuk kredensial rahasia
- **API Integration:** Plane REST API, AI Provider (OpenAI / Gemini / Anthropic / DeepSeek)
- **Version Control:** Git

## Struktur Folder
```
task-generator-extension/
├── manifest.json
├── background.js
├── assets/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── app/                          # Main UI (Full Tab, 2fr 1fr)
│   ├── app.html
│   ├── app.css
│   └── app.js
├── popup/                        # Popup beranda
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                      # Settings & Template Builder
│   ├── options.html
│   ├── options.css
│   └── options.js
├── sidepanel/                    # Legacy (dipertahankan)
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
└── utils/
    ├── storage.js                # AES-256 encrypted storage
    ├── plane-api.js              # Plane REST API client
    ├── templates-preset.js       # SOP template presets
    └── ai-provider.js            # AI provider service
```

## Code Convention

### JavaScript
- camelCase untuk variabel & fungsi
- PascalCase untuk class / constructor
- CONSTANT_CASE untuk konstanta global
- Gunakan `const` dan `let`, hindari `var`
- 2 spasi indentasi

### CSS
- BEM naming convention (Block__Element--Modifier)
- Selector lowercase dengan kebab-case

### Storage Keys (chrome.storage.local)
- snake_case untuk semua key: `settings`, `templates`, `active_workspace_batch`

### File & Folder Naming
- lowercase dengan kebab-case: `plane-api.js`, `templates-preset.js`
- Satu folder per modul utama (`options/`, `sidepanel/`, `utils/`)

## Commit Convention
```
[Phase-1A] feat: menambahkan storage helper dengan AES-256
[Phase-1A] fix: memperbaiki validasi URL Plane
[Phase-1B] chore: update struktur folder sidepanel
```

## Development Flow
1. Kerjakan module sesuai urutan Phase di Roadmap (PRD Section 10)
2. Update `docs/progress.md` setiap kali menyelesaikan satu module
3. Setiap ada perubahan/tambahan rencana, selalu update `docs/Requirement.md` agar tetap sinkron
4. Test di Chrome dengan Load Unpacked sebelum lanjut ke module berikutnya
5. Jangan gunakan dependency eksternal — semua pure vanilla JS

## Security Rules
- API Key & Token WAJIB dienkripsi AES-256 sebelum disimpan di chrome.storage.local
- Jangan pernah log kredensial ke console
- Jangan kirim kredensial ke third-party selain endpoint yang dikonfigurasi user
- `host_permissions` dibatasi ke `https://*/*` (minimal scope untuk Plane & AI API)

## Phase Roadmap
| Phase | Fokus | Status |
|-------|-------|--------|
| 1A | Settings & Configuration Infrastructure | ✅ Selesai |
| 1B | Plane Integration & Manual Task Sync (incl. Direct to Plane) | ✅ Selesai |
| 1C | AI Intelligence & Auto-Generation Engine | ✅ Selesai |
