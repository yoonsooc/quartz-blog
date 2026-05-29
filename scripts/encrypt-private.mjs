#!/usr/bin/env node
/**
 * Quartz build post-processing: encrypt /daily/* with StatiCrypt and scrub
 * leaks from the search index, RSS feed, and sitemap.
 *
 * Requires STATICRYPT_PASSWORD in the environment.
 *   STATICRYPT_PASSWORD=hunter2 node scripts/encrypt-private.mjs
 */

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync, renameSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative } from "node:path"
import { globSync } from "node:fs"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)
const PUBLIC_DIR = join(ROOT, "public")
const PROTECTED_PREFIX = "daily"
const REMEMBER_DAYS = 30

const log = (msg) => console.log(`\x1b[1;35m[encrypt]\x1b[0m ${msg}`)
const warn = (msg) => console.warn(`\x1b[1;33m[encrypt]\x1b[0m ${msg}`)

// Auto-load .env at repo root if STATICRYPT_PASSWORD isn't already in env.
if (!process.env.STATICRYPT_PASSWORD) {
  const envPath = join(ROOT, ".env")
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const [, k, vRaw] = m
      const v = vRaw.replace(/^['"]|['"]$/g, "")
      if (!(k in process.env)) process.env[k] = v
    }
  }
}

const password = process.env.STATICRYPT_PASSWORD
if (!password) {
  console.error(
    "[encrypt] STATICRYPT_PASSWORD is not set. Put it in .env or export it before running.",
  )
  process.exit(1)
}

if (!existsSync(PUBLIC_DIR)) {
  console.error(`[encrypt] public dir missing: ${PUBLIC_DIR}`)
  process.exit(1)
}

const protectedDir = join(PUBLIC_DIR, PROTECTED_PREFIX)
if (!existsSync(protectedDir)) {
  warn(`no ${PROTECTED_PREFIX}/ in build output — nothing to encrypt`)
} else {
  encryptDirectory(protectedDir)
}

scrubContentIndex(join(PUBLIC_DIR, "static", "contentIndex.json"))
scrubRss(join(PUBLIC_DIR, "index.xml"))
scrubSitemap(join(PUBLIC_DIR, "sitemap.xml"))

log("done")

// ---------- helpers ----------

function encryptDirectory(dir) {
  const htmlFiles = globSync("**/*.html", { cwd: dir }).map((p) => join(dir, p))
  if (htmlFiles.length === 0) {
    warn(`no HTML files under ${relative(ROOT, dir)}`)
    return
  }
  log(`encrypting ${htmlFiles.length} file(s) under ${relative(ROOT, dir)}/`)

  // staticrypt writes encrypted output to a separate directory (-d). We point
  // it at the same directory we read from so files are overwritten in place.
  // It preserves the relative structure when called with multiple inputs.
  for (const file of htmlFiles) {
    execFileSync(
      "npx",
      [
        "staticrypt",
        file,
        "--password",
        password,
        "--short",
        "--remember",
        String(REMEMBER_DAYS),
        "--template",
        join(HERE, "staticrypt-template.html"),
        "--template-title",
        "Daily — 비공개",
        "--template-instructions",
        "비밀번호를 입력해 주세요.",
        "--template-button",
        "Unlock",
        "--template-placeholder",
        "Password",
        "--template-error",
        "비밀번호가 올바르지 않습니다.",
        "--template-remember",
        "이 브라우저에서 기억하기",
        "-d",
        dirname(file),
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    )
    // staticrypt writes <name>.html in -d directory. If input filename equals
    // output filename (same dir), it overwrites in place. Verify and continue.
    if (!existsSync(file)) {
      throw new Error(`encrypted output missing for ${file}`)
    }
  }

  // Clean up the .staticrypt.json salt file if it landed in public/
  const stray = join(PUBLIC_DIR, ".staticrypt.json")
  if (existsSync(stray)) rmSync(stray)
}

function scrubContentIndex(file) {
  if (!existsSync(file)) return
  const raw = readFileSync(file, "utf8")
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    warn(`could not parse ${relative(ROOT, file)}`)
    return
  }
  let removed = 0
  for (const slug of Object.keys(data)) {
    if (slug === PROTECTED_PREFIX || slug.startsWith(`${PROTECTED_PREFIX}/`)) {
      delete data[slug]
      removed += 1
    }
  }
  writeFileSync(file, JSON.stringify(data))
  log(`scrubbed ${removed} entr${removed === 1 ? "y" : "ies"} from contentIndex.json`)
}

function scrubRss(file) {
  if (!existsSync(file)) return
  const xml = readFileSync(file, "utf8")
  const itemRe = /<item>[\s\S]*?<\/item>/g
  let removed = 0
  const cleaned = xml.replace(itemRe, (item) => {
    const link = /<link>([^<]+)<\/link>/.exec(item)?.[1] ?? ""
    if (link.includes(`/${PROTECTED_PREFIX}/`) || link.endsWith(`/${PROTECTED_PREFIX}`)) {
      removed += 1
      return ""
    }
    return item
  })
  writeFileSync(file, cleaned)
  log(`scrubbed ${removed} item(s) from RSS feed`)
}

function scrubSitemap(file) {
  if (!existsSync(file)) return
  const xml = readFileSync(file, "utf8")
  const urlRe = /<url>[\s\S]*?<\/url>/g
  let removed = 0
  const cleaned = xml.replace(urlRe, (entry) => {
    const loc = /<loc>([^<]+)<\/loc>/.exec(entry)?.[1] ?? ""
    if (loc.includes(`/${PROTECTED_PREFIX}/`) || loc.endsWith(`/${PROTECTED_PREFIX}`)) {
      removed += 1
      return ""
    }
    return entry
  })
  writeFileSync(file, cleaned)
  log(`scrubbed ${removed} url(s) from sitemap`)
}
