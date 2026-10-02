// 섹션의 노트와 분류를 계산한다. 내비게이션 컴포넌트와 디렉토리 변환기가 같은
// 결과를 쓰도록 여기 한곳에 둔다.
//
// 변환 단계에서는 다른 파일의 파싱 결과를 볼 수 없고, 비공개 섹션은 태그를
// frontmatter에서 지우기 때문에(section-privacy), 노트 정보는 디스크에서 직접 읽는다.
//
// 분류 정의(sections 옵션의 categories 항목)
//   { key, label, all: true }       섹션의 모든 노트
//   { key, label, tag }             frontmatter tags에 해당 태그가 있는 노트
//   { key, label, default: true }   어느 태그 분류에도 들지 않은 노트
//   { fromTags: true }              노트에 쓰인 태그마다 분류를 하나씩 만든다
//   { key, label, urlEnv }          노트 대신 외부 페이지. 주소는 환경변수에서 읽고,
//                                   값이 없으면 분류를 숨긴다
import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"

const frontmatterRegex = /^﻿?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const warned = new Set()
let cache = { buildId: undefined, values: new Map() }

// 가장 긴 prefix가 맞는 섹션. 어디에도 속하지 않으면 루트 섹션(prefix "")이다.
export function sectionOf(slug, sections) {
  let best = sections.find((s) => s.prefix === "")
  for (const s of sections) {
    if (s.prefix === "") continue
    const inside = slug === s.prefix || slug.startsWith(`${s.prefix}/`)
    if (inside && (!best || s.prefix.length > best.prefix.length)) best = s
  }
  return best
}

export const indexSlug = (section) => (section.prefix === "" ? "index" : `${section.prefix}/index`)

function readFrontmatter(absPath) {
  try {
    const match = fs.readFileSync(absPath, "utf8").match(frontmatterRegex)
    const data = match ? YAML.parse(match[1]) : null
    return data && typeof data === "object" && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

function tagsOf(frontmatter) {
  const raw = frontmatter.tags ?? frontmatter.tag
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : []
  return list.map((t) => String(t).trim().replace(/^#/, "").toLowerCase()).filter(Boolean)
}

// 정렬용 날짜 문자열. 날짜가 없거나 해석할 수 없으면 빈 문자열이다.
function sortableDate(raw) {
  const time = raw ? new Date(raw).getTime() : NaN
  return Number.isNaN(time) ? "" : new Date(time).toISOString()
}

// explicit-publish, remove-draft 필터와 같은 기준. 필터는 파싱 뒤에 적용되므로
// 여기서 미리 걸러 두지 않으면 게시되지 않는 노트로 가는 죽은 링크가 생긴다.
const isPublished = (fm) => (fm.publish === true || fm.publish === "true") && fm.draft !== true

// frontmatter에 날짜가 없는 노트(위키에서 온 메모에 흔하다)는 파일 수정 시각을 쓴다.
// created-modified-date 플러그인이 frontmatter 다음에 파일 시각을 보는 것과 같은 순서다.
function noteDate(frontmatter, absPath) {
  const fromFrontmatter = sortableDate(
    frontmatter.date ?? frontmatter.created ?? frontmatter.modified,
  )
  if (fromFrontmatter) return fromFrontmatter
  try {
    return fs.statSync(absPath).mtime.toISOString()
  } catch {
    return ""
  }
}

function readSectionNotes(ctx, section, sections) {
  const notes = []
  ctx.allFiles.forEach((filePath, i) => {
    const slug = ctx.allSlugs[i]
    if (!filePath.endsWith(".md") || slug === indexSlug(section)) return
    if (sectionOf(slug, sections) !== section) return
    const absPath = path.join(ctx.argv.directory, filePath)
    const frontmatter = readFrontmatter(absPath)
    if (!isPublished(frontmatter)) return
    const parts = (section.prefix === "" ? slug : slug.slice(section.prefix.length + 1)).split("/")
    const name = parts[parts.length - 1]
    notes.push({
      slug,
      name,
      // 비공개 섹션의 제목은 파일 이름으로 통일한다 (section-privacy의 소독 규칙과 같다)
      title: section.private
        ? name
        : String(frontmatter.title ?? path.basename(filePath, ".md").normalize("NFC")),
      folder: parts.slice(0, -1).join("/"),
      tags: tagsOf(frontmatter),
      date: noteDate(frontmatter, absPath),
    })
  })
  return notes
}

// 컴포넌트는 페이지마다 호출되므로 빌드 1회 동안은 결과를 재사용한다
function memo(ctx, key, compute) {
  if (cache.buildId !== ctx.buildId) cache = { buildId: ctx.buildId, values: new Map() }
  if (!cache.values.has(key)) cache.values.set(key, compute())
  return cache.values.get(key)
}

const sectionNotes = (ctx, section, sections) =>
  memo(ctx, `notes:${section.key}`, () => readSectionNotes(ctx, section, sections))

// 섹션의 노트를 최신순으로 돌려준다 (내비게이션의 "최근 글" 목록용)
export function recentNotes(ctx, section, sections) {
  return memo(ctx, `recent:${section.key}`, () =>
    [...sectionNotes(ctx, section, sections)].sort(
      (a, b) => b.date.localeCompare(a.date) || b.name.localeCompare(a.name),
    ),
  )
}

function expandCategories(section, notes) {
  const explicitTags = new Set(
    (section.categories ?? []).filter((c) => c.tag).map((c) => String(c.tag).toLowerCase()),
  )
  return (section.categories ?? []).flatMap((c) => {
    if (c.fromTags) {
      const counts = new Map()
      for (const tag of notes.flatMap((n) => n.tags)) {
        if (!explicitTags.has(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([tag]) => ({ key: tag, label: tag, tag }))
    }
    if (c.urlEnv) {
      const url = process.env[c.urlEnv]
      if (url) return [{ ...c, url }]
      if (!warned.has(c.urlEnv)) {
        warned.add(c.urlEnv)
        console.warn(`[section-nav] ${c.urlEnv}가 없어 "${c.label}" 분류를 숨깁니다`)
      }
      return []
    }
    return [c]
  })
}

// 반환: [{ key, label, url? , notes }] — url이 있으면 외부 페이지 분류다
function resolve(ctx, section, sections) {
  if (!section.categories?.length) return []
  const notes = sectionNotes(ctx, section, sections)
  const categories = expandCategories(section, notes)
  const tagKeys = categories.filter((c) => c.tag).map((c) => String(c.tag).toLowerCase())
  const members = (c) => {
    if (c.url) return []
    if (c.all) return notes
    if (c.tag) return notes.filter((n) => n.tags.includes(String(c.tag).toLowerCase()))
    if (c.default) return notes.filter((n) => !n.tags.some((t) => tagKeys.includes(t)))
    return []
  }
  return categories.map((c) => ({
    key: String(c.key),
    label: c.label,
    url: c.url,
    notes: members(c),
  }))
}

export function resolveCategories(ctx, section, sections) {
  return memo(ctx, `categories:${section.key}`, () => resolve(ctx, section, sections))
}

// 분류를 정의하지 않은 섹션의 노트 전체 (비공개 섹션의 묶지 않은 목록용)
export function allNotes(ctx, section, sections) {
  return sectionNotes(ctx, section, sections)
}
