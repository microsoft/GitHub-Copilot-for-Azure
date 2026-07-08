const express = require("express");
const app = express();
app.use(express.json());

const posts = [];

app.get("/posts", (req, res) => res.json(posts));
app.post("/posts", (req, res) => {
  const post = { id: Date.now(), text: req.body.text, likes: 0, comments: [] };
  posts.push(post);
  res.status(201).json(post);
});
app.post("/posts/:id/like", (req, res) => {
  const post = posts.find(p => p.id === Number(req.params.id));
  if (!post) return res.status(404).json({ error: "Not found" });
  post.likes++;
  res.json(post);
});
app.post("/posts/:id/comments", (req, res) => {
  const post = posts.find(p => p.id === Number(req.params.id));
  if (!post) return res.status(404).json({ error: "Not found" });
  post.comments.push({ text: req.body.text });
  res.status(201).json(post);
});

app.listen(3000, () => console.log("Social app listening on :3000"));
