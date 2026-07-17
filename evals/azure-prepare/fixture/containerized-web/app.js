const express = require("express");
const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("<h1>My Web App</h1><p>Running in a container.</p>"));
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`App listening on port ${PORT}`));
