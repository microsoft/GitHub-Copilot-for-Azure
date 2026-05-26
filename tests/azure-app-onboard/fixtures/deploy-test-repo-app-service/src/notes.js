'use strict';

const express = require('express');
const { getDb } = require('./db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  next();
}

// Get all notes for the current user
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const notes = db
    .prepare(
      'SELECT id, title, content, created_at, updated_at FROM notes WHERE user_id = ? ORDER BY id ASC'
    )
    .all(req.session.userId);
  return res.json(notes);
});

// Get a single note
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const note = db
    .prepare(
      'SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ? AND user_id = ?'
    )
    .get(req.params.id, req.session.userId);

  if (!note) {
    return res.status(404).json({ error: 'Note not found.' });
  }
  return res.json(note);
});

// Create a note
router.post('/', requireAuth, (req, res) => {
  const { title, content } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required.' });
  }

  const db = getDb();
  const result = db
    .prepare('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)')
    .run(req.session.userId, title.trim(), content || '');

  const note = db
    .prepare('SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?')
    .get(result.lastInsertRowid);

  return res.status(201).json(note);
});

// Update a note
router.put('/:id', requireAuth, (req, res) => {
  const { title, content } = req.body;

  if (title !== undefined && title.trim() === '') {
    return res.status(400).json({ error: 'Title cannot be empty.' });
  }

  const db = getDb();
  const note = db
    .prepare('SELECT id FROM notes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);

  if (!note) {
    return res.status(404).json({ error: 'Note not found.' });
  }

  if (title === undefined && content === undefined) {
    return res.status(400).json({ error: 'No fields to update.' });
  }

  // Use fixed SQL based on which fields are provided to avoid dynamic construction
  const newTitle = title !== undefined ? title.trim() : undefined;
  const newContent = content !== undefined ? content : undefined;

  if (newTitle !== undefined && newContent !== undefined) {
    db.prepare(
      'UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
    ).run(newTitle, newContent, req.params.id, req.session.userId);
  } else if (newTitle !== undefined) {
    db.prepare(
      'UPDATE notes SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
    ).run(newTitle, req.params.id, req.session.userId);
  } else {
    db.prepare(
      'UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
    ).run(newContent, req.params.id, req.session.userId);
  }

  const updated = db
    .prepare('SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ?')
    .get(req.params.id);

  return res.json(updated);
});

// Delete a note
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const note = db
    .prepare('SELECT id, title FROM notes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);

  if (!note) {
    return res.status(404).json({ error: 'Note not found.' });
  }

  db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(
    req.params.id,
    req.session.userId
  );

  return res.json({ message: 'Note deleted.' });
});

module.exports = router;
