const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AuthManager {
  constructor(customPath = null) {
    this.authPath = customPath || path.resolve(__dirname, '../config/auth.json');
    this.lastMtime = null;
    this.data = this.load();
    this.failedAttempts = new Map(); // ip -> { count, lockedUntil }
  }

  ensureFreshConfig() {
    try {
      if (fs.existsSync(this.authPath)) {
        const stats = fs.statSync(this.authPath);
        if (this.lastMtime !== stats.mtimeMs) {
          const raw = fs.readFileSync(this.authPath, 'utf8');
          this.data = JSON.parse(raw);
          this.lastMtime = stats.mtimeMs;
        }
      }
    } catch {}
  }

  load() {
    try {
      if (fs.existsSync(this.authPath)) {
        const stats = fs.statSync(this.authPath);
        this.lastMtime = stats.mtimeMs;
        return JSON.parse(fs.readFileSync(this.authPath, 'utf8'));
      }
    } catch (err) {
      console.error('[AuthManager] Failed to read auth config:', err.message);
    }
    return {
      isConfigured: false,
      passwordHash: null,
      salt: null,
      sessionSecret: null,
      proxyApiKey: null,
      updatedAt: null
    };
  }

  save() {
    try {
      const dir = path.dirname(this.authPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.authPath, JSON.stringify(this.data, null, 2), 'utf8');
      const stats = fs.statSync(this.authPath);
      this.lastMtime = stats.mtimeMs;
      return true;
    } catch (err) {
      console.error('[AuthManager] Failed to save auth config:', err.message);
      return false;
    }
  }

  isConfigured() {
    this.ensureFreshConfig();
    return Boolean(this.data.isConfigured && this.data.passwordHash && this.data.salt);
  }

  hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
  }

  setupPassword(newPassword) {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new Error('Password minimal harus 6 karakter');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(newPassword, salt);
    const sessionSecret = crypto.randomBytes(32).toString('hex');

    this.data.isConfigured = true;
    this.data.passwordHash = hash;
    this.data.salt = salt;
    this.data.sessionSecret = sessionSecret;
    // Generate a default proxy API key
    if (!this.data.proxyApiKey) {
      this.data.proxyApiKey = 'pxl_' + crypto.randomBytes(24).toString('hex');
    }
    this.data.updatedAt = new Date().toISOString();

    this.save();
    return true;
  }

  checkRateLimit(ip) {
    const record = this.failedAttempts.get(ip);
    if (!record) return { allowed: true };

    const now = Date.now();
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, retryAfter: remainingSec };
    }

    if (record.lockedUntil && now >= record.lockedUntil) {
      this.failedAttempts.delete(ip);
    }

    return { allowed: true };
  }

  recordFailedAttempt(ip) {
    const now = Date.now();
    const record = this.failedAttempts.get(ip) || { count: 0, lockedUntil: null };
    record.count += 1;

    if (record.count >= 5) {
      record.lockedUntil = now + 30 * 1000; // 30s lockout
    }

    this.failedAttempts.set(ip, record);

    // Garbage collection if map grows too large
    if (this.failedAttempts.size > 1000) {
      const cutoff = now - 60000;
      for (const [k, v] of this.failedAttempts.entries()) {
        if (!v.lockedUntil || v.lockedUntil < cutoff) {
          this.failedAttempts.delete(k);
        }
      }
    }

    return record;
  }

  clearFailedAttempts(ip) {
    this.failedAttempts.delete(ip);
  }

  verifyPassword(password, ip = '127.0.0.1') {
    if (!this.isConfigured()) {
      return { success: false, reason: 'Auth belum dikonfigurasi' };
    }

    const rate = this.checkRateLimit(ip);
    if (!rate.allowed) {
      return {
        success: false,
        reason: `Terlalu banyak percobaan gagal. Silakan tunggu ${rate.retryAfter} detik.`,
        retryAfter: rate.retryAfter
      };
    }

    const testHash = this.hashPassword(password, this.data.salt);
    const match = crypto.timingSafeEqual(
      Buffer.from(testHash, 'hex'),
      Buffer.from(this.data.passwordHash, 'hex')
    );

    if (!match) {
      const rec = this.recordFailedAttempt(ip);
      const remaining = 5 - rec.count;
      return {
        success: false,
        reason: remaining > 0 
          ? `Password salah. Sisa percobaan: ${remaining}.`
          : 'Terlalu banyak percobaan gagal. Akun dikunci sementara 30 detik.'
      };
    }

    this.clearFailedAttempts(ip);
    return { success: true };
  }

  createSession() {
    this.ensureFreshConfig();
    if (!this.data.sessionSecret) {
      this.data.sessionSecret = crypto.randomBytes(32).toString('hex');
      this.save();
    }

    const now = Date.now();
    const expiry = now + 7 * 24 * 60 * 60 * 1000; // 7 days
    const random = crypto.randomBytes(16).toString('hex');
    const payload = `${now}.${expiry}.${random}`;
    const signature = crypto
      .createHmac('sha256', this.data.sessionSecret)
      .update(payload)
      .digest('hex');

    return `${payload}.${signature}`;
  }

  validateSession(token) {
    this.ensureFreshConfig();
    if (!token || typeof token !== 'string') return false;
    if (!this.data.sessionSecret) return false;

    const parts = token.split('.');
    if (parts.length !== 4) return false;

    const [createdStr, expiryStr, random, signature] = parts;
    const expiry = parseInt(expiryStr, 10);

    if (isNaN(expiry) || Date.now() > expiry) {
      return false; // Expired
    }

    const payload = `${createdStr}.${expiryStr}.${random}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.data.sessionSecret)
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  getProxyApiKey() {
    this.ensureFreshConfig();
    return this.data.proxyApiKey || null;
  }

  rotateProxyApiKey() {
    this.ensureFreshConfig();
    this.data.proxyApiKey = 'pxl_' + crypto.randomBytes(24).toString('hex');
    this.save();
    return this.data.proxyApiKey;
  }

  setProxyApiKey(key) {
    this.ensureFreshConfig();
    this.data.proxyApiKey = key ? key.trim() : null;
    this.save();
    return this.data.proxyApiKey;
  }
}

module.exports = AuthManager;
