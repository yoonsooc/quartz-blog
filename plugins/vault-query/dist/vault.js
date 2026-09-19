// 볼트 인덱스. content 밖의 비게시 노트까지 포함해 경로를 수집하고,
// frontmatter는 실제로 조회되는 파일만 지연 로딩한다(mtime 기준 캐시).
// macOS/Google Drive는 파일명을 NFD로 돌려줄 수 있으므로 비교용 경로는 모두
// NFC로 정규화하고, 실제 파일 접근에는 디스크가 돌려준 원래 경로(abs)를 쓴다.
import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"

const INDEX_TTL_MS = 5000
const SKIP_DIRS = new Set(["node_modules"])
const frontmatterRegex = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

export const nfc = (s) => s.normalize("NFC")

export function parseFrontmatter(source) {
  const match = source.match(frontmatterRegex)
  if (!match) return { data: {}, body: source, raw: "" }
  let data = {}
  try {
    const parsed = YAML.parse(match[1])
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed
  } catch {
    // 깨진 frontmatter는 속성 없는 노트로 취급
  }
  return { data, body: source.slice(match[0].length), raw: match[0] }
}

export function findVaultRoot(contentDir, explicit) {
  if (explicit) return fs.realpathSync(explicit)
  let dir = fs.realpathSync(contentDir)
  while (true) {
    if (fs.existsSync(path.join(dir, ".obsidian"))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

export function normalizeTags(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : []
  return list
    .filter((t) => typeof t === "string" && t.trim() !== "")
    .map((t) => nfc(t.trim().replace(/^#/, "")))
}

export class Vault {
  constructor(root, contentDir) {
    this.root = root
    this.contentRoot = fs.realpathSync(contentDir)
    this.entries = []
    this.builtAt = 0
    this.pageCache = new Map()
  }

  // 빌드 1회 안에서는 공유하고, --serve 재빌드 때는 새로 훑도록 짧은 TTL을 둔다
  files() {
    if (Date.now() - this.builtAt < INDEX_TTL_MS) return this.entries
    const entries = []
    const walk = (absDir, relDir) => {
      let dirents
      try {
        dirents = fs.readdirSync(absDir, { withFileTypes: true })
      } catch {
        return
      }
      for (const d of dirents) {
        if (d.name.startsWith(".")) continue
        const abs = path.join(absDir, d.name)
        const rel = relDir ? `${relDir}/${nfc(d.name)}` : nfc(d.name)
        if (d.isDirectory()) {
          if (!SKIP_DIRS.has(d.name)) walk(abs, rel)
        } else if (d.isFile()) {
          const ext = path.extname(rel).slice(1).toLowerCase()
          const name = rel.slice(rel.lastIndexOf("/") + 1)
          entries.push({
            abs,
            rel,
            ext,
            name,
            basename: ext ? name.slice(0, -(ext.length + 1)) : name,
            folder: relDir,
          })
        }
      }
    }
    walk(this.root, "")
    this.entries = entries
    this.builtAt = Date.now()
    return entries
  }

  // 폴더 자신과 그 하위 폴더를 모두 포함한다. 빈 문자열은 볼트 전체다.
  isInFolder(entry, folder) {
    const prefix = nfc(folder).replace(/^\/+|\/+$/g, "")
    return prefix === "" || entry.folder === prefix || entry.folder.startsWith(`${prefix}/`)
  }

  // 중첩 태그 규칙: "a"는 "a/b"도 포함한다
  hasTag(page, tag) {
    const wanted = nfc(tag.replace(/^#/, ""))
    return page.tags.some((t) => t === wanted || t.startsWith(`${wanted}/`))
  }

  markdownFiles(folder = "") {
    return this.files().filter((e) => e.ext === "md" && this.isInFolder(e, folder))
  }

  pages(folder = "") {
    return this.markdownFiles(folder)
      .map((e) => this.load(e))
      .filter(Boolean)
  }

  // 옵시디언 링크 해석 규칙: 볼트 기준 전체 경로 → 경로 접미 일치 → 파일명 일치(가장 얕은 것)
  resolve(target, defaultExt = "md") {
    let t = nfc(target.trim()).replace(/^\/+/, "")
    if (!path.extname(t)) t = `${t}.${defaultExt}`
    const files = this.files()
    const exact = files.find((e) => e.rel === t)
    if (exact) return exact
    const candidates = files.filter((e) => e.rel.endsWith(`/${t}`) || e.name === t)
    candidates.sort((a, b) => a.rel.split("/").length - b.rel.split("/").length)
    return candidates[0]
  }

  load(entry) {
    let stat
    try {
      stat = fs.statSync(entry.abs)
    } catch {
      return undefined
    }
    const cached = this.pageCache.get(entry.abs)
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.page
    let source = ""
    try {
      source = fs.readFileSync(entry.abs, "utf8")
    } catch {
      return undefined
    }
    const { data } = parseFrontmatter(source)
    const page = { entry, stat, frontmatter: data, tags: normalizeTags(data.tags ?? data.tag) }
    this.pageCache.set(entry.abs, { mtimeMs: stat.mtimeMs, page })
    return page
  }

  // 게시 대상(content 안 + publish: true)일 때만 content 기준 링크 경로를 돌려준다.
  // 그 외 노트는 링크를 걸면 깨지고 경로도 노출되므로 표시 텍스트만 쓴다.
  publishedLinkTarget(entry) {
    const rel = path.relative(this.contentRoot, fs.realpathSync(entry.abs))
    if (rel.startsWith("..") || path.isAbsolute(rel)) return undefined
    const page = this.load(entry)
    if (page?.frontmatter.publish !== true && page?.frontmatter.publish !== "true") return undefined
    return nfc(rel.split(path.sep).join("/")).replace(/\.md$/, "")
  }
}

// 빌드 타임 링크 값. 게시되지 않는 노트면 표시 텍스트로만 렌더링된다.
export class Link {
  constructor(vault, entry, display) {
    this.vault = vault
    this.entry = entry
    this.path = entry?.rel
    this.display = display
  }
  get text() {
    const d = this.display
    if (d !== undefined && d !== null && d !== "") return String(d)
    return this.entry?.basename ?? ""
  }
  toMarkdown(inTable = false) {
    const target = this.entry ? this.vault.publishedLinkTarget(this.entry) : undefined
    if (!target) return undefined
    return `[[${target}${inTable ? "\\|" : "|"}${this.text}]]`
  }
  toString() {
    return this.toMarkdown() ?? this.text
  }
}
