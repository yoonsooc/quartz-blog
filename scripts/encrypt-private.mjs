#!/usr/bin/env node
/**
 * Quartz build post-processing for private sections (sections.config.json에서
 * private: true인 섹션 전부):
 *   1. HTML을 StatiCrypt로 암호화
 *   2. HTML 외 파일(og-image.webp 등 평문 유출물) 삭제
 *   3. private 노트만 참조하는 attachments 삭제
 *   4. 검색 인덱스·RSS·sitemap에서 항목 스크럽
 *   5. 제목이 드러나는 파일명(날짜 형식 위반) 경고
 *
 * Requires STATICRYPT_PASSWORD in the environment.
 *   STATICRYPT_PASSWORD=hunter2 node scripts/encrypt-private.mjs
 */

import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative, basename } from "node:path"
import { globSync } from "node:fs"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)
const PUBLIC_DIR = join(ROOT, "public")
const CONTENT_DIR = join(ROOT, "content")
const REMEMBER_DAYS = 30

const sectionsConfig = JSON.parse(readFileSync(join(ROOT, "sections.config.json"), "utf8"))
const privateSections = sectionsConfig.sections.filter((s) => s.private && s.prefix !== "")
const privatePrefixes = privateSections.map((s) => s.prefix)

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

for (const section of privateSections) {
  const dir = join(PUBLIC_DIR, section.prefix)
  if (!existsSync(dir)) {
    warn(`no ${section.prefix}/ in build output — nothing to encrypt`)
    continue
  }
  encryptDirectory(dir, section)
  removeNonHtml(dir)
  warnLeakyFilenames(dir)
}

scrubPrivateAttachments()
scrubContentIndex(join(PUBLIC_DIR, "static", "contentIndex.json"))
scrubRss(join(PUBLIC_DIR, "index.xml"))
scrubSitemap(join(PUBLIC_DIR, "sitemap.xml"))

log("done")

// ---------- helpers ----------

function isPrivatePath(slugOrLoc) {
  return privatePrefixes.some(
    (p) =>
      slugOrLoc === p ||
      slugOrLoc.startsWith(`${p}/`) ||
      slugOrLoc.includes(`/${p}/`) ||
      slugOrLoc.endsWith(`/${p}`),
  )
}

function encryptDirectory(dir, section) {
  const htmlFiles = globSync("**/*.html", { cwd: dir }).map((p) => join(dir, p))
  if (htmlFiles.length === 0) {
    warn(`no HTML files under ${relative(ROOT, dir)}`)
    return
  }
  log(`encrypting ${htmlFiles.length} file(s) under ${relative(ROOT, dir)}/`)

  // staticrypt writes encrypted output to a separate directory (-d). We point
  // it at the same directory we read from so files are overwritten in place.
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
        `${section.label} — 비공개`,
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
    if (!existsSync(file)) {
      throw new Error(`encrypted output missing for ${file}`)
    }
  }

  // Clean up the .staticrypt.json salt file if it landed in public/
  const stray = join(PUBLIC_DIR, ".staticrypt.json")
  if (existsSync(stray)) rmSync(stray)
}

/** 암호화 대상 디렉토리에서 HTML 외 파일 전부 삭제 (og-image.webp 등 평문 유출물) */
function removeNonHtml(dir) {
  let removed = 0
  for (const p of globSync("**/*.*", { cwd: dir }).map((p) => join(dir, p))) {
    if (p.endsWith(".html")) continue
    rmSync(p)
    removed += 1
  }
  if (removed > 0) log(`removed ${removed} non-HTML file(s) under ${relative(ROOT, dir)}/`)
}

/** private 파일명이 날짜 형식(YYYY-MM-DD)을 벗어나면 제목 유출 경고 */
function warnLeakyFilenames(dir) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/
  for (const p of globSync("**/*.html", { cwd: dir })) {
    const name = basename(p, ".html")
    if (name === "index") continue
    if (!dateOnly.test(name)) {
      warn(
        `filename may leak private info: ${relative(ROOT, join(dir, p))} — ` +
          `날짜만 남기고 제목은 frontmatter title로 옮기세요`,
      )
    }
  }
}

/** private 노트만 참조하는 첨부파일을 public/에서 삭제 */
function scrubPrivateAttachments() {
  if (!existsSync(CONTENT_DIR)) return

  const allMd = globSync("**/*.md", { cwd: CONTENT_DIR })
  const privateMd = allMd.filter((p) => isPrivatePath(p.split("\\").join("/")))
  const publicMd = allMd.filter((p) => !privateMd.includes(p))

  const readAll = (files) => files.map((p) => readFileSync(join(CONTENT_DIR, p), "utf8")).join("\n")
  const privateText = readAll(privateMd)
  const publicText = readAll(publicMd)

  // 빌드된 첨부 파일 각각에 대해: private 노트가 참조하고 public 노트는 참조하지 않으면 삭제.
  // 참조 검사는 basename 문자열 포함 여부로 판단 (Pasted-image-* 형태라 오탐 여지 낮음).
  // Quartz는 복사 시 파일명을 슬러그화(공백→"-")하므로, 빌드 산출물 이름과
  // 원본 표기(공백/URL 인코딩) 후보를 모두 대조한다.
  const candidatesOf = (name) => [name, name.replace(/-/g, " "), encodeURI(name)]
  const referencedIn = (text, name) => candidatesOf(name).some((c) => text.includes(c))

  const attachmentFiles = globSync("attachments/**/*.*", { cwd: PUBLIC_DIR })
  let removed = 0
  for (const rel of attachmentFiles) {
    const name = basename(rel)
    const inPrivate = referencedIn(privateText, name)
    const inPublic = referencedIn(publicText, name)
    if (inPrivate && !inPublic) {
      rmSync(join(PUBLIC_DIR, rel))
      log(`scrubbed private attachment: ${rel}`)
      removed += 1
    }
  }
  if (removed === 0) log("no private-only attachments to scrub")
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
    if (isPrivatePath(slug)) {
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
    if (isPrivatePath(link)) {
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
    if (isPrivatePath(loc)) {
      removed += 1
      return ""
    }
    return entry
  })
  writeFileSync(file, cleaned)
  log(`scrubbed ${removed} url(s) from sitemap`)
}
