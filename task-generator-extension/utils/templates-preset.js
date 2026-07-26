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
