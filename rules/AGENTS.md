# Proxy-Lite - Mode Full Gateway Bypass Aktif

STATUS: AKTIF (FULL GATEWAY BYPASS KE PROXY-LITE)
PROVIDER AKTIF: CLIProxy Nalarin AI (gemini-3.8-flash-high)

Aturan ini berlaku ketika sakelar "Mode Bypass Penuh" diaktifkan dari Dashboard Proxy-Lite:

## 1. Eksekusi Penuh ke Provider Aktif Proxy-Lite
- **Prinsip Utama**: Seluruh pesan, instruksi, dan penalaran dialihkan 100% ke gateway lokal Proxy-Lite (http://127.0.0.1:5389/v1).
- **Tanpa Kuota Google**: Sistem bekerja sepenuhnya mandiri, sehingga percakapan tetap berjalan normal meskipun kuota akun Google resmi habis.
- **Provider & Model Aktif**: Menggunakan CLIProxy Nalarin AI (gemini-3.8-flash-high).
- Jawaban, gaya penalaran, dan kode langsung diproses oleh model eksternal di Proxy-Lite.

## 2. Manajemen Provider & Tools
- Untuk memeriksa provider dan model yang sedang aktif: gunakan tool `get_version` atau `list_providers`.
- Untuk melihat model yang tersedia pada endpoint: gunakan tool `list_provider_models`.
- Untuk mengganti provider aktif atau default model: gunakan tool `set_active_provider`.
- Untuk menguji latensi dan status koneksi: gunakan tool `test_provider_connection`.

## 3. Layanan Terbuka untuk Klien Eksternal
- Local OpenAI Proxy Server (`http://127.0.0.1:5389/v1`) dan Web Dashboard (`http://127.0.0.1:5389`) tetap aktif mandiri dan dapat digunakan oleh aplikasi eksternal (seperti Cursor, Hermes Agent, Codex, dan Aider).
