const STORAGE_KEYS = {
  SETTINGS: 'settings',
  TEMPLATES: 'templates',
  ACTIVE_WORKSPACE_BATCH: 'active_workspace_batch'
};

const AES_BASE_KEY = 'pabrikbeban-aes-v1';
const AES_KEY = AES_BASE_KEY + (typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : '');

async function getKeyMaterial() {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(AES_KEY.padEnd(32, '0').slice(0, 32)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
}

async function deriveKey(keyMaterial, salt) {
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-CBC', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function encrypt(plaintext) {
  const keyMaterial = await getKeyMaterial();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(keyMaterial, salt);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    encoder.encode(plaintext)
  );

  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return arrayBufferToBase64(combined.buffer);
}

async function decrypt(ciphertext) {
  try {
    const combined = new Uint8Array(base64ToArrayBuffer(ciphertext));
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 32);
    const encrypted = combined.slice(32);

    const keyMaterial = await getKeyMaterial();
    const key = await deriveKey(keyMaterial, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    return null;
  }
}

const Storage = {
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key]);
      });
    });
  },

  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },

  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  },

  async getSettings() {
    return this.get(STORAGE_KEYS.SETTINGS);
  },

  async saveSettings(settings) {
    const settingsClone = { ...settings };

    if (settingsClone.plane_api_key) {
      settingsClone.plane_api_key = await encrypt(settingsClone.plane_api_key);
    }
    if (settingsClone.ai_api_key) {
      settingsClone.ai_api_key = await encrypt(settingsClone.ai_api_key);
    }

    return this.set(STORAGE_KEYS.SETTINGS, settingsClone);
  },

  async getSettingsDecrypted() {
    const settings = await this.get(STORAGE_KEYS.SETTINGS);
    if (!settings) return null;

    const decrypted = { ...settings };

    if (decrypted.plane_api_key) {
      const decryptedKey = await decrypt(decrypted.plane_api_key);
      if (decryptedKey !== null) decrypted.plane_api_key = decryptedKey;
    }
    if (decrypted.ai_api_key) {
      const decryptedKey = await decrypt(decrypted.ai_api_key);
      if (decryptedKey !== null) decrypted.ai_api_key = decryptedKey;
    }

    return decrypted;
  },

  async getActiveWorkspace() {
    const settings = await this.get(STORAGE_KEYS.SETTINGS);
    if (!settings || !settings.workspaces || !settings.active_workspace_id) return null;
    return settings.workspaces.find((w) => w.id === settings.active_workspace_id) || null;
  },

  async setActiveWorkspace(workspaceId) {
    const settings = await this.get(STORAGE_KEYS.SETTINGS);
    if (!settings) return;
    settings.active_workspace_id = workspaceId;
    await this.set(STORAGE_KEYS.SETTINGS, settings);
  },

  async getTemplates() {
    return this.get(STORAGE_KEYS.TEMPLATES);
  },

  async saveTemplates(templates) {
    return this.set(STORAGE_KEYS.TEMPLATES, templates);
  },

  async getActiveBatch() {
    return this.get(STORAGE_KEYS.ACTIVE_WORKSPACE_BATCH);
  },

  async saveActiveBatch(batch) {
    return this.set(STORAGE_KEYS.ACTIVE_WORKSPACE_BATCH, batch);
  },

  async clearActiveBatch() {
    return this.remove(STORAGE_KEYS.ACTIVE_WORKSPACE_BATCH);
  }
};
