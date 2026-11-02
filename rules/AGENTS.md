# Proxy-Lite - Mode Standar (Coexistence: Akun Asli & Proxy-Lite On-Demand)

STATUS: NONAKTIF (DEFAULT AKUN RESMI ANTIGRAVITY)

Aturan ini berlaku ketika plugin `proxy-lite` aktif di Antigravity dan "Mode Otomatis" dinonaktifkan:

## 1. Arsitektur Coexistence (Dual Quota: Akun Asli & Proxy-Lite)
- **Akun Utama Antigravity**:
  - Secara bawaan (*default*), agen bekerja menggunakan model dan akun resmi Antigravity. Kuota akun Google pengguna berjalan seperti biasa.
- **Opsi Kuota Eksternal (Proxy-Lite)**:
  - Proxy-Lite berfungsi sebagai opsi alternatif / cadangan (*on-demand*).
  - Ketika pengguna meminta untuk menggunakan model/provider Proxy-Lite (misal: *"Gunakan Proxy-Lite"*, *"Pakai model Nalarin"*, *"Gunakan DeepSeek"*, dsb.):
    - Agen **WAJIB** meneruskan penalaran atau prompt tersebut ke model provider aktif melalui tool MCP `ask_provider`.
    - Kuota yang berkurang adalah kuota provider eksternal di Proxy-Lite, sementara kuota akun resmi Antigravity tetap hemat dan utuh.

## 2. Manajemen Provider & Tools
- Untuk memeriksa provider dan model yang sedang aktif di Proxy-Lite: gunakan tool `get_version` atau `list_providers`.
- Untuk melihat model yang tersedia pada endpoint: gunakan tool `list_provider_models`.
- Untuk mengganti provider aktif atau default model: gunakan tool `set_active_provider`.
- Untuk menguji latensi dan status koneksi: gunakan tool `test_provider_connection`.

## 3. Layanan Terbuka untuk Klien Eksternal
- Local OpenAI Proxy Server (`http://127.0.0.1:5389/v1`) dan Web Dashboard (`http://127.0.0.1:5389`) tetap aktif mandiri dan dapat digunakan oleh aplikasi eksternal (seperti Cursor, Hermes Agent, Codex, dan Aider) kapan pun dibutuhkan tanpa mengganggu Antigravity.
