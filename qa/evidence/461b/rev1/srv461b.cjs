// job 461-B read-only harness: serves a production build and answers /api/* with 500, so the footer
// being measured is the one the build ships, not something fetched at runtime.
// usage: node srv461.cjs <distDir> <port>
const http = require("http"), fs = require("fs"), path = require("path");

const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3] || 3681);

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url.startsWith("/api/")) {
    res.writeHead(500, { "content-type": "application/json" });
    return res.end('{"error":"461-B harness"}');
  }
  if (req.method !== "GET") { res.writeHead(501); return res.end("{}"); }
  let file = path.join(root, url === "/" ? "index.html" : url);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, "index.html");
  const type = file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html";
  res.writeHead(200, { "content-type": type });
  res.end(fs.readFileSync(file));
}).listen(port, () => console.log(`461-B harness :${port} root=${root}`));
