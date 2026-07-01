'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(username);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  return res.json({ message: 'Logged in.', username: user.username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out.' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  return res.json({ userId: req.session.userId, username: req.session.username });
});

module.exports = router;
