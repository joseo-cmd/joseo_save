const fs = require("fs");
const path = require("path");
const { buildStandaloneHtml } = require("../js/download.js");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const html = buildStandaloneHtml({
  css: read("css/app.css"),
  store: read("js/store.js"),
  app: read("js/app.js"),
  admin: read("js/admin.js"),
  download: read("js/download.js"),
  entries: []
});

const out = path.join(root, "회계분개-부가세안내.html");
fs.writeFileSync(out, html);
console.log("wrote", out, Buffer.byteLength(html), "bytes");
