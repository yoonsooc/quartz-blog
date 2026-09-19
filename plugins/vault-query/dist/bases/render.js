// .base 정의(YAML)를 볼트 노트에 대해 평가해 마크다운 표로 렌더링한다.
// 지원: 전역/뷰 filters(and·or·not 중첩), formulas, properties.displayName,
// 뷰의 order(열), sort, groupBy, limit. 뷰 type은 모두 표로 그린다.
import YAML from "yaml"
import { Link, nfc } from "../vault.js"
import { comparator, formatDate, isEmpty, truthy } from "../values.js"
import { escapeCell, markdownTable } from "../markdown.js"
import { evalExpression } from "./expr.js"

const inFolderRegex = /^\s*file\.inFolder\(\s*(["'])(.+?)\1\s*\)\s*$/
const urlRegex = /^https?:\/\/\S+$/

function fileObject(vault, page) {
  const { entry, stat, frontmatter, tags } = page
  return {
    __entry: entry,
    name: entry.name,
    basename: entry.basename,
    path: entry.rel,
    folder: entry.folder,
    ext: entry.ext,
    size: stat.size,
    ctime: stat.birthtime,
    mtime: stat.mtime,
    tags,
    properties: frontmatter,
    inFolder: (folder) => vault.isInFolder(entry, String(folder)),
    hasProperty: (key) => Object.prototype.hasOwnProperty.call(frontmatter, key),
    hasTag: (...wanted) => wanted.some((tag) => vault.hasTag(page, String(tag))),
    asLink: (display) => new Link(vault, entry, display),
    hasLink: () => {
      throw new Error("file.hasLink()는 빌드 타임 평가에서 지원하지 않습니다")
    },
  }
}

// 한 행(노트)을 평가할 때의 문맥. formula는 참조되는 시점에 계산한다.
function rowContext(vault, page, formulas) {
  const ctx = { vault, note: page.frontmatter, file: fileObject(vault, page), formula: {} }
  const evaluating = new Set()
  for (const [name, src] of Object.entries(formulas ?? {})) {
    Object.defineProperty(ctx.formula, name, {
      enumerable: true,
      get() {
        if (evaluating.has(name)) throw new Error(`formula '${name}'가 자기 자신을 참조합니다`)
        evaluating.add(name)
        try {
          return evalExpression(src, ctx)
        } finally {
          evaluating.delete(name)
        }
      },
    })
  }
  return ctx
}

function matches(filter, ctx) {
  if (filter === undefined || filter === null) return true
  if (typeof filter === "string") return truthy(evalExpression(filter, ctx))
  if (Array.isArray(filter)) return filter.every((f) => matches(f, ctx))
  if (filter.and) return filter.and.every((f) => matches(f, ctx))
  if (filter.or) return filter.or.some((f) => matches(f, ctx))
  if (filter.not) return !filter.not.some((f) => matches(f, ctx))
  throw new Error(`지원하지 않는 filter 형식: ${JSON.stringify(filter)}`)
}

// 최상위 and의 file.inFolder(...)를 미리 뽑아 후보를 좁힌다. 볼트 전체의
// frontmatter를 읽지 않기 위한 최적화이며, 필터 자체는 뒤에서 그대로 다시 평가한다.
function folderHint(filter) {
  const list = typeof filter === "string" ? [filter] : (filter?.and ?? [])
  for (const f of list) {
    const m = typeof f === "string" ? f.match(inFolderRegex) : null
    if (m) return m[2]
  }
  return undefined
}

function propertyValue(id, ctx) {
  if (id.startsWith("formula.")) return ctx.formula[id.slice(8)]
  if (id.startsWith("file.")) return ctx.file[id.slice(5)]
  if (id.startsWith("note.")) return ctx.note[id.slice(5)]
  return ctx.note[id]
}

function displayName(id, properties) {
  const bare = id.replace(/^note\./, "")
  const configured =
    properties?.[id]?.displayName ??
    properties?.[bare]?.displayName ??
    properties?.[`note.${bare}`]?.displayName
  return configured ?? bare.replace(/^(formula|file)\./, "")
}

function renderCell(value) {
  if (isEmpty(value)) return ""
  if (value instanceof Link) return value.toMarkdown(true) ?? escapeCell(value.text)
  if (value instanceof Date) return formatDate(value)
  if (Array.isArray(value)) return value.map(renderCell).join(", ")
  if (typeof value === "string" && urlRegex.test(value)) {
    // 긴 URL은 표를 넓히므로 도메인만 보이는 링크로 줄인다
    let host = value
    try {
      host = new URL(value).hostname.replace(/^www\./, "")
    } catch {}
    return `[${escapeCell(host)}](<${value.replace(/[<>|]/g, encodeURIComponent)}>)`
  }
  if (typeof value === "object") return escapeCell(JSON.stringify(value))
  return escapeCell(value)
}

function selectView(base, viewName) {
  const views =
    Array.isArray(base.views) && base.views.length > 0 ? base.views : [{ type: "table" }]
  if (!viewName) return views[0]
  const view = views.find((v) => nfc(String(v.name ?? "")) === nfc(viewName))
  if (!view) throw new Error(`뷰 '${viewName}'를 찾을 수 없습니다`)
  return view
}

function queryRows(vault, base, view) {
  const rows = []
  for (const page of vault.pages(folderHint(base.filters) ?? folderHint(view.filters))) {
    const ctx = rowContext(vault, page, base.formulas)
    if (matches(base.filters, ctx) && matches(view.filters, ctx)) rows.push(ctx)
  }
  // Array.prototype.sort는 안정 정렬이라, 뒤 기준부터 차례로 정렬하면 다중 정렬이 된다
  for (const s of [...(view.sort ?? [])].reverse()) {
    rows.sort(comparator(s.direction, (ctx) => propertyValue(s.property, ctx)))
  }
  return Number.isInteger(view.limit) && view.limit > 0 ? rows.slice(0, view.limit) : rows
}

export function renderBase(vault, source, viewName, opts = {}) {
  const base = YAML.parse(source) ?? {}
  const view = selectView(base, viewName)
  const rows = queryRows(vault, base, view)
  if (rows.length === 0) return `*${opts.emptyText ?? "결과 없음"}*`

  const columns = view.order?.length ? view.order : ["file.basename"]
  const headers = columns.map((c) => escapeCell(displayName(c, base.properties)))
  const table = (group) =>
    markdownTable(
      headers,
      group.map((ctx) => columns.map((c) => renderCell(propertyValue(c, ctx)))),
    )

  const groupProp = typeof view.groupBy === "string" ? view.groupBy : view.groupBy?.property
  if (!groupProp) return table(rows)

  const groups = new Map()
  for (const ctx of rows) {
    const key = renderCell(propertyValue(groupProp, ctx))
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(ctx)
  }
  return [...groups.keys()]
    .sort(comparator(view.groupBy?.direction))
    .map((key) => `**${key === "" ? "(없음)" : key}**\n\n${table(groups.get(key))}`)
    .join("\n\n")
}
