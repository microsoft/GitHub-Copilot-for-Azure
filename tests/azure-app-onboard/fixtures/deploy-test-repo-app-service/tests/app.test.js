'use strict';

const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Use an in-memory / temp DB for testing
const TEST_DB = path.join('/tmp', `test-notes-${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;

// Re-require after setting env var
const { createApp } = require('../src/app');
const { setup, closeDb } = require('../src/db');

let app;

beforeAll(() => {
  setup();
  app = createApp();
});

afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  // Clean WAL files
  [TEST_DB + '-shm', TEST_DB + '-wal'].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

// ── Helper: log in as user1 ────────────────────────────────────────────────────
async function loginAs(agent, username, password) {
  await agent.post('/api/auth/login').send({ username, password });
}

// ── Auth tests ────────────────────────────────────────────────────────────────
describe('Authentication', () => {
  test('15 users are seeded', async () => {
    const { getDb } = require('../src/db');
    const count = getDb().prepare('SELECT COUNT(*) as c FROM users').get().c;
    expect(count).toBe(15);
  });

  test('GET /api/auth/me returns 401 when not logged in', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login with bad credentials returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user1', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login succeeds for all 15 users', async () => {
    for (let i = 1; i <= 15; i++) {
      const agent = request.agent(app);
      const res = await agent
        .post('/api/auth/login')
        .send({ username: `user${i}`, password: `password${i}` });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(`user${i}`);
    }
  });

  test('GET /api/auth/me returns user info after login', async () => {
    const agent = request.agent(app);
    await loginAs(agent, 'user1', 'password1');
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('user1');
  });

  test('POST /api/auth/logout ends session', async () => {
    const agent = request.agent(app);
    await loginAs(agent, 'user1', 'password1');
    await agent.post('/api/auth/logout');
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ── Notes tests ───────────────────────────────────────────────────────────────
describe('Notes', () => {
  let agent;

  beforeEach(async () => {
    agent = request.agent(app);
    await loginAs(agent, 'user1', 'password1');
  });

  test('each user starts with a "Todo" note', async () => {
    const res = await agent.get('/api/notes');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const todoNote = res.body.find((n) => n.title === 'Todo');
    expect(todoNote).toBeDefined();
  });

  test('GET /api/notes returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(401);
  });

  test('POST /api/notes creates a new note', async () => {
    const res = await agent
      .post('/api/notes')
      .send({ title: 'My Note', content: 'Hello world' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('My Note');
    expect(res.body.content).toBe('Hello world');
  });

  test('POST /api/notes returns 400 when title is missing', async () => {
    const res = await agent.post('/api/notes').send({ content: 'no title' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/notes/:id updates a note', async () => {
    const createRes = await agent
      .post('/api/notes')
      .send({ title: 'Update me', content: 'old' });
    const id = createRes.body.id;

    const res = await agent
      .put(`/api/notes/${id}`)
      .send({ title: 'Updated', content: 'new content' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(res.body.content).toBe('new content');
  });

  test('DELETE /api/notes/:id deletes a note', async () => {
    const createRes = await agent
      .post('/api/notes')
      .send({ title: 'Delete me', content: '' });
    const id = createRes.body.id;

    const delRes = await agent.delete(`/api/notes/${id}`);
    expect(delRes.status).toBe(200);

    const getRes = await agent.get(`/api/notes/${id}`);
    expect(getRes.status).toBe(404);
  });

  test('user cannot access another user note', async () => {
    // create note as user1
    const createRes = await agent
      .post('/api/notes')
      .send({ title: 'Private', content: 'secret' });
    const id = createRes.body.id;

    // try to access as user2
    const agent2 = request.agent(app);
    await loginAs(agent2, 'user2', 'password2');
    const res = await agent2.get(`/api/notes/${id}`);
    expect(res.status).toBe(404);
  });
});
