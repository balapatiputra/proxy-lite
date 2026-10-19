const fs = require('fs');
const path = require('path');
const os = require('os');

class ProviderManager {
  constructor(customConfigPath = null) {
    this.loadEnvFile();
    this.configPath = customConfigPath || this.resolveConfigPath();
    this.lastMtime = null;
    this.state = this.loadConfig();
    this.applyEnvFallbacks();
  }

  loadEnvFile() {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
          if (match) {
            const key = match[1].trim();
            let val = match[2] ? match[2].trim() : '';
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch {}
    }
  }

  applyEnvFallbacks() {
    if (!this.state || !Array.isArray(this.state.providers)) return;
    let changed = false;

    for (const provider of this.state.providers) {
      if (!this.isKeyConfigured(provider)) {
        // Check provider-specific or default env vars
        const envKey = process.env.CLIPROXY_API_KEY ||
                       process.env.DEFAULT_API_KEY ||
                       process.env[`${provider.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`];
        if (envKey && envKey.trim()) {
          provider.apiKey = envKey.trim();
          changed = true;
        }
      }
    }

    if (changed) {
      this.saveConfig();
    }
  }

  resolveConfigPath() {
    const localPath = path.resolve(__dirname, '../config/providers.json');
    if (fs.existsSync(localPath)) {
      return localPath;
    }

    const userGeminiPath = path.join(os.homedir(), '.gemini', 'config', 'proxy-lite', 'providers.json');
    if (fs.existsSync(userGeminiPath)) {
      return userGeminiPath;
    }

    const localDir = path.dirname(localPath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return localPath;
  }

  ensureFreshConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const stats = fs.statSync(this.configPath);
        if (this.lastMtime !== stats.mtimeMs) {
          const raw = fs.readFileSync(this.configPath, 'utf8');
          this.state = JSON.parse(raw);
          this.lastMtime = stats.mtimeMs;
          this.applyEnvFallbacks();
        }
      }
    } catch (err) {}
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const stats = fs.statSync(this.configPath);
        this.lastMtime = stats.mtimeMs;
        const raw = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(raw);
      }

      const examplePath = path.resolve(__dirname, '../config/providers.example.json');
      if (fs.existsSync(examplePath)) {
        const rawExample = fs.readFileSync(examplePath, 'utf8');
        const parsed = JSON.parse(rawExample);
        fs.writeFileSync(this.configPath, JSON.stringify(parsed, null, 2), 'utf8');
        const stats = fs.statSync(this.configPath);
        this.lastMtime = stats.mtimeMs;
        return parsed;
      }
    } catch (err) {
      console.error(`[ProviderManager] Failed to read ${this.configPath}:`, err.message);
    }

    return {
      activeProviderId: 'cliproxy-nalarin',
      providers: [
        {
          id: 'cliproxy-nalarin',
          name: 'CLIProxy Nalarin AI',
          endpoint: 'https://cliproxy.nalarin.ai/v1',
          apiKey: '',
          defaultModel: 'gemini-3.8-flash-high',
          enabled: true,
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  saveConfig() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.state, null, 2), 'utf8');
      const stats = fs.statSync(this.configPath);
      this.lastMtime = stats.mtimeMs;
      return true;
    } catch (err) {
      console.error(`[ProviderManager] Failed to save config to ${this.configPath}:`, err.message);
      return false;
    }
  }

  isKeyConfigured(provider) {
    if (!provider || !provider.apiKey) return false;
    const key = provider.apiKey.trim();
    if (!key || key.startsWith('your-') || key.includes('placeholder')) return false;
    return true;
  }

  validateEndpointUrl(endpoint) {
    if (!endpoint || typeof endpoint !== 'string') {
      throw new Error('URL Endpoint harus berupa teks');
    }
    const trimmed = endpoint.trim();
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error('Format URL Endpoint tidak valid (contoh: https://api.openai.com/v1)');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Endpoint harus menggunakan protokol http:// atau https://');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === '169.254.169.254' ||
      hostname === 'metadata.google.internal' ||
      hostname === 'instance-data'
    ) {
      throw new Error('Akses ke cloud metadata diblokir demi keamanan');
    }

    return trimmed.replace(/\/+$/, '');
  }

  getProviders(maskKeys = false) {
    this.ensureFreshConfig();
    return this.state.providers.map(p => {
      const hasKey = this.isKeyConfigured(p);
      return {
        ...p,
        hasKey,
        apiKey: maskKeys 
          ? (hasKey ? `${p.apiKey.slice(0, 4)}...${p.apiKey.slice(-4)}` : '') 
          : p.apiKey
      };
    });
  }

  getProvider(id) {
    this.ensureFreshConfig();
    const p = this.state.providers.find(p => p.id === id) || null;
    if (p) {
      return {
        ...p,
        hasKey: this.isKeyConfigured(p)
      };
    }
    return null;
  }

  getActiveProvider() {
    this.ensureFreshConfig();
    const active = this.getProvider(this.state.activeProviderId) || this.state.providers[0] || null;
    if (active) {
      active.hasKey = this.isKeyConfigured(active);
    }
    return active;
  }

  setActiveProvider(id, defaultModel = null) {
    this.ensureFreshConfig();
    const provider = this.state.providers.find(p => p.id === id);
    if (!provider) {
      throw new Error(`Provider dengan id '${id}' tidak ditemukan`);
    }
    this.state.activeProviderId = id;
    if (defaultModel) {
      provider.defaultModel = defaultModel.trim();
    }
    this.saveConfig();
    return this.getActiveProvider();
  }

  addOrUpdateProvider({ id, name, endpoint, apiKey, defaultModel }) {
    this.ensureFreshConfig();
    if (!name || !endpoint || !apiKey) {
      throw new Error('Nama, endpoint, dan API Key wajib diisi');
    }

    const cleanEndpoint = this.validateEndpointUrl(endpoint);
    const providerId = (id || name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')).trim();

    const existingIndex = this.state.providers.findIndex(p => p.id === providerId);
    const providerObj = {
      id: providerId,
      name: name.trim(),
      endpoint: cleanEndpoint,
      apiKey: apiKey.trim(),
      defaultModel: (defaultModel || 'gemini-3.8-flash-high').trim(),
      enabled: true,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      this.state.providers[existingIndex] = {
        ...this.state.providers[existingIndex],
        ...providerObj
      };
    } else {
      providerObj.createdAt = new Date().toISOString();
      this.state.providers.push(providerObj);
    }

    if (!this.state.activeProviderId) {
      this.state.activeProviderId = providerId;
    }

    this.saveConfig();
    return this.getProvider(providerId);
  }

  deleteProvider(id) {
    this.ensureFreshConfig();
    const initialLen = this.state.providers.length;
    this.state.providers = this.state.providers.filter(p => p.id !== id);
    if (this.state.providers.length === initialLen) {
      throw new Error(`Provider '${id}' tidak ditemukan`);
    }

    if (this.state.activeProviderId === id) {
      this.state.activeProviderId = this.state.providers.length > 0 ? this.state.providers[0].id : null;
    }

    this.saveConfig();
    return true;
  }

  async testConnection(endpoint, apiKey) {
    if (!apiKey || apiKey.startsWith('your-')) {
      return {
        success: false,
        error: 'API Key belum diisi. Masukkan Client API Key Anda terlebih dahulu.'
      };
    }

    const cleanEndpoint = this.validateEndpointUrl(endpoint);
    const start = Date.now();
    const url = `${cleanEndpoint}/models`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          status: response.status,
          latencyMs,
          error: `HTTP ${response.status}: ${text.slice(0, 200)}`
        };
      }

      const data = await response.json();
      const models = Array.isArray(data?.data) ? data.data.map(m => m.id) : [];

      return {
        success: true,
        status: response.status,
        latencyMs,
        modelsCount: models.length,
        models
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err.message
      };
    }
  }

  async fetchModels(providerId = null) {
    this.ensureFreshConfig();
    const provider = providerId ? this.getProvider(providerId) : this.getActiveProvider();
    if (!provider) {
      throw new Error('Tidak ada provider yang aktif atau dipilih');
    }

    if (!provider.hasKey) {
      throw new Error(`API Key untuk ${provider.name} belum diisi. Klik 'Edit' di dashboard untuk memasukkan API Key.`);
    }

    const testRes = await this.testConnection(provider.endpoint, provider.apiKey);
    if (!testRes.success) {
      throw new Error(`Gagal mengambil model dari ${provider.name}: ${testRes.error}`);
    }

    return testRes.models;
  }

  async chatCompletion({
    providerId = null,
    model = null,
    messages,
    systemPrompt = null,
    temperature = 0.7,
    maxTokens = null,
    stream = false,
    abortSignal = null
  }) {
    this.ensureFreshConfig();
    const provider = providerId ? this.getProvider(providerId) : this.getActiveProvider();
    if (!provider) {
      throw new Error('Tidak ada provider aktif ditemukan');
    }

    if (!provider.hasKey) {
      throw new Error(`API Key untuk ${provider.name} belum diisi. Harap masukkan API Key melalui dashboard web.`);
    }

    const selectedModel = model || provider.defaultModel || 'gemini-3.8-flash-high';
    const cleanEndpoint = this.validateEndpointUrl(provider.endpoint);
    const url = `${cleanEndpoint}/chat/completions`;

    const formattedMessages = [];
    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }
    if (Array.isArray(messages)) {
      formattedMessages.push(...messages);
    }

    const payload = {
      model: selectedModel,
      messages: formattedMessages,
      temperature,
      stream
    };
    if (maxTokens) {
      payload.max_tokens = maxTokens;
    }

    const timeoutSignal = AbortSignal.timeout(60000);
    const combinedSignal = abortSignal 
      ? AbortSignal.any([abortSignal, timeoutSignal]) 
      : timeoutSignal;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: combinedSignal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upstream ${provider.name} error (${response.status}): ${errText.slice(0, 300)}`);
    }

    if (stream) {
      return response.body;
    }

    return await response.json();
  }
}

module.exports = ProviderManager;
