# Proxy-Lite - Aturan Kerja & Integrasi LLM Eksternal

Aturan ini berlaku ketika plugin `proxy-lite` aktif di Antigravity:

## 1. Delegasi ke Model Eksternal (MCP Tool: `ask_provider`)
- Jika pengguna meminta untuk berdiskusi, meminta opini, atau mengeksekusi instruksi menggunakan provider LLM eksternal (misal: Agy Nalarin, CLIProxy Nalarin AI, Cliproxy AIPortal, DeepSeek) atau model kustom seperti `ag/claude-opus-4-6-thinking`, `gemini-3.8-flash-high`:
  - **WAJIB** gunakan tool MCP `ask_provider` dari Proxy-Lite untuk meneruskan prompt ke model yang dituju.
  - Tampilkan respon resmi yang dikembalikan oleh model provider tersebut kepada pengguna.
- Untuk memeriksa konfigurasi provider yang sedang aktif:
  - Gunakan tool `list_providers` atau `get_version`.
- Untuk melihat daftar model yang tersedia di provider aktif:
  - Gunakan tool `list_provider_models`.
- Untuk mengganti provider aktif:
  - Gunakan tool `set_active_provider`.

## 2. Arsitektur Dual-Layer Proxy-Lite
- **Antigravity Host**: Chat utama Antigravity ditenagai oleh model internal untuk koordinasi workspace, pembacaan file, dan eksekusi command.
- **Proxy-Lite Provider Bridge**: Bertindak sebagai delegator cerdas:
  1. **MCP Tools** (`ask_provider`, `list_providers`): Menghubungkan sesi Antigravity ke LLM eksternal via tool calling.
  2. **Local OpenAI Proxy Server** (`http://127.0.0.1:5389/v1`): Endpoint reverse-proxy standar OpenAI untuk aplikasi lain (Cursor, Codex, Hermes Agent, Aider, Claude Desktop) agar dapat menggunakan provider aktif di Proxy-Lite sebagai model utama mereka.
  3. **Visual Dashboard**: Tersedia di `http://127.0.0.1:5389` untuk manajemen API Key, pergantian model, dan uji coba prompt langsung.
