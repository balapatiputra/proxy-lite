const fs = require('fs');
const path = require('path');
const os = require('os');

class ProviderManager {
  constructor(customConfigPath = null) {
    this.configPath = customConfigPath || this.resolveConfigPath();
    this.lastMtime = null;
    this.state = this.loadConfig();
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
        }
      }
    } catch (err) {
      // Continue with current memory state if file read fails transiently
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const stats = fs.statSync(this.configPath);
        this.lastMtime = stats.mtimeMs;
        const raw = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(raw);
      }

      // Check for providers.example.json template
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

    // SSRF protection: block cloud metadata services
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
    if (!maskKeys) return this.state.providers;
    return this.state.providers.map(p => ({
      ...p,
      apiKey: p.apiKey ? `${p.apiKey.slice(0, 4)}...${p.apiKey.slice(-4)}` : ''
    }));
  }

  getProvider(id) {
    this.ensureFreshConfig();
    return this.state.providers.find(p => p.id === id) || null;
  }

  getActiveProvider() {
    this.ensureFreshConfig();
    const active = this.getProvider(this.state.activeProviderId);
    if (active) return active;
    return this.state.providers[0] || null;
  }

  setActiveProvider(id, defaultModel = null) {
    this.ensureFreshConfig();
    const provider = this.getProvider(id);
    if (!provider) {
      throw new Error(`Provider dengan id '${id}' tidak ditemukan`);
    }
    this.state.activeProviderId = id;
    if (defaultModel) {
      provider.defaultModel = defaultModel.trim();
    }
    this.saveConfig();
    return provider;
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
    return providerObj;
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

    // Combine timeout with optional external abort signal
    const timeoutSignal = AbortSignal.timeout(60000); // 60s timeout
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
