'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let notes = [];
let activeNoteId = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const welcomeMsg = document.getElementById('welcome-msg');
const logoutBtn = document.getElementById('logout-btn');
const notesList = document.getElementById('notes-list');
const newNoteBtn = document.getElementById('new-note-btn');
const emptyState = document.getElementById('empty-state');
const noteEditor = document.getElementById('note-editor');
const noteTitle = document.getElementById('note-title');
const noteContent = document.getElementById('note-content');
const saveNoteBtn = document.getElementById('save-note-btn');
const deleteNoteBtn = document.getElementById('delete-note-btn');
const saveStatus = document.getElementById('save-status');

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function checkSession() {
  try {
    const me = await api('/api/auth/me');
    showApp(me.username);
    await loadNotes();
  } catch {
    showLogin();
  }
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showApp(username) {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  welcomeMsg.textContent = `Hello, ${username}`;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    showApp(data.username);
    await loadNotes();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  notes = [];
  activeNoteId = null;
  loginForm.reset();
  showLogin();
});

// ── Notes ─────────────────────────────────────────────────────────────────────
async function loadNotes() {
  notes = await api('/api/notes');
  renderNotesList();
  if (notes.length > 0) {
    openNote(notes[0].id);
  } else {
    showEmptyState();
  }
}

function renderNotesList() {
  notesList.innerHTML = '';
  notes.forEach((note) => {
    const li = document.createElement('li');
    li.textContent = note.title || 'Untitled';
    li.dataset.id = note.id;
    if (note.id === activeNoteId) li.classList.add('active');
    li.addEventListener('click', () => openNote(note.id));
    notesList.appendChild(li);
  });
}

function openNote(id) {
  activeNoteId = id;
  const note = notes.find((n) => n.id === id);
  if (!note) return;

  emptyState.classList.add('hidden');
  noteEditor.classList.remove('hidden');

  noteTitle.value = note.title;
  noteContent.value = note.content;
  saveStatus.textContent = '';

  renderNotesList(); // refresh active highlight
}

function showEmptyState() {
  activeNoteId = null;
  emptyState.classList.remove('hidden');
  noteEditor.classList.add('hidden');
}

newNoteBtn.addEventListener('click', async () => {
  try {
    const note = await api('/api/notes', {
      method: 'POST',
      body: { title: 'New Note', content: '' },
    });
    notes.push(note);
    renderNotesList();
    openNote(note.id);
  } catch (err) {
    alert('Could not create note: ' + err.message);
  }
});

saveNoteBtn.addEventListener('click', async () => {
  if (!activeNoteId) return;
  const title = noteTitle.value.trim();
  const content = noteContent.value;

  if (!title) {
    alert('Title cannot be empty.');
    return;
  }

  try {
    const updated = await api(`/api/notes/${activeNoteId}`, {
      method: 'PUT',
      body: { title, content },
    });
    const idx = notes.findIndex((n) => n.id === activeNoteId);
    if (idx !== -1) notes[idx] = updated;
    renderNotesList();
    saveStatus.textContent = 'Saved ✓';
    setTimeout(() => (saveStatus.textContent = ''), 2000);
  } catch (err) {
    alert('Could not save: ' + err.message);
  }
});

deleteNoteBtn.addEventListener('click', async () => {
  if (!activeNoteId) return;
  const note = notes.find((n) => n.id === activeNoteId);
  if (!confirm(`Delete "${note?.title || 'this note'}"?`)) return;

  try {
    await api(`/api/notes/${activeNoteId}`, { method: 'DELETE' });
    notes = notes.filter((n) => n.id !== activeNoteId);
    renderNotesList();
    if (notes.length > 0) {
      openNote(notes[0].id);
    } else {
      showEmptyState();
    }
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
checkSession();
