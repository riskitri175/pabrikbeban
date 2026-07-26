chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.get('settings', (result) => {
      if (!result.settings) {
        const defaultSettings = {
          target_tool: 'plane',
          plane_base_url: 'https://app.plane.so',
          plane_api_key: '',
          ai_provider: 'gemini',
          ai_api_key: '',
          workspaces: [],
          active_workspace_id: ''
        };
        chrome.storage.local.set({ settings: defaultSettings });
      }
    });

    chrome.storage.local.get('templates', (result) => {
      if (!result.templates || result.templates.length === 0) {
        const defaultTemplates = [
          {
            id: 'tpl_backend_api',
            name: 'Backend API Implementation',
            category: 'Backend API',
            fields: [
              { key: 'endpoint', label: 'API Endpoint', type: 'text', constraint: 'mandatory' },
              { key: 'http_method', label: 'HTTP Method', type: 'dropdown', constraint: 'mandatory', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }
            ]
          },
          {
            id: 'tpl_ui_ux',
            name: 'UI/UX Slicing',
            category: 'UI/UX Slicing',
            fields: [
              { key: 'figma_link', label: 'Figma Link', type: 'url', constraint: 'mandatory' },
              { key: 'responsive_scope', label: 'Responsive Scope', type: 'dropdown', constraint: 'mandatory', options: ['Mobile', 'Tablet', 'Desktop', 'All'] }
            ]
          },
          {
            id: 'tpl_bug_fix',
            name: 'Bug Fix / Adjustment',
            category: 'General',
            fields: [
              { key: 'reproduction_steps', label: 'Reproduction Steps', type: 'rich_text', constraint: 'mandatory' },
              { key: 'expected_behavior', label: 'Expected Behavior', type: 'text', constraint: 'mandatory' },
              { key: 'actual_behavior', label: 'Actual Behavior', type: 'text', constraint: 'mandatory' }
            ]
          }
        ];
        chrome.storage.local.set({ templates: defaultTemplates });
      }
    });

    chrome.runtime.openOptionsPage();
  }
});
