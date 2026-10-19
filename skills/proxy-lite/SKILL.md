---
name: proxy-lite
description: Use custom external LLM providers (configured with API endpoints and API keys like cliproxy.nalarin.ai, DeepSeek, OpenAI, Ollama) to execute prompts, list models, test latency, or manage providers.
---

# Proxy-Lite Skill

Gunakan skill ini ketika pengguna ingin:
1. Mengirim prompt atau instruksi ke model provider eksternal (misal: `gemini-3.8-flash-high`, `claude-sonnet-4-6`, `deepseek-chat`).
2. Melihat daftar model yang tersedia dari endpoint provider.
3. Mengetes latensi dan koneksi ke endpoint provider.
4. Menambahkan atau mengganti provider (API endpoint dan API key).

## Tools yang Tersedia via MCP `proxy-lite`:

- `ask_provider`:
  Mengirim prompt ke model provider aktif (atau provider spesifik).
  Parameter:
  - `prompt`: Instruksi/pertanyaan pengguna.
  - `model` (opsional): Nama model spesifik (contoh: `gemini-3.8-flash-high`, `claude-sonnet-4-6`).
  - `system_prompt` (opsional): Instruksi sistem.
  - `temperature` (opsional): Nilai kreatifitas (default: 0.7).

- `list_providers`:
  Menampilkan semua provider yang tersimpan dan menunjukkan provider mana yang sedang aktif.

- `list_provider_models`:
  Mengambil daftar model real-time dari endpoint `/v1/models`.

- `test_provider_connection`:
  Mengetes latensi koneksi (dalam milidetik) dan mengecek status endpoint.

- `add_provider`:
  Mendaftarkan endpoint dan API key baru langsung dari obrolan.

- `set_active_provider`:
  Mengganti provider aktif atau default model.

- `get_version`:
  Mengecek versi Proxy-Lite saat ini, platform, provider aktif, dan status operasional sistem.

## Web Dashboard & Local Proxy
Pengguna juga dapat mengelola provider melalui antarmuka visual (Web UI) di:
- **Auxiliary Pane Sidecar:** `sidecar://proxy-lite/`
- **Web Browser:** `http://127.0.0.1:5389`
- **OpenAI Compatible Proxy:** `http://127.0.0.1:5389/v1/chat/completions`
