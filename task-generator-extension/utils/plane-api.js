const _PRIORITY_MAP = { Critical: 'urgent', High: 'high', Medium: 'medium', Low: 'low' };

const PlaneAPI = {
  _projectCache: null,

  async _getConfig() {
    const settings = await Storage.getSettingsDecrypted();
    if (!settings || !settings.plane_base_url || !settings.plane_api_key) {
      throw new Error('Plane API not configured.');
    }

    const workspace = settings.workspaces
      ? settings.workspaces.find((w) => w.id === settings.active_workspace_id)
      : null;

    if (!workspace) {
      throw new Error('No active workspace selected.');
    }

    return {
      baseUrl: settings.plane_base_url.replace(/\/+$/, ''),
      apiKey: settings.plane_api_key,
      workspace: workspace.workspace_slug,
      project: workspace.project_id
    };
  },

  async _getProjectMap() {
    if (this._projectCache) return this._projectCache;
    const config = await this._getConfig();
    const projects = await this.getWorkspaceProjects(config.workspace);
    const map = {};
    projects.forEach(p => { map[p.id] = p; });
    this._projectCache = map;
    return map;
  },

  _invalidateProjectCache() {
    this._projectCache = null;
  },

  async getWorkspaceProjects(workspaceSlug) {
    const settings = await Storage.getSettingsDecrypted();
    if (!settings || !settings.plane_base_url || !settings.plane_api_key) {
      throw new Error('Plane API not configured.');
    }

    const baseUrl = settings.plane_base_url.replace(/\/+$/, '');
    const url = `${baseUrl}/api/v1/workspaces/${workspaceSlug}/projects/`;
    const response = await fetch(url, {
      headers: {
        'X-API-Key': settings.plane_api_key,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Fetch projects failed: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || data;
    return results.map((p) => ({
      id: p.id,
      name: p.name,
      identifier: p.identifier
    }));
  },

  async _request(endpoint, options = {}) {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json'
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`Plane API error: ${response.status}`);
    }

    return response.json();
  },

  async ping() {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/users/me/`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' }
    });
    return response.ok;
  },

  _issueCache: null,
  _issueCacheExpiry: 0,

  async _fetchAllIssues() {
    const now = Date.now();
    if (this._issueCache && this._issueCacheExpiry > now) return this._issueCache;

    const config = await this._getConfig();
    const projMap = await this._getProjectMap();

    const params = new URLSearchParams({ per_page: '200' });
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/issues/?${params}`;
    let issues = [];
    try {
      const res = await fetch(url, { headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        issues = data.results || data;
        if (!Array.isArray(issues)) issues = [];
      }
    } catch { issues = []; }

    const ident = (projMap[config.project] && projMap[config.project].identifier) || '';
    const all = issues.map(i => ({ ...i, _projectId: config.project, _projectIdentifier: ident }));

    this._issueCache = all;
    this._issueCacheExpiry = now + 60000;
    return all;
  },

  invalidateIssueCache() {
    this._issueCache = null;
    this._issueCacheExpiry = 0;
  },

  searchIssuesCached(keyword) {
    const lower = (keyword || '').toLowerCase().trim();
    return this._fetchAllIssues().then((all) => {
      if (!lower) return all;
      return all.filter((issue) => {
        if (String(issue.name || '').toLowerCase().includes(lower)) return true;
        if (String(issue.sequence_id || '').toLowerCase().includes(lower)) return true;
        return false;
      });
    });
  },

  async searchIssues(keyword, projectIds) {
    const config = await this._getConfig();
    const projMap = await this._getProjectMap();
    const targets = projectIds || [config.project];
    let allResults = [];

    const numericPart = keyword ? (keyword.match(/(\d+)$/) || [])[1] : null;

    const fetches = targets.map(async (pid) => {
      const params = new URLSearchParams({ per_page: '200' });
      const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${pid}/issues/?${params}`;
      try {
        const res = await fetch(url, { headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' } });
        if (!res.ok) return [];
        const data = await res.json();
        let issues = data.results || data;
        if (!Array.isArray(issues)) return [];

        if (keyword) {
          const lower = keyword.toLowerCase();
          issues = issues.filter((issue) => {
            if (String(issue.name || '').toLowerCase().includes(lower)) return true;
            if (String(issue.sequence_id || '').toLowerCase().includes(lower)) return true;
            if (numericPart && String(issue.sequence_id) === numericPart) return true;
            return false;
          });
        }

        const ident = (projMap[pid] && projMap[pid].identifier) || '';
        return issues.map(i => ({ ...i, _projectId: pid, _projectIdentifier: ident }));
      } catch { return []; }
    });

    const settled = await Promise.all(fetches);
    settled.forEach(batch => { if (batch.length) allResults = allResults.concat(batch); });

    return allResults;
  },

  async getMembers() {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/members/`;
    const response = await fetch(url, {
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[PlaneAPI] getMembers failed:', response.status, url);
      return [];
    }

    const data = await response.json();
    const results = data.results || data;
    return Array.isArray(results) ? results : [];
  },

  async getCycles() {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/cycles/`;
    const response = await fetch(url, {
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[PlaneAPI] getCycles failed:', response.status, url);
      return [];
    }

    const data = await response.json();
    const results = data.results || data;
    return Array.isArray(results) ? results : [];
  },

  async getModules() {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/modules/`;
    const response = await fetch(url, {
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[PlaneAPI] getModules failed:', response.status, url);
      return [];
    }

    const data = await response.json();
    const results = data.results || data;
    return Array.isArray(results) ? results : [];
  },

  async getLabels() {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/labels/`;
    const response = await fetch(url, {
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[PlaneAPI] getLabels failed:', response.status, url);
      return [];
    }

    const data = await response.json();
    const results = data.results || data;
    return Array.isArray(results) ? results : [];
  },

  async getStates() {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/states/`;
    const response = await fetch(url, {
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.warn('[PlaneAPI] getStates failed:', response.status, url);
      return [];
    }

    const data = await response.json();
    const results = data.results || data;
    return Array.isArray(results) ? results : [];
  },

  async getChildIssues(parentId) {
    const data = await this._request(`/issues/?parent=${parentId}`);
    const results = data.results || data;
    return Array.isArray(results) ? results : [];
  },

  async createIssue(payload) {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/issues/`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Create issue failed: ${response.status} — ${errorText}`);
    }

    const result = await response.json();
    return result;
  },

  async updateIssue(issueId, payload) {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/issues/${issueId}/`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Update issue failed: ${response.status} — ${errorText}`);
    }

    const result = await response.json();
    return result;
  },

  async assignCycle(issueId, cycleId) {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/cycles/${cycleId}/cycle-issues/`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ issues: [issueId] })
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn('assignCycle failed:', response.status, text);
    }
    return response.ok;
  },

  async assignModule(issueId, moduleId) {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/modules/${moduleId}/module-issues/`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ issues: [issueId] })
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn('assignModule failed:', response.status, text);
    }
    return response.ok;
  },

  async getEstimatePoints() {
    const config = await this._getConfig();

    try {
      const projUrl = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/`;
      const projRes = await fetch(projUrl, { headers: { 'X-API-Key': config.apiKey } });
      if (projRes.ok) {
        const proj = await projRes.json();
        const estId = proj.estimate;
        if (estId) {
          const estUrl = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/estimates/${estId}/`;
          const estRes = await fetch(estUrl, { headers: { 'X-API-Key': config.apiKey } });
          if (estRes.ok) {
            const data = await estRes.json();
            const pts = data.points || data.results || [];
            if (pts.length > 0) return pts.map(p => ({ id: p.id, key: p.key, value: p.value }));
          }
        }
      }
    } catch (e) { /* ignore */ }

    return [
      { id: '727559bf-46de-4b75-a3fb-ba4ca0f79564', key: 1, value: '1' },
      { id: '03111a34-cad1-441c-b291-80033f600e17', key: 2, value: '2' },
      { id: '2c6603b3-ba27-45d1-b76d-334aec439a70', key: 3, value: '3' },
      { id: 'bc143c9d-d386-4458-b0c7-fb1d480272a2', key: 4, value: '5' },
      { id: '04ad6117-010c-45d4-9fbc-e7a6719ca171', key: 5, value: '8' },
      { id: 'aa175fd2-a19f-41d6-9076-ca68165a9b99', key: 6, value: '13' },
    ];
  },

  async createIssuesBulk(tasks) {
    const config = await this._getConfig();
    const url = `${config.baseUrl}/api/v1/workspaces/${config.workspace}/projects/${config.project}/issues/`;
    const results = [];

    for (const task of tasks) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
        });

        if (!response.ok) {
          results.push({ task, status: 'failed', error: `HTTP ${response.status}` });
        } else {
          results.push({ task, status: 'created', data: await response.json() });
        }
      } catch (err) {
        results.push({ task, status: 'failed', error: err.message });
      }
    }

    return results;
  },

  async createHierarchicalBatch(taskGroups) {
    const createdParents = [];

    const mapPrio = (p) => _PRIORITY_MAP[p] || p?.toLowerCase() || 'medium';

    for (const group of taskGroups) {
      const parentPayload = {
        name: group.parent.full_title || group.parent.title,
        description_html: this._buildDescriptionHtml(group.parent),
        priority: mapPrio(group.parent.priority)
      };

      const parentResult = await this.createIssue(parentPayload);
      const parentId = parentResult.id;

      const childPayloads = group.children.map((child) => ({
        name: child.full_title || child.title,
        description_html: this._buildDescriptionHtml(child),
        priority: mapPrio(child.priority),
        parent: parentId
      }));

      const childResults = await this.createIssuesBulk(childPayloads);

      createdParents.push({
        parent: { data: parentResult, task: group.parent },
        children: childResults.map((r, i) => ({ ...r, task: group.children[i] }))
      });
    }

    return createdParents;
  },

  _buildDescriptionHtml(task) {
    const parts = [];

    if (task.payload?.story) {
      parts.push(`<h3>User Story</h3><p>${this._escapeHtml(task.payload.story)}</p>`);
    }

    if (task.payload?.acceptance_criteria?.length) {
      const items = task.payload.acceptance_criteria.map((ac) => `<li>${this._escapeHtml(ac)}</li>`).join('');
      parts.push(`<h3>Acceptance Criteria</h3><ul>${items}</ul>`);
    }

    if (task.payload?.dod?.length) {
      const items = task.payload.dod.map((d) => `<li>${this._escapeHtml(d)}</li>`).join('');
      parts.push(`<h3>Definition of Done</h3><ul>${items}</ul>`);
    }

    for (const [key, value] of Object.entries(task.payload || {})) {
      if (!['story', 'acceptance_criteria', 'dod'].includes(key) && value) {
        parts.push(`<p><strong>${this._escapeHtml(key)}:</strong> ${this._escapeHtml(String(value))}</p>`);
      }
    }

    return parts.join('\n');
  },

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
