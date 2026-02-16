const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// POST /auth/register
router.post('/register', authRateLimiter, (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const apiKey = `qah_${uuidv4().replace(/-/g, '')}`;
  const currentMonth = new Date().toISOString().slice(0, 7);

  const result = db
    .prepare(
      'INSERT INTO users (email, password_hash, name, api_key, month_reset) VALUES (?, ?, ?, ?, ?)'
    )
    .run(email, passwordHash, name, apiKey, currentMonth);

  const token = jwt.sign({ userId: result.lastInsertRowid }, config.jwtSecret, {
    expiresIn: '30d',
  });

  res.status(201).json({
    message: 'Account created successfully',
    token,
    user: {
      id: result.lastInsertRowid,
      email,
      name,
      plan: 'free',
      api_key: apiKey,
    },
  });
});

// POST /auth/login
router.post('/login', authRateLimiter, (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      api_key: user.api_key,
    },
  });
});

// GET /auth/me
router.get('/me', authenticateToken, (req, res) => {
  const plan = config.plans[req.user.plan];
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    plan: req.user.plan,
    api_key: req.user.api_key,
    usage: {
      requests_this_month: req.user.requests_this_month,
      monthly_limit: plan.requestsPerMonth,
      rate_limit: plan.rateLimit,
    },
  });
});

// POST /auth/regenerate-key
router.post('/regenerate-key', authenticateToken, (req, res) => {
  const newApiKey = `qah_${uuidv4().replace(/-/g, '')}`;
  db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(newApiKey, req.user.id);
  res.json({ api_key: newApiKey });
});

module.exports = router;
