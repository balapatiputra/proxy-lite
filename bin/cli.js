#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const pkg = require('../package.json');
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const command = args[0] ? args[0].toLowerCase() : 'start';

function printBanner() {
  console.log(`
   ___                      __    _ __       
  / _ \\_______ __ _____ __ / /   (_) /____   
 / ___/ __/ _ \\\\ \\ / // // / /__ / / __/ -_)  
/_/  /_/  \\___/_\\_\\\\_, //_/____//_/\\__/\\__/   
                  /___/                      
  v${pkg.version} | Universal AI Provider Proxy & MCP
`);
}

function printHelp() {
  printBanner();
  console.log(`Penggunaan:
  npx @balapatiputra/proxy-lite [command] [options]
  proxy-lite [command] [options]

Perintah Utama:
  start            Menjalankan Web Dashboard & server proxy (default)
  install          Memasang Proxy-Lite sebagai plugin Antigravity (~/.gemini/config/plugins)
  status           Mengecek status server lokal (apakah port 5389 sedang aktif)
  mcp              Menjalankan server MCP (stdio) untuk Claude Desktop / Cursor / Antigravity
  test             Menjalankan uji koneksi mandiri ke provider aktif
  version, -v      Menampilkan versi Proxy-Lite
  help, -h         Menampilkan panduan bantuan ini

Opsi:
  --port=<port>    Menentukan port server (default: 5389)
  --host=<host>    Menentukan host binding (default: 127.0.0.1)

Contoh Penggunaan dengan Tools AI:
  Antigravity:
    npx @balapatiputra/proxy-lite install
    (Lalu restart Antigravity, plugin langsung aktif!)

  Hermes Agent / Cursor / Aider / Codex:
    Set Base URL: http://127.0.0.1:5389/v1
    Set API Key : (Master Key dari dashboard Proxy-Lite)

  Claude Desktop:
    npx @balapatiputra/proxy-lite mcp
    (Tambahkan konfigurasi di claude_desktop_config.json)
`);
}

async function handleStatus() {
  const port = process.env.PORT || 5389;
  const url = `http://127.0.0.1:${port}/healthz`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      console.log(`\n🟢 Proxy-Lite Server sedang ONLINE!`);
      console.log(`   Port:            ${port}`);
      console.log(`   Uptime:          ${data.uptimeSec} detik`);
      console.log(`   RAM Usage:       ${data.memoryUsageMb} MB`);
      console.log(`   Web Dashboard:   http://127.0.0.1:${port}`);
      console.log(`   OpenAI Endpoint: http://127.0.0.1:${port}/v1\n`);
    } else {
      console.log(`\n🟡 Server merespons dengan status HTTP ${res.status}`);
    }
  } catch (err) {
    console.log(`\n🔴 Proxy-Lite Server sedang OFFLINE di port ${port}.`);
    console.log(`   Jalankan: proxy-lite start (atau npx @balapatiputra/proxy-lite start) untuk menyalakannya.\n`);
  }
}

function handleInstallAntigravity() {
  printBanner();
  console.log('📦 Memasang Proxy-Lite ke Google Antigravity...\n');

  const geminiPluginsDir = path.join(os.homedir(), '.gemini', 'config', 'plugins');
  const targetDir = path.join(geminiPluginsDir, 'proxy-lite');

  try {
    if (!fs.existsSync(geminiPluginsDir)) {
      fs.mkdirSync(geminiPluginsDir, { recursive: true });
    }

    if (fs.existsSync(targetDir)) {
      console.log(`ℹ️ Direktori plugin sudah ada di: ${targetDir}`);
    }

    // On Windows, use directory junction if possible, otherwise copy files
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      try {
        if (!fs.existsSync(targetDir)) {
          fs.symlinkSync(ROOT_DIR, targetDir, 'junction');
          console.log(`✅ Berhasil membuat directory junction ke: ${targetDir}`);
        }
      } catch (linkErr) {
        // Fallback to recursive copy if symlink fails
        copyFolderRecursiveSync(ROOT_DIR, targetDir);
        console.log(`✅ Berhasil menyalin berkas plugin ke: ${targetDir}`);
      }
    } else {
      try {
        if (!fs.existsSync(targetDir)) {
          fs.symlinkSync(ROOT_DIR, targetDir, 'dir');
          console.log(`✅ Berhasil membuat symlink ke: ${targetDir}`);
        }
      } catch {
        copyFolderRecursiveSync(ROOT_DIR, targetDir);
        console.log(`✅ Berhasil menyalin berkas plugin ke: ${targetDir}`);
      }
    }

    console.log('\n🎉 INSTALASI BERHASIL!');
    console.log('Langkah selanjutnya:');
    console.log('1. Tutup dan buka kembali (restart) aplikasi Antigravity Anda.');
    console.log('2. Buka dashboard visual di http://127.0.0.1:5389 atau lewat sidecar di Antigravity.\n');
  } catch (err) {
    console.error('❌ Gagal memasang plugin:', err.message);
  }
}

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'config/providers.json') continue;
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  }
}

function handleStart() {
  printBanner();
  require('../server/index.js');
}

function handleMcp() {
  require('../server/mcp.js');
}

function handleTest() {
  require('../server/test.js');
}

// Router
switch (command) {
  case 'start':
  case 'server':
  case 'run':
    handleStart();
    break;

  case 'install':
  case 'setup':
  case 'install-antigravity':
    handleInstallAntigravity();
    break;

  case 'status':
  case 'ping':
    handleStatus();
    break;

  case 'mcp':
    handleMcp();
    break;

  case 'test':
    handleTest();
    break;

  case 'version':
  case '-v':
  case '--version':
    console.log(`v${pkg.version}`);
    break;

  case 'help':
  case '-h':
  case '--help':
  default:
    printHelp();
    break;
}
