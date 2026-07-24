// v4 커스텀 DataviewInline 포팅.
// Obsidian Dataview 인라인 식(`=this.field`, `= this.a / this.b * 100`)을 빌드
// 타임에 평가해 값으로 치환하고, 인라인 필드 정의 줄(key:: value)은 게시
// 페이지에서 숨긴다. 필드는 frontmatter + 본문 인라인 필드에서 수집.
import { visit } from "unist-util-visit"

const inlineFieldRegex = /^([A-Za-z_][A-Za-z0-9_ -]*?)\s*::\s*(.+)$/gm
const inlineFieldLineRegex = /^[A-Za-z_][A-Za-z0-9_ -]*?\s*::\s*.+$/
const inlineQueryRegex = /^=\s*(.+)$/
const arithmeticOnlyRegex = /^[\d\s+*/().-]+$/

function collectFields(source, frontmatter) {
  const fields = { ...frontmatter }
  for (const match of source.matchAll(inlineFieldRegex)) {
    const raw = match[2].trim()
    const num = Number(raw)
    fields[match[1].trim()] = raw !== "" && !Number.isNaN(num) ? num : raw
  }
  return fields
}

function formatNumber(n) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "")
}

function evaluate(expr, fields) {
  const direct = expr.match(/^this\.([\w-]+)$/)
  if (direct) {
    const val = fields[direct[1]]
    if (val === undefined || val === null) return undefined
    return typeof val === "number" ? formatNumber(val) : String(val)
  }

  let missing = false
  const substituted = expr.replace(/this\.([\w-]+)/g, (_, key) => {
    const val = fields[key]
    if (typeof val !== "number") {
      missing = true
      return "0"
    }
    return `(${val})`
  })
  if (missing || !arithmeticOnlyRegex.test(substituted)) return undefined

  try {
    const result = new Function(`"use strict"; return (${substituted})`)()
    if (typeof result !== "number" || !Number.isFinite(result)) return undefined
    return formatNumber(result)
  } catch {
    return undefined
  }
}

export const DataviewInline = () => ({
  name: "DataviewInline",
  markdownPlugins() {
    return [
      () => (tree, file) => {
        const source = file.value?.toString() ?? ""
        const fields = collectFields(source, file.data.frontmatter)

        if (source.includes("`=")) {
          visit(tree, "inlineCode", (node, index, parent) => {
            const match = node.value.match(inlineQueryRegex)
            if (!match || parent === undefined || index === undefined) return
            const result = evaluate(match[1].trim(), fields)
            if (result !== undefined) {
              parent.children[index] = { type: "text", value: result }
            }
          })
        }

        // 인라인 필드 정의 줄은 메타데이터 — 게시 페이지에서 제거
        visit(tree, "paragraph", (node, index, parent) => {
          if (parent === undefined || index === undefined) return
          let changed = false
          node.children = node.children.filter((child) => {
            if (child.type !== "text") return true
            const lines = child.value.split("\n")
            const kept = lines.filter((line) => !inlineFieldLineRegex.test(line.trim()))
            if (kept.length === lines.length) return true
            changed = true
            child.value = kept.join("\n")
            return child.value.trim() !== ""
          })
          if (changed && node.children.length === 0) {
            parent.children.splice(index, 1)
            return index
          }
        })
      },
    ]
  },
})

export default DataviewInline
