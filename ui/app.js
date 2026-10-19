const API_BASE = window.location.origin;

// State
let providersState = [];
let activeProviderId = null;
let authToken = localStorage.getItem('proxy_token') || '';

// DOM Elements
const activeStatusText = document.getElementById('active-status-text');
const btnRefresh = document.getElementById('btn-refresh');
const btnLogout = document.getElementById('btn-logout');
const activeProviderName = document.getElementById('active-provider-name');
const activeProviderEndpoint = document.getElementById('active-provider-endpoint');
const selectActiveModel = document.getElementById('select-active-model');
const btnReloadModels = document.getElementById('btn-reload-models');
const btnTestActive = document.getElementById('btn-test-active');
const testActiveResult = document.getElementById('test-active-result');
const providerList = document.getElementById('provider-list');

// Playground Elements
const playgroundPrompt = document.getElementById('playground-prompt');
const btnSendPrompt = document.getElementById('btn-send-prompt');
const btnClearPlayground = document.getElementById('btn-clear-playground');
const playgroundSpinner = document.getElementById('playground-spinner');
const playgroundResponse = document.getElementById('playground-response');
const responseStats = document.getElementById('response-stats');
const btnCopyResponse = document.getElementById('btn-copy-response');

// Integration Card Elements
const textProxyUrl = document.getElementById('text-proxy-url');
const btnCopyProxyUrl = document.getElementById('btn-copy-proxy-url');
const textProxyKey = document.getElementById('text-proxy-key');
const btnCopyProxyKey = document.getElementById('btn-copy-proxy-key');
const btnRotateProxyKey = document.getElementById('btn-rotate-proxy-key');
const toast = document.getElementById('toast');
const keyWarningBanner = document.getElementById('key-warning-banner');
const btnFixKey = document.getElementById('btn-fix-key');

// Provider Modal Elements
const modal = document.getElementById('modal-provider');
const btnOpenModal = document.getElementById('btn-open-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const formProvider = document.getElementById('form-provider');
const modalTitle = document.getElementById('modal-title');
const inputProviderId = document.getElementById('input-provider-id');
const inputProviderName = document.getElementById('input-provider-name');
const inputProviderEndpoint = document.getElementById('input-provider-endpoint');
const inputProviderKey = document.getElementById('input-provider-key');
const inputProviderModel = document.getElementById('input-provider-model');
const btnToggleKey = document.getElementById('btn-toggle-key');
const btnModalTest = document.getElementById('btn-modal-test');
const modalTestResult = document.getElementById('modal-test-result');

// Auth Modal Elements
const modalAuth = document.getElementById('modal-auth');
const formAuth = document.getElementById('form-auth');
const authModalTitle = document.getElementById('auth-modal-title');
const authModalSubtitle = document.getElementById('auth-modal-subtitle');
const inputAuthPassword = document.getElementById('input-auth-password');
const groupAuthConfirm = document.getElementById('group-auth-confirm');
const inputAuthConfirm = document.getElementById('input-auth-confirm');
const btnAuthSubmit = document.getElementById('btn-auth-submit');
const authErrorBox = document.getElementById('auth-error-box');

// Preset Templates
const PRESETS = {
  cliproxy: {
    name: 'CLIProxy Nalarin AI',
    endpoint: 'https://cliproxy.nalarin.ai/v1',
    model: 'gemini-3.8-flash-high'
  },
  deepseek: {
    name: 'DeepSeek API',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat'
  },
  openai: {
    name: 'OpenAI API',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o'
  },
  openrouter: {
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.0-flash-001'
  },
  ollama: {
    name: 'Ollama (Lokal)',
    endpoint: 'http://127.0.0.1:11434/v1',
    model: 'llama3.2'
  }
};

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2200);
}

function copyToClipboard(text, label = 'Teks') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} disalin ke clipboard!`);
    }).catch(() => fallbackCopy(text, label));
  } else {
    fallbackCopy(text, label);
  }
}

function fallbackCopy(text, label) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(`${label} disalin!`);
}

// Authenticated Fetch Helper
async function authFetch(url, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    const data = await response.clone().json().catch(() => ({}));
    if (data.requiresAuth) {
      authToken = '';
      localStorage.removeItem('proxy_token');
      showAuthModal(data.isConfigured);
      throw new Error('Sesi telah berakhir. Harap login kembali.');
    }
  }

  return response;
}

// Initial Load
async function init() {
  try {
    bindEvents();
  } catch (err) {
    console.error('Error binding events:', err);
  }

  try {
    loadAppVersion();
  } catch (err) {
    console.error('Error loading app version:', err);
  }

  try {
    await checkAuthAndLoad();
  } catch (err) {
    console.error('Error loading auth and data:', err);
  }
}

async function loadAppVersion() {
  try {
    const res = await fetch(`${API_BASE}/healthz`);
    if (res.ok) {
      const data = await res.json();
      const el = document.getElementById('app-version');
      if (el && data.version) {
        el.textContent = `v${data.version}`;
      }
    }
  } catch {}
}

async function checkAuthAndLoad() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/status`, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    });
    const status = await res.json();

    if (!status.isConfigured) {
      showAuthModal(false);
      return;
    }

    if (!status.isAuthenticated) {
      showAuthModal(true);
      return;
    }

    hideAuthModal();
    await refreshData();
  } catch (err) {
    console.error('Failed to check auth status:', err);
    activeStatusText.textContent = 'Server Offline';
  }
}

function showAuthModal(isConfigured) {
  modalAuth.classList.remove('hidden');
  authErrorBox.classList.add('hidden');
  formAuth.reset();

  if (!isConfigured) {
    authModalTitle.textContent = 'Setup Master Password';
    authModalSubtitle.textContent = 'Buat password master untuk mengamankan dashboard ini pertama kali.';
    groupAuthConfirm.classList.remove('hidden');
    inputAuthConfirm.required = true;
    btnAuthSubmit.textContent = 'Simpan & Aktifkan Keamanan';
  } else {
    authModalTitle.textContent = 'Dashboard Terkunci';
    authModalSubtitle.textContent = 'Masukkan Master Password Anda untuk membuka.';
    groupAuthConfirm.classList.add('hidden');
    inputAuthConfirm.required = false;
    btnAuthSubmit.textContent = 'Buka Dashboard';
  }
  inputAuthPassword.focus();
}

function hideAuthModal() {
  modalAuth.classList.add('hidden');
}

function bindEvents() {
  btnRefresh.addEventListener('click', refreshData);
  btnReloadModels.addEventListener('click', loadModelsForActiveProvider);
  btnTestActive.addEventListener('click', testActiveProvider);
  btnSendPrompt.addEventListener('click', handlePlaygroundSubmit);

  btnClearPlayground.addEventListener('click', () => {
    playgroundPrompt.value = '';
    playgroundResponse.innerHTML = '<span class="text-placeholder">Hasil respon model akan tampil di sini...</span>';
    responseStats.textContent = '';
    playgroundPrompt.focus();
  });

  btnCopyResponse.addEventListener('click', () => {
    const text = playgroundResponse.textContent.trim();
    if (text && !text.includes('Hasil respon model')) {
      copyToClipboard(text, 'Respon model');
    }
  });

  btnCopyProxyUrl.addEventListener('click', () => {
    const url = `${window.location.origin}/v1`;
    copyToClipboard(url, 'URL Proxy');
  });

  btnCopyProxyKey.addEventListener('click', () => {
    const key = textProxyKey.textContent.trim();
    if (key && key !== 'Memuat...') {
      copyToClipboard(key, 'Proxy Master Key');
    }
  });

  if (btnRotateProxyKey) {
    btnRotateProxyKey.addEventListener('click', async () => {
      if (confirm('Buat Proxy Master Key baru? Klien lama yang menggunakan key lama harus diperbarui.')) {
        try {
          const res = await authFetch(`${API_BASE}/api/auth/proxy-key/rotate`, { method: 'POST' });
          const data = await res.json();
          if (data.success && textProxyKey) {
            textProxyKey.textContent = data.proxyApiKey;
            showToast('Proxy Master Key berhasil diperbarui!');
          }
        } catch (err) {
          alert(`Gagal mengganti key: ${err.message}`);
        }
      }
    });
  }

  btnLogout.addEventListener('click', async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
    } catch {}
    authToken = '';
    localStorage.removeItem('proxy_token');
    showAuthModal(true);
  });

  formAuth.addEventListener('submit', async (e) => {
    e.preventDefault();
    authErrorBox.classList.add('hidden');

    const password = inputAuthPassword.value;
    const isSetupMode = !groupAuthConfirm.classList.contains('hidden');

    if (isSetupMode) {
      const confirmPass = inputAuthConfirm.value;
      if (password !== confirmPass) {
        authErrorBox.textContent = 'Konfirmasi password tidak cocok.';
        authErrorBox.classList.remove('hidden');
        return;
      }
      if (password.length < 6) {
        authErrorBox.textContent = 'Password minimal harus 6 karakter.';
        authErrorBox.classList.remove('hidden');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/auth/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        authToken = data.token;
        localStorage.setItem('proxy_token', authToken);
        hideAuthModal();
        await refreshData();
      } catch (err) {
        authErrorBox.textContent = err.message;
        authErrorBox.classList.remove('hidden');
      }
    } else {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        authToken = data.token;
        localStorage.setItem('proxy_token', authToken);
        hideAuthModal();
        await refreshData();
      } catch (err) {
        authErrorBox.textContent = err.message;
        authErrorBox.classList.remove('hidden');
      }
    }
  });

  selectActiveModel.addEventListener('change', async () => {
    const selectedModel = selectActiveModel.value;
    if (!selectedModel || !activeProviderId) return;
    try {
      await authFetch(`${API_BASE}/api/providers/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProviderId,
          defaultModel: selectedModel
        })
      });
      await refreshData();
      showToast(`Model aktif diubah ke: ${selectedModel}`);
    } catch (err) {
      alert(`Gagal mengubah model: ${err.message}`);
    }
  });

  btnOpenModal.addEventListener('click', () => openModal());
  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);
  formProvider.addEventListener('submit', handleSaveProvider);

  btnToggleKey.addEventListener('click', () => {
    if (inputProviderKey.type === 'password') {
      inputProviderKey.type = 'text';
      btnToggleKey.textContent = 'Sembunyi';
    } else {
      inputProviderKey.type = 'password';
      btnToggleKey.textContent = 'Lihat';
    }
  });

  btnModalTest.addEventListener('click', testModalConnection);

  document.querySelectorAll('.btn-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const presetKey = chip.dataset.preset;
      const preset = PRESETS[presetKey];
      if (preset) {
        inputProviderName.value = preset.name;
        inputProviderEndpoint.value = preset.endpoint;
        inputProviderModel.value = preset.model;
      }
    });
  });
}

async function refreshData() {
  try {
    const res = await authFetch(`${API_BASE}/api/providers`);
    const data = await res.json();
    providersState = data.providers || [];
    activeProviderId = data.activeProviderId;

    renderActiveProvider();
    renderProviderList();
    loadModelsForActiveProvider();
    loadProxyKey();

    if (textProxyUrl) {
      textProxyUrl.textContent = `${window.location.origin}/v1`;
    }
  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

async function loadProxyKey() {
  try {
    const res = await authFetch(`${API_BASE}/api/auth/proxy-key`);
    const data = await res.json();
    if (data.success && textProxyKey) {
      textProxyKey.textContent = data.proxyApiKey || 'Tidak disetel (Bebas)';
    }
  } catch {}
}

function renderActiveProvider() {
  const active = providersState.find(p => p.id === activeProviderId) || providersState[0];
  if (!active) {
    activeProviderName.textContent = 'Belum ada provider';
    activeProviderEndpoint.textContent = '-';
    activeStatusText.textContent = 'Tidak Aktif';
    if (keyWarningBanner) keyWarningBanner.classList.add('hidden');
    return;
  }

  activeProviderName.textContent = active.name;
  activeProviderEndpoint.textContent = active.endpoint;

  if (active.hasKey) {
    activeStatusText.textContent = `Online: ${active.name}`;
    if (keyWarningBanner) keyWarningBanner.classList.add('hidden');
  } else {
    activeStatusText.textContent = `Perlu Key: ${active.name}`;
    if (keyWarningBanner) {
      keyWarningBanner.classList.remove('hidden');
      if (btnFixKey) {
        btnFixKey.onclick = () => {
          openModal(active);
          setTimeout(() => inputProviderKey.focus(), 120);
        };
      }
    }
  }
}

async function loadModelsForActiveProvider() {
  if (!activeProviderId) return;
  const active = providersState.find(p => p.id === activeProviderId);
  if (!active) return;

  selectActiveModel.innerHTML = '<option value="">Mengambil daftar model...</option>';

  try {
    const res = await authFetch(`${API_BASE}/api/providers/${activeProviderId}/models`);
    const data = await res.json();

    if (!data.success || !Array.isArray(data.models)) {
      throw new Error(data.error || 'Format tidak valid');
    }

    selectActiveModel.innerHTML = '';
    data.models.forEach(modelId => {
      const opt = document.createElement('option');
      opt.value = modelId;
      opt.textContent = modelId;
      if (modelId === active.defaultModel) {
        opt.selected = true;
      }
      selectActiveModel.appendChild(opt);
    });

    if (!data.models.includes(active.defaultModel) && active.defaultModel) {
      const customOpt = document.createElement('option');
      customOpt.value = active.defaultModel;
      customOpt.textContent = `${active.defaultModel} (Custom)`;
      customOpt.selected = true;
      selectActiveModel.prepend(customOpt);
    }
  } catch (err) {
    selectActiveModel.innerHTML = `<option value="${active.defaultModel || ''}">${active.defaultModel || 'Default Model'} (Error memuat daftar)</option>`;
  }
}

function renderProviderList() {
  providerList.innerHTML = '';

  if (providersState.length === 0) {
    providerList.innerHTML = '<div class="text-muted text-xs">Belum ada provider tersimpan. Klik "Tambah Provider" di atas.</div>';
    return;
  }

  providersState.forEach(p => {
    const isActive = p.id === activeProviderId;
    const item = document.createElement('div');
    item.className = `provider-item ${isActive ? 'is-active' : ''}`;

    item.innerHTML = `
      <div class="provider-info">
        <h4>
          ${p.name}
          ${isActive ? '<span class="badge badge-success">ACTIVE</span>' : ''}
          ${!p.hasKey ? '<span class="badge badge-warning">KEY KOSONG</span>' : ''}
        </h4>
        <div class="provider-submeta">
          <span>Endpoint: <code>${p.endpoint}</code></span>
          <span>Model: <strong>${p.defaultModel || '-'}</strong></span>
          <span>Key: <code>${p.hasKey ? p.apiKey : '⚠️ Belum diisi'}</code></span>
        </div>
      </div>
      <div class="provider-actions">
        ${!isActive ? `<button class="btn btn-secondary btn-xs btn-set-active" data-id="${p.id}">Jadikan Aktif</button>` : ''}
        <button class="btn btn-secondary btn-xs btn-edit-provider" data-id="${p.id}">Edit</button>
        ${providersState.length > 1 ? `<button class="btn btn-danger-outline btn-xs btn-delete-provider" data-id="${p.id}">Hapus</button>` : ''}
      </div>
    `;

    providerList.appendChild(item);
  });

  document.querySelectorAll('.btn-set-active').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      await authFetch(`${API_BASE}/api/providers/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: id })
      });
      await refreshData();
      showToast('Provider aktif berhasil diubah!');
    });
  });

  document.querySelectorAll('.btn-edit-provider').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.id;
      const target = providersState.find(p => p.id === id);
      if (target) openModal(target);
    });
  });

  document.querySelectorAll('.btn-delete-provider').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      if (confirm('Yakin ingin menghapus provider ini?')) {
        await authFetch(`${API_BASE}/api/providers/${id}`, { method: 'DELETE' });
        await refreshData();
        showToast('Provider berhasil dihapus.');
      }
    });
  });
}

async function testActiveProvider() {
  const active = providersState.find(p => p.id === activeProviderId) || providersState[0];
  if (!active || !active.hasKey) {
    testActiveResult.className = 'test-result-box error';
    testActiveResult.classList.remove('hidden');
    testActiveResult.textContent = '⚠️ API Key belum diisi. Klik "Isi Key Sekarang" untuk memasukkan Client API Key.';
    return;
  }

  testActiveResult.className = 'test-result-box';
  testActiveResult.classList.remove('hidden');
  testActiveResult.textContent = 'Menguji latensi...';

  try {
    const res = await authFetch(`${API_BASE}/api/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.success) {
      testActiveResult.className = 'test-result-box success';
      testActiveResult.textContent = `🟢 Sukses! Latensi: ${data.latencyMs}ms | Ditemukan ${data.modelsCount} model.`;
    } else {
      testActiveResult.className = 'test-result-box error';
      testActiveResult.textContent = `🔴 Gagal: ${data.error}`;
    }
  } catch (err) {
    testActiveResult.className = 'test-result-box error';
    testActiveResult.textContent = `🔴 Error: ${err.message}`;
  }
}

async function testModalConnection() {
  const endpoint = inputProviderEndpoint.value.trim();
  const apiKey = inputProviderKey.value.trim();

  if (!endpoint || !apiKey) {
    alert('Harap isi endpoint dan API Key terlebih dahulu.');
    return;
  }

  modalTestResult.className = 'test-result-box';
  modalTestResult.classList.remove('hidden');
  modalTestResult.textContent = 'Menghubungkan ke endpoint...';

  try {
    const res = await authFetch(`${API_BASE}/api/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, apiKey })
    });
    const data = await res.json();
    if (data.success) {
      modalTestResult.className = 'test-result-box success';
      modalTestResult.textContent = `🟢 Koneksi berhasil (${data.latencyMs}ms)! Menemukan ${data.modelsCount} model.`;
      if (!inputProviderModel.value && data.models && data.models.length > 0) {
        inputProviderModel.value = data.models[0];
      }
    } else {
      modalTestResult.className = 'test-result-box error';
      modalTestResult.textContent = `🔴 Gagal: ${data.error}`;
    }
  } catch (err) {
    modalTestResult.className = 'test-result-box error';
    modalTestResult.textContent = `🔴 Error: ${err.message}`;
  }
}

async function handleSaveProvider(e) {
  e.preventDefault();
  const payload = {
    id: inputProviderId.value || undefined,
    name: inputProviderName.value.trim(),
    endpoint: inputProviderEndpoint.value.trim(),
    apiKey: inputProviderKey.value.trim(),
    defaultModel: inputProviderModel.value.trim() || undefined
  };

  try {
    const res = await authFetch(`${API_BASE}/api/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    closeModal();
    await refreshData();
    showToast('Provider berhasil disimpan!');
  } catch (err) {
    alert(`Gagal menyimpan: ${err.message}`);
  }
}

async function handlePlaygroundSubmit() {
  const prompt = playgroundPrompt.value.trim();
  if (!prompt) return;

  const active = providersState.find(p => p.id === activeProviderId) || providersState[0];
  if (!active || !active.hasKey) {
    alert('API Key untuk provider ini belum diisi. Harap masukkan API Key terlebih dahulu.');
    openModal(active);
    setTimeout(() => inputProviderKey.focus(), 120);
    return;
  }

  btnSendPrompt.disabled = true;
  playgroundSpinner.classList.remove('hidden');
  playgroundResponse.textContent = 'Sedang memproses respon dari model...';
  responseStats.textContent = '';

  const start = Date.now();

  try {
    const res = await authFetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: selectActiveModel.value || undefined
      })
    });

    const data = await res.json();
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    if (data.choices && data.choices[0] && data.choices[0].message) {
      playgroundResponse.textContent = data.choices[0].message.content;
      responseStats.textContent = `Model: ${data.model || selectActiveModel.value} | Durasi: ${duration}s`;
    } else {
      playgroundResponse.textContent = JSON.stringify(data, null, 2);
    }
  } catch (err) {
    playgroundResponse.textContent = `Error: ${err.message}`;
  } finally {
    btnSendPrompt.disabled = false;
    playgroundSpinner.classList.add('hidden');
  }
}

function openModal(editingProvider = null) {
  modal.classList.remove('hidden');
  modalTestResult.classList.add('hidden');

  if (editingProvider) {
    modalTitle.textContent = `Edit Provider: ${editingProvider.name}`;
    inputProviderId.value = editingProvider.id;
    inputProviderName.value = editingProvider.name;
    inputProviderEndpoint.value = editingProvider.endpoint;
    inputProviderKey.value = '';
    inputProviderKey.placeholder = 'Ketik jika ingin mengganti API Key';
    inputProviderModel.value = editingProvider.defaultModel || '';
  } else {
    modalTitle.textContent = 'Tambah Provider Baru';
    formProvider.reset();
    inputProviderId.value = '';
    inputProviderKey.placeholder = 'Masukkan API Key Anda';
  }
}

function closeModal() {
  modal.classList.add('hidden');
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
