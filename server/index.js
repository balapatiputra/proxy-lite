const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const ProviderManager = require('./provider-manager');
const AuthManager = require('./auth-manager');
const pkg = require('../package.json');

const manager = new ProviderManager();
const auth = new AuthManager();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5389;
const HOST = process.env.HOST || '127.0.0.1';
const UI_DIR = path.resolve(__dirname, '../ui');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function isAllowedOrigin(origin) {
  if (!origin) return true; // Direct tools, Electron internal, cURL
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (parsed.protocol === 'vscode-webview:') return true;
  } catch {}
  return false;
}

function getSecurityHeaders(req) {
  const origin = req.headers['origin'];
  const allowedOrigin = isAllowedOrigin(origin) ? (origin || '*') : 'null';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-session-token',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
}

function sendJson(req, res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...getSecurityHeaders(req),
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Body payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

function isLoopbackIp(ip) {
  if (!ip) return false;
  return ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1') || ip === '::ffff:127.0.0.1';
}

function getSessionToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.headers['x-session-token']) {
    return req.headers['x-session-token'].trim();
  }
  const cookie = req.headers['cookie'];
  if (cookie) {
    const match = cookie.match(/proxy_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]).trim();
  }
  return null;
}

function isAuthenticated(req) {
  if (!auth.isConfigured()) return true;
  const token = getSessionToken(req);
  return auth.validateSession(token);
}

function serveStatic(req, res, pathname) {
  let relativePath = pathname === '/' ? 'index.html' : pathname;
  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(UI_DIR, safePath);

  if (!filePath.startsWith(UI_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      ...getSecurityHeaders(req)
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const clientIp = getClientIp(req);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, getSecurityHeaders(req));
    return res.end();
  }

  // --- HEALTH CHECK ENDPOINT ---
  if ((method === 'GET' || method === 'HEAD') && pathname === '/healthz') {
    if (method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        ...getSecurityHeaders(req)
      });
      return res.end();
    }
    return sendJson(req, res, 200, {
      status: 'ok',
      service: 'proxy-lite',
      version: pkg.version,
      uptimeSec: Math.floor(process.uptime()),
      providersCount: manager.getProviders().length,
      memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
    });
  }

  // --- AUTHENTICATION REST ENDPOINTS (PUBLIC) ---

  // Check auth status
  if (method === 'GET' && pathname === '/api/auth/status') {
    const isConfigured = auth.isConfigured();
    const token = getSessionToken(req);
    const valid = isConfigured ? auth.validateSession(token) : false;
    return sendJson(req, res, 200, {
      isConfigured,
      isAuthenticated: valid
    });
  }

  // Initial password setup (first run)
  if (method === 'POST' && pathname === '/api/auth/setup') {
    if (auth.isConfigured()) {
      return sendJson(req, res, 400, { success: false, error: 'Password sudah pernah disetel' });
    }
    try {
      const { password } = await parseBody(req);
      auth.setupPassword(password);
      const token = auth.createSession();
      return sendJson(req, res, 200, {
        success: true,
        token,
        message: 'Master password berhasil dibuat'
      }, {
        'Set-Cookie': `proxy_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`
      });
    } catch (err) {
      return sendJson(req, res, 400, { success: false, error: err.message });
    }
  }

  // User Login
  if (method === 'POST' && pathname === '/api/auth/login') {
    try {
      const { password } = await parseBody(req);
      const verify = auth.verifyPassword(password, clientIp);
      if (!verify.success) {
        return sendJson(req, res, 401, {
          success: false,
          error: verify.reason,
          retryAfter: verify.retryAfter
        });
      }

      const token = auth.createSession();
      return sendJson(req, res, 200, {
        success: true,
        token
      }, {
        'Set-Cookie': `proxy_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`
      });
    } catch (err) {
      return sendJson(req, res, 400, { success: false, error: err.message });
    }
  }

  // User Logout
  if (method === 'POST' && pathname === '/api/auth/logout') {
    return sendJson(req, res, 200, { success: true }, {
      'Set-Cookie': 'proxy_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    });
  }

  // --- PROTECTED REST API ENDPOINTS ---
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated(req)) {
      return sendJson(req, res, 401, {
        success: false,
        error: 'Sesi tidak valid atau telah berakhir. Harap login kembali.',
        requiresAuth: true,
        isConfigured: auth.isConfigured()
      });
    }

    // Health and Status
    if (method === 'GET' && pathname === '/api/status') {
      const active = manager.getActiveProvider();
      return sendJson(req, res, 200, {
        status: 'ok',
        service: 'proxy-lite',
        version: pkg.version,
        port: PORT,
        proxyApiKey: auth.getProxyApiKey(),
        activeProvider: active ? {
          id: active.id,
          name: active.name,
          endpoint: active.endpoint,
          defaultModel: active.defaultModel
        } : null,
        providersCount: manager.getProviders().length
      });
    }

    // Get Proxy Master Key
    if (method === 'GET' && pathname === '/api/auth/proxy-key') {
      return sendJson(req, res, 200, {
        success: true,
        proxyApiKey: auth.getProxyApiKey()
      });
    }

    // Rotate Proxy Master Key
    if (method === 'POST' && pathname === '/api/auth/proxy-key/rotate') {
      const newKey = auth.rotateProxyApiKey();
      return sendJson(req, res, 200, {
        success: true,
        proxyApiKey: newKey
      });
    }

    // Set Custom Proxy Master Key
    if (method === 'POST' && pathname === '/api/auth/proxy-key') {
      try {
        const { key } = await parseBody(req);
        const updated = auth.setProxyApiKey(key);
        return sendJson(req, res, 200, { success: true, proxyApiKey: updated });
      } catch (err) {
        return sendJson(req, res, 400, { success: false, error: err.message });
      }
    }

    // List all configured providers
    if (method === 'GET' && pathname === '/api/providers') {
      const providers = manager.getProviders(true);
      const active = manager.getActiveProvider();
      return sendJson(req, res, 200, {
        activeProviderId: active?.id,
        providers
      });
    }

    // Add or update provider
    if (method === 'POST' && pathname === '/api/providers') {
      try {
        const data = await parseBody(req);
        const saved = manager.addOrUpdateProvider(data);
        return sendJson(req, res, 200, { success: true, provider: saved });
      } catch (err) {
        return sendJson(req, res, 400, { success: false, error: err.message });
      }
    }

    // Set active provider
    if (method === 'POST' && pathname === '/api/providers/active') {
      try {
        const { providerId, defaultModel } = await parseBody(req);
        if (!providerId) {
          return sendJson(req, res, 400, { success: false, error: 'providerId is required' });
        }
        const updated = manager.setActiveProvider(providerId, defaultModel);
        return sendJson(req, res, 200, { success: true, activeProvider: updated });
      } catch (err) {
        return sendJson(req, res, 400, { success: false, error: err.message });
      }
    }

    // Delete provider
    if (method === 'DELETE' && pathname.startsWith('/api/providers/')) {
      const providerId = pathname.replace('/api/providers/', '').trim();
      try {
        manager.deleteProvider(providerId);
        return sendJson(req, res, 200, { success: true, deleted: providerId });
      } catch (err) {
        return sendJson(req, res, 400, { success: false, error: err.message });
      }
    }

    // Fetch models for a provider
    if (method === 'GET' && pathname.startsWith('/api/providers/') && pathname.endsWith('/models')) {
      const parts = pathname.split('/');
      const providerId = parts[3];
      try {
        const models = await manager.fetchModels(providerId);
        return sendJson(req, res, 200, { success: true, models });
      } catch (err) {
        return sendJson(req, res, 500, { success: false, error: err.message });
      }
    }

    // Test connection to endpoint + key
    if (method === 'POST' && pathname === '/api/test') {
      try {
        let { endpoint, apiKey } = await parseBody(req);
        if (!endpoint || !apiKey) {
          const active = manager.getActiveProvider();
          if (active) {
            endpoint = endpoint || active.endpoint;
            apiKey = apiKey || active.apiKey;
          }
        }
        if (!endpoint || !apiKey) {
          return sendJson(req, res, 400, { success: false, error: 'endpoint dan apiKey wajib diisi' });
        }
        const result = await manager.testConnection(endpoint, apiKey);
        return sendJson(req, res, result.success ? 200 : 400, result);
      } catch (err) {
        return sendJson(req, res, 500, { success: false, error: err.message });
      }
    }

    // Test Playground Chat completion
    if (method === 'POST' && pathname === '/api/chat') {
      try {
        const body = await parseBody(req);
        const completion = await manager.chatCompletion({
          providerId: body.providerId,
          model: body.model,
          messages: body.messages || [{ role: 'user', content: body.prompt || 'Hello' }],
          systemPrompt: body.systemPrompt,
          temperature: body.temperature ?? 0.7,
          maxTokens: body.maxTokens
        });
        return sendJson(req, res, 200, completion);
      } catch (err) {
        return sendJson(req, res, 500, { success: false, error: err.message });
      }
    }
  }

  // --- OPENAI-COMPATIBLE PROXY ENDPOINTS ---

  // Check proxy authorization
  const proxyKey = auth.getProxyApiKey();
  const isLocal = isLoopbackIp(clientIp);

  // If a proxy master key is configured and request is not local loopback, enforce authorization
  if (proxyKey && !isLocal) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (token !== proxyKey && !auth.validateSession(token)) {
      return sendJson(req, res, 401, { error: { message: 'Unauthorized proxy access: valid Bearer token required' } });
    }
  }

  // /v1/models proxy
  if (method === 'GET' && pathname === '/v1/models') {
    try {
      const models = await manager.fetchModels();
      return sendJson(req, res, 200, {
        object: 'list',
        data: models.map(id => ({
          id,
          object: 'model',
          owned_by: 'proxy-lite'
        }))
      });
    } catch (err) {
      return sendJson(req, res, 502, { error: { message: err.message } });
    }
  }

  // /v1/chat/completions proxy
  if (method === 'POST' && pathname === '/v1/chat/completions') {
    try {
      const body = await parseBody(req);
      const isStream = Boolean(body.stream);

      // Support aborting upstream stream when client disconnects
      const abortController = new AbortController();
      req.on('close', () => {
        abortController.abort();
      });

      if (isStream) {
        const stream = await manager.chatCompletion({
          model: body.model,
          messages: body.messages,
          temperature: body.temperature,
          maxTokens: body.max_tokens,
          stream: true,
          abortSignal: abortController.signal
        });

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...getSecurityHeaders(req)
        });

        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } catch (streamErr) {
          // If aborted by client disconnect, clean up reader
          try { reader.cancel(); } catch {}
        } finally {
          res.end();
        }
        return;
      }

      const result = await manager.chatCompletion({
        model: body.model,
        messages: body.messages,
        temperature: body.temperature,
        maxTokens: body.max_tokens,
        stream: false,
        abortSignal: abortController.signal
      });
      return sendJson(req, res, 200, result);
    } catch (err) {
      return sendJson(req, res, 502, { error: { message: err.message } });
    }
  }

  // Fallback to static web UI
  serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  const active = manager.getActiveProvider();
  console.log('====================================================');
  console.log(`🚀 [Proxy-Lite Server] Running on http://${HOST}:${PORT}`);
  console.log(`📡 Active Provider: ${active ? active.name : 'None'} (${active ? active.endpoint : ''})`);
  console.log(`🤖 Default Model:  ${active ? active.defaultModel : 'None'}`);
  console.log(`🔒 Security Auth:   ${auth.isConfigured() ? 'Protected with Master Password' : 'Setup Required (First Run)'}`);
  console.log(`🌐 UI Dashboard:    http://${HOST}:${PORT}`);
  console.log('====================================================');
});

process.on('SIGINT', () => {
  console.log('\n[Proxy-Lite Server] Shutting down gracefully...');
  server.close(() => process.exit(0));
});
