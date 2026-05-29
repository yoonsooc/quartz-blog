#!/usr/bin/env node
// Tiny static server that mirrors GitHub Pages behavior: clean URLs map to
// .html files (so /hello-world resolves to /hello-world.html). Used by
// `npm run preview:secure` to exercise the encrypted public/ build locally.

import http from "node:http"
import handler from "serve-handler"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PUBLIC_DIR = join(ROOT, "public")
const PORT = Number(process.env.PORT ?? 8080)

const server = http.createServer((req, res) =>
  handler(req, res, {
    public: PUBLIC_DIR,
    cleanUrls: true,
    trailingSlash: false,
  }),
)

server.listen(PORT, () => {
  console.log(`\n==> Serving public/ at http://localhost:${PORT}`)
  console.log(`    Clean URLs enabled (/hello-world → /hello-world.html)\n`)
})
