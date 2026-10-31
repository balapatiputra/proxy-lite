# Proxy-Lite - Aturan Kerja & Integrasi LLM Eksternal

Aturan ini berlaku ketika plugin `proxy-lite` aktif di Antigravity:

## 1. Kepatuhan Penuh terhadap Provider Aktif Proxy-Lite (MCP Tool: `ask_provider`)
- **Prinsip Utama**: Agen di workspace ini WAJIB selalu patuh dan menyelaraskan respon, penalaran, dan pemikiran dengan model dari provider yang sedang aktif di Proxy-Lite.
- Saat berdiskusi, memberikan jawaban, menganalisis kode, merancang arsitektur, atau mengeksekusi instruksi pengguna:
  - **WAJIB** konsultasikan dan teruskan prompt pengguna ke model provider aktif melalui tool MCP `ask_provider`.
  - Gunakan jawaban, gaya penalaran, dan instruksi dari model provider aktif tersebut sebagai rujukan utama dalam merespons pengguna.
- Untuk memeriksa provider dan model yang sedang aktif:
  - Gunakan tool `get_version` atau `list_providers`.
- Untuk melihat model yang tersedia pada endpoint:
  - Gunakan tool `list_provider_models`.
- Untuk mengganti provider aktif atau model bawaan:
  - Gunakan tool `set_active_provider`.

## 2. Arsitektur Proxy-Lite
- Antigravity bertindak sebagai agen pelaksana di workspace lokal (file system, terminal command).
- Otak dan penalaran utama dipandu oleh model provider aktif di Proxy-Lite melalui tool `ask_provider`.
- Local OpenAI Proxy Server (`http://127.0.0.1:5389/v1`) dan Web Dashboard (`http://127.0.0.1:5389`) tetap aktif melayani aplikasi eksternal dan manajemen visual.
