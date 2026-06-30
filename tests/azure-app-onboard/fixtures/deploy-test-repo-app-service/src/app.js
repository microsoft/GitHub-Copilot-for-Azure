'use strict';

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { setup } = require('./db');
const authRouter = require('./auth');
const notesRouter = require('./notes');

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'bya-notes-secret-change-in-production';

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.warn(
    'WARNING: SESSION_SECRET env var is not set. Using insecure default secret.'
  );
}

// Rate limiter for auth endpoints: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests, please try again later.' },
});

// Rate limiter for notes API: 200 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests, please try again later.' },
});

function createApp(options = {}) {
  const app = express();

  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // CSRF mitigation: for mutating API requests check that the request
  // originates from the same host. Browsers always send Origin/Referer on
  // cross-origin requests; if both are absent we still allow the request
  // (e.g. server-to-server or test tooling).
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }
    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      const host = req.headers.host;
      try {
        const url = new URL(origin);
        if (url.host !== host) {
          return res.status(403).json({ error: 'Forbidden: cross-origin request.' });
        }
      } catch {
        return res.status(403).json({ error: 'Forbidden: invalid origin.' });
      }
    }
    next();
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/notes', apiLimiter, notesRouter);

  return app;
}

module.exports = { createApp };
