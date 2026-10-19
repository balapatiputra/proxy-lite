# 🚀 Proxy-Lite (`@balapatiputra/proxy-lite`)

**Universal AI Provider Manager, OpenAI-Compatible Proxy & MCP Server.**

Jembatan ringan (*zero-dependency*) untuk menghubungkan model LLM kustom (menggunakan **API Endpoint** dan **API Key**) ke berbagai ekosistem AI seperti **Google Antigravity**, **Claude Desktop / Claude Code**, **Hermes Agent**, **Cursor**, **Codex**, dan **Aider**.

---

## ✨ Fitur Utama

- 🌐 **Web UI Dashboard Modern**: Akses dashboard visual di `http://127.0.0.1:5389` untuk mengelola endpoint, melihat model yang tersedia, dan test playground.
- 🔒 **Enterprise-Grade Security**:
  - Dilindungi Master Password dengan Salted Scrypt Hash & Signed Session Tokens.
  - Rate limiting anti-brute-force dan proteksi SSRF.
  - Zero leak: API key Anda aman di lokal dan tidak pernah terunggah ke Git.
- ⚡ **Pre-configured Default Provider**:
  - **URL Endpoint**: `https://cliproxy.nalarin.ai/v1`
  - **Model Aktif**: `gemini-3.8-flash-high`
  - **Model Terdeteksi**: `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gpt-oss-120b-medium`, dll.
- 🎯 **Preset Cepat**: Template 1-klik untuk CLIProxy Nalarin, DeepSeek, OpenAI, OpenRouter, dan Ollama Lokal.
- 🤖 **Universal Multi-Client Support**:
  - **Google Antigravity**: Plugin native + UI Sidecar + MCP tools.
  - **Claude Desktop & Claude Code**: Standar resmi Anthropic Model Context Protocol (MCP).
  - **Hermes Agent & Codex**: Kompatibel penuh dengan format OpenAI (`/v1/chat/completions`).
  - **Cursor & Aider**: Cukup arahkan ke `http://127.0.0.1:5389/v1`.
- 📦 **Zero External Dependencies**: Menggunakan pustaka standar Node.js bawaan (Node 18+ / 20+ / 22+). **Tidak memerlukan `npm install` ratusan MB!**

---

## ⚡ Cara Cepat Menggunakan (Tanpa Clone Repo)

Jika Anda sudah menginstall Node.js di komputer:

### 1. Jalankan Langsung dengan NPX:
```bash
npx @balapatiputra/proxy-lite start
```
*Buka browser di **`http://127.0.0.1:5389`** untuk membuka Web Dashboard.*

### 2. Atau Install Secara Global:
```bash
npm install -g @balapatiputra/proxy-lite
```
Setelah diinstall, Anda bisa menjalankan perintah berikut dari terminal mana saja:
* `proxy-lite start` : Menyalakan server proxy & Web Dashboard.
* `proxy-lite install` : Otomatis memasang plugin ke Antigravity (`~/.gemini/config/plugins/proxy-lite`).
* `proxy-lite status` : Memeriksa apakah server proxy sedang online.
* `proxy-lite mcp` : Menjalankan server MCP untuk Claude Desktop / Cursor.
* `proxy-lite test` : Menjalankan uji koneksi mandiri ke provider.

---

## 🔌 Panduan Koneksi ke Berbagai Klien AI

### 1. Google Antigravity
Cukup jalankan:
```bash
proxy-lite install
# atau
npx @balapatiputra/proxy-lite install
```
Lalu **restart aplikasi Antigravity**. Agen Antigravity akan langsung memiliki tools `ask_provider`, `list_provider_models`, dll.

### 2. Claude Desktop (Anthropic MCP)
Tambahkan konfigurasi berikut ke berkas konfigurasi Claude Desktop Anda:
* **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
* **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "proxy-lite": {
      "command": "npx",
      "args": ["-y", "@balapatiputra/proxy-lite", "mcp"]
    }
  }
}
```

### 3. Hermes Agent & Autonomous Agents
Di file `.env` atau konfigurasi Hermes Agent:
```env
OPENAI_BASE_URL=http://127.0.0.1:5389/v1
OPENAI_API_KEY=pxl_master_key_dari_dashboard
```

### 4. Cursor / Aider / Continue.dev
Di pengaturan model custom:
* **Base URL**: `http://127.0.0.1:5389/v1`
* **API Key**: (Gunakan Proxy Master Key yang tertera di dashboard Proxy-Lite)
* **Model**: `gemini-3.8-flash-high` atau model lain yang terdaftar di dashboard.

---

## 📂 Struktur Direktori Proyek

```text
proxy-lite/
├── bin/
│   └── cli.js                # Universal CLI runner (npx / npm)
├── plugin.json               # Manifest plugin Antigravity
├── sidecar.json              # Konfigurasi sidecar (UI Aux Pane & background process)
├── mcp_config.json           # Registrasi MCP server untuk Antigravity
├── package.json              # Package metadata (@balapatiputra/proxy-lite)
├── start.bat                 # 1-klik launcher Windows
├── start-background.vbs      # 1-klik launcher senyap di background
├── install-autostart.bat     # Pasang autostart saat Windows booting
├── stop.bat                  # Hentikan server di port 5389
├── start.sh                  # 1-klik launcher Linux / macOS
├── config/
│   ├── providers.json        # Data provider & API key lokal (gitignored)
│   └── providers.example.json# Template aman untuk publik
├── server/
│   ├── index.js              # Server HTTP + OpenAI /v1 proxy
│   ├── auth-manager.js       # Autentikasi Master Password & Session
│   ├── mcp.js                # Server MCP stdio universal
│   ├── provider-manager.js   # Manajemen provider, SSRF protection, hot-reload
│   └── test.js               # Skrip self-test
├── ui/
│   ├── index.html            # Dashboard visual
│   ├── style.css             # Tema dark modern
│   └── app.js                # Frontend logic & playground
└── skills/
    └── proxy-lite/
        └── SKILL.md          # Panduan interaksi agent Antigravity
```

---

## 📄 Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE). Bebas digunakan, dimodifikasi, dan didistribusikan untuk keperluan pribadi maupun komersial.
