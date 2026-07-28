const SOP_TEMPLATES = [
  {
    id: 'tpl_backend_api',
    name: 'Backend API Implementation',
    category: 'Backend API',
    fields: [
      { key: 'endpoint', label: 'API Endpoint', type: 'text', constraint: 'mandatory' },
      { key: 'http_method', label: 'HTTP Method', type: 'dropdown', constraint: 'mandatory', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      { key: 'request_body', label: 'Request Body / Params', type: 'rich_text', constraint: 'optional' },
      { key: 'response_format', label: 'Expected Response Format', type: 'text', constraint: 'optional' }
    ]
  },
  {
    id: 'tpl_ui_ux',
    name: 'UI/UX Slicing',
    category: 'UI/UX Slicing',
    fields: [
      { key: 'figma_link', label: 'Figma Link', type: 'url', constraint: 'mandatory' },
      { key: 'responsive_scope', label: 'Responsive Scope', type: 'dropdown', constraint: 'mandatory', options: ['Mobile', 'Tablet', 'Desktop', 'All'] },
      { key: 'component_tree', label: 'Component Tree', type: 'text', constraint: 'optional' }
    ]
  },
  {
    id: 'tpl_bug_fix',
    name: 'Bug Fix / Adjustment',
    category: 'General',
    fields: [
      { key: 'reproduction_steps', label: 'Reproduction Steps', type: 'rich_text', constraint: 'mandatory' },
      { key: 'expected_behavior', label: 'Expected Behavior', type: 'text', constraint: 'mandatory' },
      { key: 'actual_behavior', label: 'Actual Behavior', type: 'text', constraint: 'mandatory' },
      { key: 'environment', label: 'Environment', type: 'text', constraint: 'optional' }
    ]
  }
];

const BRACKET_OPTIONS = ['BE', 'FE', 'ME', 'API', 'DB', 'TEST', 'RESEARCH', 'UX', 'UI', 'DOC', 'ADJUSTMENT'];

const BRACKET_OPTIONS_FULL = [
  { value: 'RESEARCH', label: 'Research', description: 'Melakukan analisis kebutuhan, studi kelayakan, atau evaluasi solusi sebelum proses development dimulai.' },
  { value: 'DISCUSSION', label: 'Discussion', description: 'Melakukan diskusi lintas divisi untuk memperoleh keputusan atau klarifikasi requirement.' },
  { value: 'MEETING', label: 'Meeting', description: 'Kegiatan meeting seperti Sprint Planning, Grooming, Refinement, Review, Retrospective, UAT, atau Kick Off.' },
  { value: 'PRD', label: 'Product Requirement', description: 'Membuat atau memperbarui PRD, BRD, FSD, maupun requirement bisnis.' },
  { value: 'UX', label: 'UX Design', description: 'Menyusun user flow, wireframe, customer journey, atau pengalaman pengguna.' },
  { value: 'UI', label: 'UI Design', description: 'Membuat atau memperbarui desain antarmuka pengguna.' },
  { value: 'API', label: 'API Design', description: 'Mendesain spesifikasi API, endpoint, request, response, dan kontrak integrasi sebelum implementasi.' },
  { value: 'BE', label: 'Backend Development', description: 'Mengembangkan logika backend, service, repository, endpoint API, scheduler, maupun business process.' },
  { value: 'FE', label: 'Frontend Development', description: 'Mengembangkan antarmuka web serta integrasi dengan backend.' },
  { value: 'ME', label: 'Mobile Development', description: 'Mengembangkan aplikasi Android atau iOS beserta integrasi API.' },
  { value: 'DB', label: 'Database', description: 'Membuat atau mengubah struktur database, migration, indexing, maupun stored procedure.' },
  { value: 'INTEGRATION', label: 'Integration', description: 'Integrasi dengan layanan atau sistem eksternal seperti payment gateway, WhatsApp API, Firebase, dan lainnya.' },
  { value: 'CONFIG', label: 'Configuration', description: 'Konfigurasi server, environment, deployment, feature flag, atau konfigurasi aplikasi.' },
  { value: 'TEST', label: 'Testing', description: 'Melakukan SIT, UAT, regression test, performance test, maupun functional testing.' },
  { value: 'BUG', label: 'Bug Fix', description: 'Memperbaiki defect yang ditemukan pada proses development, QA, maupun UAT.' },
  { value: 'HOTFIX', label: 'Hotfix', description: 'Perbaikan bug kritikal pada environment production yang membutuhkan penanganan segera.' },
  { value: 'REFACTOR', label: 'Refactor', description: 'Merapikan atau menyederhanakan struktur kode tanpa mengubah fungsionalitas sistem.' },
  { value: 'OPTIMIZATION', label: 'Optimization', description: 'Meningkatkan performa aplikasi, query database, penggunaan memori, maupun proses bisnis.' },
  { value: 'SECURITY', label: 'Security', description: 'Implementasi atau perbaikan terkait autentikasi, otorisasi, enkripsi, maupun kerentanan keamanan.' },
  { value: 'DOC', label: 'Documentation', description: 'Membuat atau memperbarui dokumentasi seperti API Documentation, User Guide, Release Note, atau Technical Documentation.' },
  { value: 'DEPLOY', label: 'Deployment', description: 'Deployment ke Development, Staging, atau Production.' },
  { value: 'MONITORING', label: 'Monitoring', description: 'Monitoring aplikasi setelah deployment, validasi log, performa, dan stabilitas sistem.' },
  { value: 'SUPPORT', label: 'Support', description: 'Aktivitas support terhadap user, client, maupun tim internal yang tidak termasuk bug fixing atau development.' },
  { value: 'TASK', label: 'General Task', description: 'Digunakan untuk pekerjaan umum yang tidak termasuk dalam kategori di atas.' },
  { value: 'ADJUSTMENT', label: 'Adjustment Fitur', description: 'Pengerjaan suatu fitur atau aturan yang tidak terdefinisikan atau tidak terpikirkan di aturan atau requirement namun harus tetap ikut dalam pengerjaan/release.' },
  { value: 'PRIORITY', label: 'Priority', description: 'Menandai tingkat prioritas pengerjaan task berdasarkan urgensi dan dampak terhadap project.' },
  { value: 'SEVERITY', label: 'Severity', description: 'Menandai tingkat keparahan issue atau bug yang mempengaruhi fungsionalitas sistem.' }
];

const SEVERITY_OPTIONS = ['P0', 'P1', 'P2', 'P3', '-'];

const PRIORITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];

const DOD_CHECKLISTS = {
  BE: [
    'Unit Test Coverage > 80%',
    'API Doc Updated',
    'Error Handling Implemented',
    'No Memory Leaks',
    'Code Reviewed'
  ],
  FE: [
    'Cross-browser Testing Done',
    'Responsive Verified',
    'Performance Checked (Lighthouse)',
    'No Console Errors',
    'Code Reviewed'
  ],
  UX: [
    'Design Reviewed by PM',
    'User Flow Verified',
    'Accessibility Checked',
    'Prototype Signed Off'
  ],
  GENERAL: [
    'Self-Tested',
    'Code Reviewed',
    'No Regression',
    'PR Description Filled'
  ]
};

function getDoDForBracket(bracket) {
  return DOD_CHECKLISTS[bracket] || DOD_CHECKLISTS.GENERAL;
}
