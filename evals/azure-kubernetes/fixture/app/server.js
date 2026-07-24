const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/health", (_req, res) => res.status(200).send("ok"));
app.get("/", (_req, res) => res.send("hello from sample-express-api"));

app.listen(port, () => console.log(`listening on ${port}`));
