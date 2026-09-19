// dataviewjs 블록을 빌드 타임에 실행해 출력(dv.paragraph 등)을 마크다운으로 모은다.
// Dataview API의 자주 쓰는 부분만 구현한다: dv.pages/page/current/array,
// dv.paragraph/span/header/el/list/table/fileLink 와 DataArray 메서드.
// textTransform이 동기 함수라 최상위 await(dv.io, dv.query 등)는 지원하지 않는다.
import { Link, nfc } from "../vault.js"
import { comparator, compareValues, formatDate } from "../values.js"
import { markdownTable, pipeSafe } from "../markdown.js"

const keyFn = (key) => (typeof key === "function" ? key : (row) => row?.[key])

class DataArray {
  constructor(values) {
    this.values = values
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === "symbol" || prop in target) return Reflect.get(target, prop, receiver)
        if (/^\d+$/.test(prop)) return target.values[Number(prop)]
        // Dataview의 "swizzling": rows.period → 각 행의 period를 모은 DataArray
        return target.to(prop)
      },
    })
  }
  get length() {
    return this.values.length
  }
  [Symbol.iterator]() {
    return this.values[Symbol.iterator]()
  }
  array() {
    return [...this.values]
  }
  where(fn) {
    return new DataArray(this.values.filter((v, i) => fn(v, i, this.values)))
  }
  filter(fn) {
    return this.where(fn)
  }
  map(fn) {
    return new DataArray(this.values.map((v, i) => fn(v, i, this.values)))
  }
  flatMap(fn) {
    return new DataArray(this.values.flatMap((v, i) => unwrap(fn(v, i, this.values))))
  }
  forEach(fn) {
    this.values.forEach((v, i) => fn(v, i, this.values))
  }
  sort(key, direction = "asc") {
    return new DataArray([...this.values].sort(comparator(direction, key ? keyFn(key) : undefined)))
  }
  groupBy(key) {
    const get = keyFn(key)
    const groups = []
    for (const row of this.sort(get).values) {
      const k = get(row)
      const last = groups[groups.length - 1]
      if (last && compareValues(last.key, k) === 0) last.rows.values.push(row)
      else groups.push({ key: k, rows: new DataArray([row]) })
    }
    return new DataArray(groups)
  }
  distinct(key) {
    const get = key ? keyFn(key) : (v) => v
    const seen = []
    return this.where((v) => {
      const k = get(v)
      if (seen.some((s) => compareValues(s, k) === 0)) return false
      seen.push(k)
      return true
    })
  }
  limit(n) {
    return this.slice(0, n)
  }
  slice(start, end) {
    return new DataArray(this.values.slice(start, end))
  }
  concat(other) {
    return new DataArray(this.values.concat(unwrap(other)))
  }
  to(key) {
    return new DataArray(this.values.flatMap((v) => unwrap(v?.[key] ?? [])))
  }
  find(fn) {
    return this.values.find(fn)
  }
  findIndex(fn) {
    return this.values.findIndex(fn)
  }
  indexOf(v) {
    return this.values.indexOf(v)
  }
  includes(v) {
    return this.values.includes(v)
  }
  some(fn) {
    return this.values.some(fn)
  }
  every(fn) {
    return this.values.every(fn)
  }
  none(fn) {
    return !this.values.some(fn)
  }
  first() {
    return this.values[0]
  }
  last() {
    return this.values[this.values.length - 1]
  }
  join(sep = ", ") {
    return this.values.map(stringify).join(sep)
  }
  sum() {
    return this.values.reduce((a, b) => a + Number(b ?? 0), 0)
  }
  avg() {
    return this.values.length ? this.sum() / this.values.length : 0
  }
  min() {
    return this.sort().first()
  }
  max() {
    return this.sort().last()
  }
}

const unwrap = (v) => (v instanceof DataArray ? v.values : Array.isArray(v) ? v : [v])

function stringify(value) {
  if (value === undefined || value === null) return ""
  if (value instanceof DataArray || Array.isArray(value))
    return unwrap(value).map(stringify).join(", ")
  if (value instanceof Date) return formatDate(value)
  return String(value) // Link는 toString()이 게시 여부에 따라 링크/텍스트를 고른다
}

function toPage(vault, page) {
  const { entry, stat, frontmatter, tags } = page
  const hashTags = tags.map((t) => `#${t}`)
  return {
    ...frontmatter,
    file: {
      name: entry.basename,
      path: entry.rel,
      folder: entry.folder,
      ext: entry.ext,
      link: new Link(vault, entry),
      tags: hashTags,
      etags: hashTags,
      frontmatter,
      size: stat.size,
      ctime: stat.birthtime,
      cday: stat.birthtime,
      mtime: stat.mtime,
      mday: stat.mtime,
    },
  }
}

// Dataview source의 부분 구현: "폴더" | "파일 경로" | #태그 를 and / or 로 잇고,
// 항 앞의 - 또는 ! 로 제외한다. 괄호 묶음은 지원하지 않는다.
function parseSource(vault, source) {
  if (/[()]/.test(source.replace(/"[^"]*"/g, "")))
    throw new Error(`괄호가 들어간 source는 지원하지 않습니다: ${source}`)

  const term = (raw) => {
    let t = raw.trim()
    const negate = t.startsWith("-") || t.startsWith("!")
    if (negate) t = t.slice(1).trim()
    let test
    const quoted = t.match(/^"(.*)"$/)
    if (quoted) {
      const target = nfc(quoted[1]).replace(/^\/+|\/+$/g, "")
      test = (p) =>
        vault.isInFolder(p.entry, target) ||
        p.entry.rel === target ||
        p.entry.rel === `${target}.md`
    } else if (t.startsWith("#")) {
      test = (p) => vault.hasTag(p, t)
    } else throw new Error(`지원하지 않는 source: ${t}`)
    return negate ? (p) => !test(p) : test
  }

  const orGroups = source.split(/\s+or\s+/i).map((group) => group.split(/\s+and\s+/i).map(term))
  return (page) => orGroups.some((group) => group.every((test) => test(page)))
}

function selectPages(vault, source) {
  if (!source?.trim()) return vault.pages()
  const matches = parseSource(vault, source)
  // 폴더 하나만 지정한 흔한 경우에는 그 폴더의 노트만 읽는다. 해당 폴더가 없으면
  // 파일 경로로 쓴 것이므로 전체에서 찾는다.
  const single = source.trim().match(/^"([^"]*)"$/)
  const narrowed = single ? vault.pages(single[1]) : []
  return (narrowed.length > 0 ? narrowed : vault.pages()).filter(matches)
}

// current: 현재 노트의 필드(frontmatter + 인라인 필드). textTransform은 파일 경로를
// 받지 못하므로 dv.current().file에는 frontmatter만 들어 있다.
export function runDataviewJs(vault, code, current) {
  const out = []
  const push = (md) => out.push(md)
  const pages = (source) => selectPages(vault, source)

  const dv = {
    pages: (source) => new DataArray(pages(source).map((p) => toPage(vault, p))),
    pagePaths: (source) => new DataArray(pages(source).map((p) => p.entry.rel)),
    page: (target) => {
      const entry = vault.resolve(String(target?.path ?? target))
      const page = entry && vault.load(entry)
      return page ? toPage(vault, page) : undefined
    },
    current: () => ({ ...current, file: { frontmatter: current } }),
    array: (v) => (v instanceof DataArray ? v : new DataArray(unwrap(v))),
    isArray: (v) => v instanceof DataArray || Array.isArray(v),
    fileLink: (target, _embed, display) => new Link(vault, vault.resolve(String(target)), display),
    date: (v) => (v instanceof Date ? v : new Date(v)),
    compare: compareValues,
    equal: (a, b) => compareValues(a, b) === 0,
    paragraph: (text) => push(stringify(text)),
    span: (text) => push(stringify(text)),
    header: (level, text) =>
      push(`${"#".repeat(Math.min(Math.max(level, 1), 6))} ${stringify(text)}`),
    el: (tag, text) => {
      const heading = String(tag).match(/^h([1-6])$/i)
      if (heading) return dv.header(Number(heading[1]), text)
      if (/^(p|span|div)$/i.test(tag)) return push(stringify(text))
      push(`<${tag}>${stringify(text)}</${tag}>`)
    },
    list: (items) =>
      push(
        unwrap(items)
          .map((item) => `- ${stringify(item)}`)
          .join("\n"),
      ),
    table: (headers, rows) => {
      const cells = (row) => unwrap(row).map((v) => pipeSafe(stringify(v)))
      push(markdownTable(cells(headers), unwrap(rows).map(cells)))
    },
  }

  new Function("dv", `"use strict";\n${code}`)(dv)
  return out.join("\n\n")
}
