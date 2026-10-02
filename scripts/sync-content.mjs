#!/usr/bin/env node
/**
 * 볼트 전체에서 게시 대상만 모아 Quartz의 content를 구성한다.
 *
 * Quartz는 content 안의 마크다운이 아닌 파일을 publish 여부와 상관없이 전부 출력으로
 * 복사한다. 그래서 content를 볼트 루트로 두면 게시하지 않는 노트의 첨부까지 공개된다.
 * 이 스크립트는 반대로 "허용한 것만" 모은다:
 *   1. 볼트에서 frontmatter가 publish: true인 노트를 찾는다 (draft: true는 제외).
 *   2. quartz.config.yaml의 _publish.routes에 따라 주소(폴더)를 정한다.
 *   3. 그 노트가 참조하는 첨부 파일만 함께 모은다.
 *
 * 모은 결과는 저장소 밖의 수집 폴더에 "원본을 가리키는 링크"로 만든다. 복사본이
 * 아니므로 볼트에서 노트를 고치면 --serve가 바로 다시 빌드한다. 저장소의 content는
 * 그 수집 폴더를 가리키는 링크다. (수집 폴더를 저장소 안에 두면 Quartz가 .gitignore의
 * content 항목 때문에 모든 파일을 무시한다.)
 *
 * 새 노트에 publish: true를 붙였거나 뺐을 때는 이 스크립트를 다시 실행해야 한다.
 *
 * 환경변수
 *   OBSIDIAN_VAULT_ROOT     볼트 루트 (필수. 없으면 기존 content 링크에서 추정한다)
 *   QUARTZ_CONTENT_STAGING  수집 폴더 (기본 ~/.cache/quartz-blog-content)
 *   QUARTZ_CONTENT_LINK     content 링크 위치 (기본 <저장소>/content)
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import YAML from "yaml"

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CONTENT_LINK = process.env.QUARTZ_CONTENT_LINK ?? path.join(ROOT, "content")
const STAGING =
  process.env.QUARTZ_CONTENT_STAGING ?? path.join(os.homedir(), ".cache", "quartz-blog-content")
const GENERATED_MARK = "generated: sync-content"

const ATTACHMENT_EXTENSIONS = new Set(
  "png jpg jpeg gif webp svg avif bmp pdf mp4 webm mov mp3 wav ogg m4a".split(" "),
)
const frontmatterRegex = /^﻿?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

const log = (msg) => console.log(`\x1b[1;34m[sync]\x1b[0m ${msg}`)
const warn = (msg) => console.warn(`\x1b[1;33m[sync]\x1b[0m ${msg}`)
const fail = (msg) => {
  console.error(`\x1b[1;31m[sync]\x1b[0m ${msg}`)
  process.exit(1)
}
const nfc = (s) => s.normalize("NFC")

// ---------- 설정 ----------
const config = YAML.parse(fs.readFileSync(path.join(ROOT, "quartz.config.yaml"), "utf8"))
const publish = config._publish ?? {}
const routes = publish.routes ?? []
const excluded = (publish.exclude ?? []).map((p) => nfc(String(p)).replace(/^\/+|\/+$/g, ""))
const attachmentsDir = publish.attachments ?? "attachments"
const sections = config._sections ?? []
if (routes.length === 0) fail("quartz.config.yaml에 _publish.routes가 없습니다")

function findVaultRoot() {
  if (process.env.OBSIDIAN_VAULT_ROOT) return fs.realpathSync(process.env.OBSIDIAN_VAULT_ROOT)
  // 이전 구성(content가 볼트 안의 폴더를 직접 가리키는 링크)에서 넘어오는 경우
  try {
    let dir = fs.realpathSync(CONTENT_LINK)
    while (path.dirname(dir) !== dir) {
      if (fs.existsSync(path.join(dir, ".obsidian"))) return dir
      dir = path.dirname(dir)
    }
  } catch {}
  return undefined
}

const vaultRoot = findVaultRoot()
if (!vaultRoot) {
  fail("볼트 루트를 찾지 못했습니다. .env에 OBSIDIAN_VAULT_ROOT를 지정하세요")
}

// ---------- 볼트 훑기 ----------
// macOS/Google Drive는 파일명을 NFD로 돌려줄 수 있으므로 비교용 경로(rel)는 NFC로
// 정규화하고, 실제 접근에는 디스크가 돌려준 경로(abs)를 쓴다.
const isUnder = (rel, folder) => folder === "" || rel === folder || rel.startsWith(`${folder}/`)
const files = []
;(function walk(absDir, relDir) {
  for (const d of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (d.name.startsWith(".") || d.name === "node_modules") continue
    const abs = path.join(absDir, d.name)
    const rel = relDir ? `${relDir}/${nfc(d.name)}` : nfc(d.name)
    if (excluded.some((folder) => isUnder(rel, folder))) continue
    if (d.isDirectory()) walk(abs, rel)
    else if (d.isFile()) files.push({ abs, rel, name: nfc(d.name) })
  }
})(vaultRoot, "")

function readNote(abs) {
  const source = fs.readFileSync(abs, "utf8")
  const match = source.match(frontmatterRegex)
  let frontmatter = {}
  try {
    const parsed = match ? YAML.parse(match[1]) : null
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) frontmatter = parsed
  } catch {}
  return { frontmatter, body: match ? source.slice(match[0].length) : source }
}

// explicit-publish, remove-draft 필터와 같은 기준
const isPublished = (fm) => (fm.publish === true || fm.publish === "true") && fm.draft !== true

// ---------- 게시 노트와 목적지 ----------
function destinationOf(rel) {
  for (const route of routes) {
    const from = nfc(String(route.from ?? "")).replace(/^\/+|\/+$/g, "")
    if (!isUnder(rel, from)) continue
    const inside = from === "" ? rel : rel.slice(from.length + 1)
    const tail = route.flatten ? inside.slice(inside.lastIndexOf("/") + 1) : inside
    return { route, dest: `${route.to}/${tail}` }
  }
  return undefined
}

const staged = new Map() // 목적지(content 기준 경로, 소문자) → { abs, rel, dest }
const notes = []
for (const file of files.filter((f) => f.name.toLowerCase().endsWith(".md"))) {
  const note = readNote(file.abs)
  if (!isPublished(note.frontmatter)) continue
  const target = destinationOf(file.rel)
  if (!target) continue
  const key = target.dest.toLowerCase()
  if (staged.has(key)) {
    // 조용히 하나를 빼면 글이 사라진 것을 알아채기 어려우므로 멈춘다
    fail(
      `주소가 겹칩니다: "${staged.get(key).rel}" 와 "${file.rel}" 가 모두 ${target.dest} 로 갑니다. ` +
        `한쪽의 파일 이름을 바꾸거나 publish를 끄세요`,
    )
  }
  staged.set(key, { abs: file.abs, rel: file.rel, dest: target.dest })
  notes.push({ ...file, ...note, route: target.route })
}

// ---------- 첨부 파일: 게시 노트가 참조하는 것만 ----------
const byName = new Map()
for (const f of files) {
  const ext = path.extname(f.name).slice(1).toLowerCase()
  if (!ATTACHMENT_EXTENSIONS.has(ext)) continue
  const key = f.name.toLowerCase()
  // 옵시디언의 최단 경로 규칙: 같은 이름이면 더 얕은 경로가 이긴다
  const prev = byName.get(key)
  if (!prev || f.rel.split("/").length < prev.rel.split("/").length) byName.set(key, f)
}
const byRel = new Map(files.map((f) => [f.rel.toLowerCase(), f]))

function referencedAttachments(body) {
  const text = body.replace(/^( {0,3})(`{3,}|~{3,})[\s\S]*?^\1\2\s*$/gm, "") // 코드 블록 안의 예시는 제외
  const targets = []
  for (const m of text.matchAll(/!?\[\[([^\]|#]+?)(?:[|#][^\]]*)?\]\]/g)) targets.push(m[1])
  for (const m of text.matchAll(/!?\[[^\]]*\]\(<?([^)>\s]+)>?(?:\s+"[^"]*")?\)/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(m[1])) continue // 외부 주소
    try {
      targets.push(decodeURI(m[1]))
    } catch {
      targets.push(m[1]) // "%"가 잘못 쓰인 링크는 적힌 그대로 찾는다
    }
  }
  return targets
    .map((t) => nfc(t.trim()).replace(/^\/+/, ""))
    .filter((t) => ATTACHMENT_EXTENSIONS.has(path.extname(t).slice(1).toLowerCase()))
}

const attachments = new Map() // 파일 이름(소문자) → 파일
for (const note of notes) {
  for (const target of referencedAttachments(note.body)) {
    const name = target.slice(target.lastIndexOf("/") + 1).toLowerCase()
    const file = byRel.get(target.toLowerCase()) ?? byName.get(name)
    if (!file) {
      warn(`첨부를 찾지 못했습니다: "${target}" (${note.rel})`)
      continue
    }
    const prev = attachments.get(name)
    if (prev && prev.abs !== file.abs) {
      warn(`같은 이름의 첨부가 둘입니다: "${prev.rel}" 를 쓰고 "${file.rel}" 는 건너뜁니다`)
      continue
    }
    attachments.set(name, file)
  }
}

// ---------- 수집 폴더 다시 만들기 ----------
// 수집 폴더에는 링크와 이 스크립트가 만든 파일만 있어야 한다. 그 외의 실제 파일이
// 하나라도 있으면 사용자의 자료일 수 있으므로 지우지 않고 멈춘다.
function assertDisposable(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name)
    if (d.isSymbolicLink()) continue
    if (d.isDirectory()) assertDisposable(p)
    else if (!fs.readFileSync(p, "utf8").includes(GENERATED_MARK)) {
      fail(`수집 폴더에 이 스크립트가 만들지 않은 파일이 있어 중단합니다: ${p}`)
    }
  }
}

if (fs.existsSync(STAGING)) {
  if (fs.lstatSync(STAGING).isSymbolicLink() || !fs.statSync(STAGING).isDirectory()) {
    fail(`수집 폴더 경로가 일반 폴더가 아닙니다: ${STAGING}`)
  }
  assertDisposable(STAGING)
  fs.rmSync(STAGING, { recursive: true }) // 링크는 링크만 지워지고 원본은 그대로다
}
fs.mkdirSync(STAGING, { recursive: true })

const link = (source, dest) => {
  const target = path.join(STAGING, dest)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.symlinkSync(source, target)
}
for (const { abs, dest } of staged.values()) link(abs, dest)
for (const file of attachments.values()) link(file.abs, `${attachmentsDir}/${file.name}`)

// 노트가 있는데 index.md가 없는 주소에는 인덱스를 만들어 준다. 섹션 디렉토리(분류
// 목록)가 인덱스 본문에 들어가기 때문에 인덱스가 있어야 한다.
const generated = []
for (const route of routes) {
  const hasNotes = notes.some((n) => n.route === route)
  const indexDest = `${route.to}/index.md`
  if (!hasNotes || staged.has(indexDest.toLowerCase())) continue
  const section = sections.find((s) => s.prefix === route.to)
  const title = section?.label ?? route.to
  const target = path.join(STAGING, indexDest)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `---\ntitle: ${title}\npublish: true\n${GENERATED_MARK}\n---\n`)
  generated.push(indexDest)
}

// ---------- content 링크 ----------
const stat = fs.lstatSync(CONTENT_LINK, { throwIfNoEntry: false })
if (stat && !stat.isSymbolicLink()) {
  fail(`${CONTENT_LINK} 가 링크가 아닌 실제 폴더/파일이라 바꾸지 않습니다. 직접 확인하세요`)
}
if (!stat || fs.readlinkSync(CONTENT_LINK) !== STAGING) {
  if (stat) fs.unlinkSync(CONTENT_LINK)
  fs.symlinkSync(STAGING, CONTENT_LINK)
  log(`content → ${STAGING}`)
}

// ---------- 요약 ----------
for (const route of routes) {
  const count = notes.filter((n) => n.route === route).length
  log(`/${route.to}: 노트 ${count}개 (볼트의 "${route.from || "그 외 전체"}")`)
}
log(
  `첨부 ${attachments.size}개` +
    (generated.length ? `, 생성한 인덱스: ${generated.join(", ")}` : ""),
)
