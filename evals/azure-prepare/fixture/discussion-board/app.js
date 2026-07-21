const express = require("express");
const app = express();
app.use(express.json());

const threads = [];

app.get("/threads", (req, res) => res.json(threads));
app.post("/threads", (req, res) => {
  const thread = { id: Date.now(), title: req.body.title, replies: [] };
  threads.push(thread);
  res.status(201).json(thread);
});
app.post("/threads/:id/replies", (req, res) => {
  const thread = threads.find(t => t.id === Number(req.params.id));
  if (!thread) return res.status(404).json({ error: "Not found" });
  thread.replies.push({ text: req.body.text, createdAt: new Date() });
  res.status(201).json(thread);
});

app.listen(3000, () => console.log("Discussion board on :3000"));
