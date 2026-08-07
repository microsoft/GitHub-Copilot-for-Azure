const express = require("express");
const app = express();
app.use(express.json());

const todos = [];

app.get("/api/todos", (req, res) => res.json(todos));
app.post("/api/todos", (req, res) => {
  const todo = { id: Date.now(), text: req.body.text, done: false };
  todos.push(todo);
  res.status(201).json(todo);
});
app.patch("/api/todos/:id", (req, res) => {
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: "Not found" });
  Object.assign(todo, req.body);
  res.json(todo);
});
app.delete("/api/todos/:id", (req, res) => {
  const idx = todos.findIndex(t => t.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  todos.splice(idx, 1);
  res.status(204).end();
});

app.listen(3001, () => console.log("Todo API on :3001"));
