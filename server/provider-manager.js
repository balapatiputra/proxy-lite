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
    this.syncAntigravityRule();
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
    if (this.isAutoModeEnabled()) {
      this.syncAntigravityRule();
    }
    return this.getActiveProvider();
  }

  isAutoModeEnabled() {
    this.ensureFreshConfig();
    return Boolean(this.state.antigravityAutoMode);
  }

  setAutoMode(enabled) {
    this.ensureFreshConfig();
    this.state.antigravityAutoMode = Boolean(enabled);
    this.saveConfig();
    this.syncAntigravityRule();
    return { autoMode: this.state.antigravityAutoMode };
  }

  syncAntigravityRule() {
    const isAuto = this.isAutoModeEnabled();
    const activeProvider = this.getActiveProvider();
    const providerName = activeProvider?.name || 'Provider Aktif';
    const defaultModel = activeProvider?.defaultModel || 'Default Model';

    let content = '';
    if (isAuto) {
      content = `# Proxy-Lite - Mode Otomatis Aktif (Full Proxy Routing)

STATUS: AKTIF (AUTO-ROUTING KE PROXY-LITE)
PROVIDER AKTIF: ${providerName} (${defaultModel})

Aturan ini berlaku ketika plugin \`proxy-lite\` aktif di Antigravity dan sakelar "Mode Otomatis" diaktifkan dari Dashboard Proxy-Lite:

## 1. Eksekusi Otomatis ke Provider Aktif Proxy-Lite (MCP Tool: \`ask_provider\`)
- **Prinsip Utama**: Agen di workspace ini WAJIB selalu patuh dan memproses setiap prompt, instruksi coding, analisis, atau pertanyaan pengguna menggunakan provider yang sedang aktif di Proxy-Lite.
- **Tanpa Awalan Khusus**: Pengguna TIDAK PERLU mengetik \`/proxy\` atau menyebut nama provider/model. Seluruh percakapan otomatis dialihkan ke provider Proxy-Lite.
- Saat berdiskusi, memberikan jawaban, menulis kode, merancang arsitektur, atau mengeksekusi instruksi:
  - **WAJIB** teruskan prompt/tugas pengguna ke model provider aktif melalui tool MCP \`ask_provider\`.
  - Gunakan jawaban dan penalaran dari model provider aktif tersebut sebagai respon utama kepada pengguna.
- Kuota token yang terpakai adalah kuota provider eksternal di Proxy-Lite (${providerName}), kuota akun resmi Antigravity Anda tetap hemat dan aman.

## 2. Manajemen Provider & Tools
- Untuk memeriksa provider dan model yang sedang aktif: gunakan tool \`get_version\` atau \`list_providers\`.
- Untuk melihat model yang tersedia pada endpoint: gunakan tool \`list_provider_models\`.
- Untuk mengganti provider aktif atau default model: gunakan tool \`set_active_provider\`.
- Untuk menguji latensi dan status koneksi: gunakan tool \`test_provider_connection\`.

## 3. Layanan Terbuka untuk Klien Eksternal
- Local OpenAI Proxy Server (\`http://127.0.0.1:5389/v1\`) dan Web Dashboard (\`http://127.0.0.1:5389\`) tetap aktif mandiri dan dapat digunakan oleh aplikasi eksternal (seperti Cursor, Hermes Agent, Codex, dan Aider).
`;
    } else {
      content = `# Proxy-Lite - Mode Standar (Coexistence: Akun Asli & Proxy-Lite On-Demand)

STATUS: NONAKTIF (DEFAULT AKUN RESMI ANTIGRAVITY)

Aturan ini berlaku ketika plugin \`proxy-lite\` aktif di Antigravity dan "Mode Otomatis" dinonaktifkan:

## 1. Arsitektur Coexistence (Dual Quota: Akun Asli & Proxy-Lite)
- **Akun Utama Antigravity**:
  - Secara bawaan (*default*), agen bekerja menggunakan model dan akun resmi Antigravity. Kuota akun Google pengguna berjalan seperti biasa.
- **Opsi Kuota Eksternal (Proxy-Lite)**:
  - Proxy-Lite berfungsi sebagai opsi alternatif / cadangan (*on-demand*).
  - Ketika pengguna meminta untuk menggunakan model/provider Proxy-Lite (misal: *"Gunakan Proxy-Lite"*, *"Pakai model Nalarin"*, *"Gunakan DeepSeek"*, dsb.):
    - Agen **WAJIB** meneruskan penalaran atau prompt tersebut ke model provider aktif melalui tool MCP \`ask_provider\`.
    - Kuota yang berkurang adalah kuota provider eksternal di Proxy-Lite, sementara kuota akun resmi Antigravity tetap hemat dan utuh.

## 2. Manajemen Provider & Tools
- Untuk memeriksa provider dan model yang sedang aktif di Proxy-Lite: gunakan tool \`get_version\` atau \`list_providers\`.
- Untuk melihat model yang tersedia pada endpoint: gunakan tool \`list_provider_models\`.
- Untuk mengganti provider aktif atau default model: gunakan tool \`set_active_provider\`.
- Untuk menguji latensi dan status koneksi: gunakan tool \`test_provider_connection\`.

## 3. Layanan Terbuka untuk Klien Eksternal
- Local OpenAI Proxy Server (\`http://127.0.0.1:5389/v1\`) dan Web Dashboard (\`http://127.0.0.1:5389\`) tetap aktif mandiri dan dapat digunakan oleh aplikasi eksternal (seperti Cursor, Hermes Agent, Codex, dan Aider) kapan pun dibutuhkan tanpa mengganggu Antigravity.
`;
    }

    try {
      // 1. Write local rule
      const localRulePath = path.resolve(__dirname, '../rules/AGENTS.md');
      const localDir = path.dirname(localRulePath);
      if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(localRulePath, content, 'utf8');

      // 2. Sync to ~/.gemini/config/plugins/proxy-lite/rules/AGENTS.md
      const geminiRulePath = path.join(os.homedir(), '.gemini', 'config', 'plugins', 'proxy-lite', 'rules', 'AGENTS.md');
      const geminiDir = path.dirname(geminiRulePath);
      if (!fs.existsSync(geminiDir)) fs.mkdirSync(geminiDir, { recursive: true });
      fs.writeFileSync(geminiRulePath, content, 'utf8');
      return true;
    } catch (err) {
      console.error('[ProviderManager] Failed to sync Antigravity rule:', err.message);
      return false;
    }
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

  resolveModel(requestedModel, provider) {
    if (!requestedModel) {
      return provider.defaultModel || 'gemini-3.8-flash-high';
    }

    const req = requestedModel.trim();
    const lower = req.toLowerCase();
    const isRouter = provider.endpoint && provider.endpoint.includes('router.nalarin.ai');

    // Handle tier shortcuts
    if (lower === 'pro' || lower === 'tier_pro') {
      return isRouter ? 'ag/claude-opus-4-6-thinking' : 'claude-opus-4-6-thinking';
    }
    if (lower === 'flash' || lower === 'tier_flash') {
      return isRouter ? 'ag/gemini-3.8-flash-high' : 'gemini-3.8-flash-high';
    }
    if (lower === 'flash_lite' || lower === 'flashlite' || lower === 'tier_flash_lite') {
      return isRouter ? 'ag/gemini-3.1-flash-lite' : 'gemini-3.1-flash-lite';
    }

    // Antigravity built-in fallback intercept
    const genericGoogleModels = [
      'gemini-pro',
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-2.0-pro-exp',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-8b',
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp'
    ];
    if (genericGoogleModels.includes(lower)) {
      console.log(`[Proxy-Lite Intercept] Mapping built-in model '${req}' to active provider default '${provider.defaultModel}'`);
      return provider.defaultModel || 'gemini-3.8-flash-high';
    }

    // Adjust prefix if target endpoint requires it or doesn't
    if (isRouter && !req.startsWith('ag/') && !req.startsWith('nalarin/')) {
      return `ag/${req}`;
    } else if (!isRouter && req.startsWith('ag/')) {
      return req.replace(/^ag\//, '');
    }

    return req;
  }

  async chatCompletion({
    providerId = null,
    model = null,
    messages,
    systemPrompt = null,
    temperature = 0.7,
    maxTokens = null,
    stream = false,
    tools = null,
    toolChoice = null,
    responseFormat = null,
    extra = {},
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

    const selectedModel = this.resolveModel(model, provider);
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
      stream,
      ...extra
    };
    if (maxTokens) {
      payload.max_tokens = maxTokens;
    }
    if (tools) {
      payload.tools = tools;
    }
    if (toolChoice) {
      payload.tool_choice = toolChoice;
    }
    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    const timeoutSignal = AbortSignal.timeout(60000);
    const combinedSignal = abortSignal 
      ? AbortSignal.any([abortSignal, timeoutSignal]) 
      : timeoutSignal;

    console.log(`[Proxy-Lite] Forwarding to ${provider.name} (${cleanEndpoint}) -> model: ${selectedModel}, stream: ${stream}`);

    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: combinedSignal
    });

    // If model not found or invalid model error, attempt fallback to provider.defaultModel
    if (!response.ok && response.status === 404 && selectedModel !== provider.defaultModel) {
      console.warn(`[Proxy-Lite Fallback] Model '${selectedModel}' not found on upstream. Retrying with defaultModel: '${provider.defaultModel}'`);
      payload.model = provider.defaultModel;
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: combinedSignal
      });
    }

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
