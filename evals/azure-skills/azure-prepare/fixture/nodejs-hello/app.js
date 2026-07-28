const http = require("http");
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Hello, World!\n");
}).listen(PORT, () => console.log(`Server running on port ${PORT}`));
