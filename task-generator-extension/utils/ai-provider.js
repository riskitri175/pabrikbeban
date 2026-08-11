const AIProvider = {
  async _getConfig() {
    const settings = await Storage.getSettingsDecrypted();
    if (!settings || !settings.ai_api_key) {
      throw new Error('AI API Key not configured. Go to Settings.');
    }
    return {
      provider: settings.ai_provider || 'gemini',
      apiKey: settings.ai_api_key,
      systemPrompt: DEFAULT_SYSTEM_PROMPT
    };
  },

  async generate(prompt, options = {}) {
    const config = await this._getConfig();
    const systemPrompt = options.systemPrompt || config.systemPrompt;

    switch (config.provider) {
      case 'openai':
        return this._callOpenAI(prompt, systemPrompt, config.apiKey);
      case 'gemini':
        return this._callGemini(prompt, systemPrompt, config.apiKey);
      case 'anthropic':
        return this._callAnthropic(prompt, systemPrompt, config.apiKey);
      case 'deepseek':
        return this._callDeepSeek(prompt, systemPrompt, config.apiKey);
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  },

  async _callOpenAI(prompt, systemPrompt, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  },

  async _callGemini(prompt, systemPrompt, apiKey) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  },

  async _callAnthropic(prompt, systemPrompt, apiKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    return data.content[0].text;
  },

  async _callDeepSeek(prompt, systemPrompt, apiKey) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DeepSeek error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  },

  async refine(task, instruction, options = {}) {
    const prompt = `Task: "${task.full_title || task.title}"

Current details:
Story: ${task.payload?.story || '—'}
Acceptance Criteria:
${(task.payload?.acceptance_criteria || []).map((ac, i) => `${i + 1}. ${ac}`).join('\n') || '—'}
Definition of Done:
${(task.payload?.dod || []).map((d, i) => `${i + 1}. ${d}`).join('\n') || '—'}

Refine instruction: ${instruction}

Please return the updated task in this EXACT JSON format (no markdown, no backticks):
{
  "story": "updated story",
  "acceptance_criteria": ["item1", "item2"],
  "dod": ["item1", "item2"],
  "title": "updated title (without bracket)"
}`;

    const raw = await this.generate(prompt, options);
    return this._parseJSON(raw);
  },

  async refineBulk(tasks, instruction, options = {}) {
    const taskSummaries = tasks.map((t, i) =>
      `Task ${i + 1}: "${t.full_title || t.title}"\nStory: ${(t.payload?.story || '').slice(0, 100)}`
    ).join('\n\n');

    const prompt = `I have ${tasks.length} tasks:\n\n${taskSummaries}\n\nRefine instruction: ${instruction}\n\nApply this instruction to all tasks. Return the updated tasks as a JSON array in the same order.`;
    const raw = await this.generate(prompt, options);
    return this._parseJSON(raw);
  },

  _buildSharedPromptLayers(template, userGuidance) {
    let sections = '';
    if (template?.aiInstruction) {
      sections += `=== TEMPLATE AI INSTRUCTION ===\n${template.aiInstruction}\n\n`;
    }
    if (userGuidance) {
      sections += `=== USER GUIDANCE ===\n${userGuidance}\n\n`;
    }
    return sections;
  },

  async breakDownPRD(prdText, template, customGuidance, options = {}) {
    const sharedLayers = this._buildSharedPromptLayers(template, customGuidance);
    const prompt = `${sharedLayers}Break down the following PRD/requirement into structured tasks following the SOP standard.

PRD:
"""
${prdText}
"""

For each task, determine:
1. Bracket ([BE], [FE], [API], [DB], [UI], [UX], [TEST], [RESEARCH], [DOC], [ADJUSTMENT])
2. Severity (P0, P1, P2, P3, -)
3. Priority (Critical, High, Medium, Low)
4. Action + Object title (max 120 chars, no brackets)
5. User story (As a user...)
6. Acceptance criteria (min 2-5 items)
7. Definition of Done checklist

IMPORTANT RULES:
- Each task must be a single responsibility micro-task
- Title format MUST be: [BRACKET] [Severity][Priority] Action Object
- If information is missing, add [PERLU DILENGKAPI PM] or [ASUMSI] tags
- Tasks should cover all layers needed (backend, frontend, DB, testing, docs)

Return ONLY a valid JSON array (no markdown, no backticks):
[
  {
    "bracket": "BE",
    "severity": "P1",
    "priority": "High",
    "title": "Create Voucher Redemption API",
    "story": "As a user, I want to...",
    "acceptance_criteria": ["...", "..."],
    "dod": ["Unit Test Coverage > 80%", "..."]
  }
]`;

    const raw = await this.generate(prompt, options);
    return this._parseJSON(raw);
  },

  _parseJSON(raw) {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    }
    return JSON.parse(cleaned);
  }
};

const DEFAULT_SYSTEM_PROMPT = `Anda adalah asisten Technical Project Manager (TPM) yang ahli dalam memecah requirement teknis menjadi task-task engineering yang terstandarisasi SOP.

Anda HARUS mengikuti aturan berikut:

## 1. NAMING CONVENTION
- Format title HARUS: [BRACKET] [Severity][Priority] Action + Object
- BRACKET yang valid: BE, FE, ME, API, DB, TEST, RESEARCH, UX, UI, DOC, ADJUSTMENT, BUG, HOTFIX, REFACTOR, OPTIMIZATION, SECURITY, DEPLOY, MONITORING, INTEGRATION, CONFIG, SUPPORT, TASK
- Severity: P0 (critical), P1 (high), P2 (medium), P3 (low), - (not applicable)
- Priority: Critical, High, Medium, Low
- Action + Object max 120 karakter, tanpa bracket, to the point (contoh: "Create Voucher Redemption API")

## 2. SINGLE RESPONSIBILITY
- Setiap task HARUS mencakup SATU tanggung jawab saja (single responsibility micro-task)
- Contoh: "CRUD Voucher" HARUS dipecah menjadi: Create Voucher, Read/List Voucher, Update Voucher, Delete Voucher
- Jangan menggabungkan backend dan frontend dalam satu task
- Jangan menggabungkan API dan slicing dalam satu task

## 3. BREAKDOWN RULES
- Pisahkan requirement berdasarkan layer: Backend API, Database/Slicing, Frontend consume, Testing, Dokumentasi
- Parent task = layer backend/database; Child task = frontend consume
- Min 2 task, max 8 task per generate
- Jika requirement menyebutkan CRUD → minimal 4 task (C, R, U, D)

## 4. ACCEPTANCE CRITERIA (AC)
- Minimal 2 item, maksimal 5 item per task
- Fokus pada behavior/hasil yang bisa diverifikasi
- Gunakan bahasa: "Pengguna dapat..." atau "Sistem berhasil..."

## 5. DEFINITION OF DONE (DoD)
- Minimal 4 item per task
- Wajib mencakup: self-tested, code reviewed, no regression
- Tambahkan item spesifik sesuai bracket:
  - BE: Unit Test > 80%, API Doc, Error Handling
  - FE: Cross-browser, Responsive, No Console Error
  - DB: Migration tested, Indexing, Rollback
  - UI: Design match, Accessibility

## 6. OUTPUT FORMAT
- WAJIB output valid JSON array — tanpa markdown, tanpa backticks, tanpa teks tambahan
- Jangan tambahkan komentar atau penjelasan apapun di luar JSON
- Gunakan bahasa Indonesia untuk story, AC, dan DoD

## 7. MISSING INFO
- Jika informasi requirement kurang, tambahkan tag [PERLU DILENGKAPI PM] pada bagian yang kurang
- Jika ada asumsi yang dibuat, tambahkan tag [ASUMSI] dengan penjelasan`;
