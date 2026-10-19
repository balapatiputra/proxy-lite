# 🚀 Proxy-Lite Provider Manager untuk Antigravity

Plugin & Proxy Bridge untuk menambahkan opsi provider LLM kustom (menggunakan **API Endpoint** dan **API Key**) ke dalam Google Antigravity.

---

## ✨ Fitur Utama

- 🌐 **Web UI Dashboard Modern**: Akses dashboard visual di `http://127.0.0.1:5389` atau via panel samping Antigravity (`sidecar://proxy-lite`).
- 🔑 **Kelola Provider Kustom**: Tambah, edit, dan hapus endpoint kustom (OpenAI-compatible) dengan API Key masing-masing.
- ⚡ **Pre-configured Default Provider**:
  - **URL Endpoint**: `https://cliproxy.nalarin.ai/v1`
  - **Model Aktif**: `gemini-3.8-flash-high`
  - **Model Lain Terdeteksi**: `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gpt-oss-120b-medium`, dll.
- 🎯 **Preset Cepat**: Template 1-klik untuk CLIProxy Nalarin, DeepSeek, OpenAI, OpenRouter, dan Ollama Lokal.
- 🤖 **Integrasi Penuh Antigravity Agent (MCP)**: Menyediakan tool agent seperti `ask_provider`, `list_providers`, `list_provider_models`, dan `test_provider_connection`.
- 🔄 **OpenAI-Compatible Local Proxy**: Mengalirkan request standar `/v1/chat/completions` dan `/v1/models` ke provider yang sedang aktif.
- 📦 **Zero External Dependencies**: Menggunakan library standar Node.js bawaan (Node 20+ / 22+). **Tidak memerlukan `npm install`** yang berat!

---

## 📂 Struktur Direktori

```text
d:\proxy-lite\
├── plugin.json               # Manifest plugin Antigravity
├── sidecar.json              # Konfigurasi sidecar (UI Aux Pane & background process)
├── mcp_config.json           # Registrasi MCP server untuk agent Antigravity
├── package.json              # Metadata project & script runner
├── start.bat                 # 1-klik launcher untuk Windows
├── start.sh                  # 1-klik launcher untuk Linux / macOS
├── config/
│   └── providers.json        # Penyimpanan data endpoint & API Key lokal
├── server/
│   ├── index.js              # Server HTTP (UI host + /v1 proxy endpoints)
│   ├── mcp.js                # Server MCP stdio (JSON-RPC 2.0 untuk Antigravity)
│   ├── provider-manager.js   # Logic utama manajemen provider & completion
│   └── test.js               # Script verifikasi mandiri
├── ui/
│   ├── index.html            # Dashboard visual
│   ├── style.css             # Tema dark modern sesuai Antigravity
│   └── app.js                # Logic frontend & interaksi playground
└── skills/
    └── proxy-lite/
        └── SKILL.md          # Panduan interaksi agent Antigravity
```

---

## 🚀 Cara Menjalankan

### 1. Menjalankan Server & Web Dashboard

Cukup jalankan perintah berikut di terminal:

```bash
# Menggunakan npm
npm start

# Atau langsung dengan node
node server/index.js

# Atau (di Windows) cukup double-click salah satu file:
start.bat              # Membuka server dengan jendela terminal aktif
start-background.vbs   # Menjalankan server secara senyap di background (tanpa jendela popup)
stop.bat               # Menghentikan server di port 5389
install-autostart.bat  # Mengaktifkan autostart agar otomatis menyala saat Windows booting
uninstall-autostart.bat# Menonaktifkan autostart
```

Buka browser di **`http://127.0.0.1:5389`** untuk melihat Web Dashboard.

### 2. Menjalankan Tes Mandiri (Self-Test)

Untuk memastikan endpoint provider dan chat completion berjalan normal:

```bash
node server/test.js
```

---

## 🛠️ Cara Pasang di Antigravity Server / Mesin Lain

Plugin ini dirancang **100% portabel** tanpa kompilasi native C/C++ dan tanpa dependensi `node_modules` pihak ketiga.

### Opsi A: Pasang sebagai Global Plugin (Tersedia di semua workspace)
1. Salin seluruh folder `proxy-lite` ke direktori plugin Antigravity:
   * **Windows**: `C:\Users\<username>\.gemini\config\plugins\proxy-lite`
   * **Linux/macOS**: `~/.gemini/config/plugins/proxy-lite`
2. Restart Antigravity.
3. Plugin akan langsung terdeteksi, MCP server aktif, dan UI sidecar siap digunakan.

### Opsi B: Pasang sebagai Project Plugin (Via Git Repository)
1. Letakkan folder `proxy-lite` di dalam folder project Anda pada path:
   `.agents/plugins/proxy-lite`
2. Commit ke Git.
3. Setiap kali project tersebut dibuka di server atau PC mana pun dengan Antigravity, plugin otomatis aktif untuk project tersebut!

---

## 💬 Contoh Perintah Agent di Antigravity Chat

Setelah plugin aktif, Anda bisa langsung memerintahkan agent di chat Antigravity:
* *"Tolong tanyakan ke model gemini-3.8-flash-high via proxy-lite untuk membuatkan regex email."*
* *"Tampilkan daftar model yang tersedia di provider cliproxy."*
* *"Tes latensi koneksi ke provider aktif."*
* *"Tambahkan provider DeepSeek dengan endpoint https://api.deepseek.com/v1 dan apiKey sk-xxx."*
