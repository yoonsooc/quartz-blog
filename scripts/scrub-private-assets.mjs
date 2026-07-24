#!/usr/bin/env node
/**
 * v5 빌드 후처리: encrypted-pages가 다루지 않는 잔여 유출 표면 정리.
 *   1. private 섹션의 og-image.webp 삭제 (제목은 소독되지만 파일 자체 불필요)
 *   2. private 노트만 참조하는 attachments를 public/에서 삭제
 *   3. 날짜 형식을 벗어난 private 파일명 경고 (URL·파일 목록 제목 유출 방지)
 *
 * private 섹션 정의는 quartz.config.yaml의 _sections 앵커에서 읽는다.
 */

import { readFileSync, existsSync, rmSync, globSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative, basename } from "node:path"
import YAML from "yaml"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)
const PUBLIC_DIR = join(ROOT, "public")
const CONTENT_DIR = join(ROOT, "content")

const log = (msg) => console.log(`\x1b[1;35m[scrub]\x1b[0m ${msg}`)
const warn = (msg) => console.warn(`\x1b[1;33m[scrub]\x1b[0m ${msg}`)

const config = YAML.parse(readFileSync(join(ROOT, "quartz.config.yaml"), "utf8"))
const sections = config._sections ?? []
const privatePrefixes = sections.filter((s) => s.private && s.prefix !== "").map((s) => s.prefix)

if (!existsSync(PUBLIC_DIR)) {
  console.error(`[scrub] public dir missing: ${PUBLIC_DIR}`)
  process.exit(1)
}

for (const prefix of privatePrefixes) {
  const dir = join(PUBLIC_DIR, prefix)
  if (!existsSync(dir)) continue

  // 1) og-image 삭제
  let removed = 0
  for (const p of globSync("**/*-og-image.webp", { cwd: dir })) {
    rmSync(join(dir, p))
    removed += 1
  }
  if (removed > 0) log(`removed ${removed} og-image(s) under ${prefix}/`)

  // 3) 파일명 경고
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/
  for (const p of globSync("**/*.html", { cwd: dir })) {
    const name = basename(p, ".html")
    if (name === "index" || dateOnly.test(name)) continue
    warn(
      `filename may leak private info: ${relative(ROOT, join(dir, p))} — ` +
        `날짜만 남기고 제목은 본문으로 옮기세요`,
    )
  }
}

// 2) attachments 스크럽 — private 노트만 참조하는 첨부 삭제
scrubPrivateAttachments()
log("done")

function isPrivateContentPath(p) {
  const posix = p.split("\\").join("/")
  return privatePrefixes.some((pre) => posix === pre || posix.startsWith(`${pre}/`))
}

function scrubPrivateAttachments() {
  if (!existsSync(CONTENT_DIR)) return

  const allMd = globSync("**/*.md", { cwd: CONTENT_DIR })
  const privateMd = allMd.filter((p) => isPrivateContentPath(p))
  const publicMd = allMd.filter((p) => !privateMd.includes(p))

  const readAll = (files) => files.map((p) => readFileSync(join(CONTENT_DIR, p), "utf8")).join("\n")
  const privateText = readAll(privateMd)
  const publicText = readAll(publicMd)

  // Quartz는 복사 시 파일명을 슬러그화(소문자화, 공백→"-")하므로
  // 대소문자 무시 + 원본 표기(공백/URL 인코딩) 후보를 모두 대조
  const candidatesOf = (name) => [name, name.replace(/-/g, " "), encodeURI(name)]
  const referencedIn = (text, name) => {
    const lower = text.toLowerCase()
    return candidatesOf(name.toLowerCase()).some((c) => lower.includes(c))
  }

  let removed = 0
  for (const rel of globSync("attachments/**/*.*", { cwd: PUBLIC_DIR })) {
    const name = basename(rel)
    if (referencedIn(privateText, name) && !referencedIn(publicText, name)) {
      rmSync(join(PUBLIC_DIR, rel))
      log(`scrubbed private attachment: ${rel}`)
      removed += 1
    }
  }
  if (removed === 0) log("no private-only attachments to scrub")
}
