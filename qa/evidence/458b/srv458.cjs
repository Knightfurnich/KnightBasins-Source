// 458-B measurement harness (read-only): serves a production build of the storefront for the
// standalone pages and stubs the API so the page renders the same way on every run.
// usage: node srv458.cjs <distDir> <port>
const http = require("http"), fs = require("fs"), path = require("path");

const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3] || 3599);
const ROUTES = ["/", "/readme", "/site-prep", "/portfolio", "/price-guide", "/quote"];

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  if (url.startsWith("/api/")) {
    res.writeHead(500, { "content-type": "application/json" });
    return res.end('{"error":"458-B harness: api is stubbed, the page must render from the build alone"}');
  }
  if (req.method !== "GET") { res.writeHead(501); return res.end("{}"); }
  let file = path.join(root, ROUTES.includes(url) ? `${url === "/" ? "" : url}/index.html` : url);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, "index.html");
  const type = file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html";
  res.writeHead(200, { "content-type": type });
  res.end(fs.readFileSync(file));
}).listen(port, () => console.log(`458-B harness :${port} root=${root}`));
