require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');

const isProd = process.env.NODE_ENV === 'production';
const app = express();

// ---------------------------------------------------------------------------
// 1) Trust proxy
// Behind Nginx/Caddy every request comes from the proxy's IP. Without this,
// the rate limiter counts all users as one IP and locks everyone out together.
// Set TRUST_PROXY to the number of proxies in front of Node (usually 1).
// Only set it when a proxy really is in front; otherwise clients could fake
// X-Forwarded-For to dodge the rate limit.
// ---------------------------------------------------------------------------
const trustProxy = process.env.TRUST_PROXY ?? (isProd ? '1' : '0');
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

// ---------------------------------------------------------------------------
// 2) HTTPS
// HTTPS itself is handled by Nginx/Caddy (see deploy/). In production we also
// redirect any plain-HTTP request that reaches Node, as a safety net.
// ---------------------------------------------------------------------------
if (isProd) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  });
}

// ---------------------------------------------------------------------------
// 3) Security headers (helmet)
// Default CSP only allows scripts from our own files, so no inline <script>.
// HSTS / upgrade-insecure-requests only in production so http://localhost works.
// ---------------------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    strictTransportSecurity: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
);

// ---------------------------------------------------------------------------
// 4) CORS
// The UI in public/ is served from this same server, so it needs no CORS.
// Only list other sites that must call the API, e.g. a separate frontend:
//   CORS_ORIGIN=https://app.example.com,https://admin.example.com
// Any origin not listed gets no CORS headers, so the browser blocks it.
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  '/api',
  cors({
    origin: (origin, callback) => callback(null, !!origin && allowedOrigins.includes(origin)),
  })
);

app.use(express.json({ limit: '10kb' }));

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'chang-auth-api-mysql' });
});

// Unknown API route -> JSON 404 (instead of an HTML page)
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

// UI: /login -> public/login.html, /register -> public/register.html, / -> public/index.html
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body too large.' });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ message: 'Something went wrong.' });
});

// In production listen on localhost only, so the app can be reached only
// through the proxy (keeps HTTPS and TRUST_PROXY honest).
const HOST = process.env.HOST || (isProd ? '127.0.0.1' : '0.0.0.0');
const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, HOST, () => {
  console.log(
    `Auth API (MySQL) on http://${HOST}:${PORT}  env=${isProd ? 'production' : 'development'}  trust proxy=${trustProxy}`
  );
});
