const AIProvider = {
  async _getConfig() {
    const settings = await Storage.getSettingsDecrypted();
    if (!settings || !settings.ai_api_key) {
      throw new Error('AI API Key not configured. Go to Settings.');
    }
    return {
      provider: settings.ai_provider || 'gemini',
      apiKey: settings.ai_api_key,
      systemPrompt: settings.ai_system_prompt || DEFAULT_SYSTEM_PROMPT
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

  async breakDownPRD(prdText, template, customGuidance, options = {}) {
    const prompt = `Break down the following PRD/requirement into structured tasks following the SOP standard.

Template category: ${template?.category || 'General'}
Additional guidance: ${customGuidance || 'None'}

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

const DEFAULT_SYSTEM_PROMPT = `You are an expert Technical Project Manager assistant.
You generate SOP-standard software engineering tasks following strict naming conventions.
Always use Indonesian for user-facing content unless specified otherwise.
Output valid JSON only — no markdown, no backticks, no commentary.`;
