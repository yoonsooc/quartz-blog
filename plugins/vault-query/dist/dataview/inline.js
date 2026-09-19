// Dataview 인라인 식과 인라인 필드 (기존 plugins/dataview-inline을 흡수).
//   - `=this.field`, `= this.a / this.b * 100` 같은 인라인 식을 값으로 치환한다.
//   - 인라인 필드 정의 줄(key:: value)은 메타데이터이므로 게시 페이지에서 숨긴다.
// 필드는 현재 노트의 frontmatter + 본문 인라인 필드에서 모으며, dataviewjs의
// dv.current()도 같은 필드를 쓴다. 볼트 조회가 필요 없어서 볼트 없이도 동작한다.
//
// 블록(dataviewjs)과 달리 마크다운 AST 단계에서 처리한다. 인라인 식은 inlineCode
// 노드로 정확히 식별되고(코드 펜스 안의 예시와 섞이지 않는다), 필드 줄 제거도
// 문단 단위로 안전하게 할 수 있기 때문이다.
import { visit } from "unist-util-visit"

const FIELD_KEY = String.raw`[\p{L}_][\p{L}\p{N}_ -]*?`
const inlineFieldRegex = new RegExp(String.raw`^(${FIELD_KEY})\s*::\s*(.+)$`, "gmu")
const inlineFieldLineRegex = new RegExp(String.raw`^${FIELD_KEY}\s*::\s*.+$`, "u")
const inlineQueryRegex = /^=\s*(.+)$/
const fieldRefRegex = /this\.([\p{L}\p{N}_-]+)/gu
const directRefRegex = /^this\.([\p{L}\p{N}_-]+)$/u
const arithmeticOnlyRegex = /^[\d\s+*/().-]+$/

export function collectFields(source, frontmatter) {
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

// 치환할 수 없는 식(없는 필드, 산술 이외의 구문)은 undefined를 돌려 원문을 그대로 둔다
function evaluate(expr, fields) {
  const direct = expr.match(directRefRegex)
  if (direct) {
    const val = fields[direct[1]]
    if (val === undefined || val === null) return undefined
    return typeof val === "number" ? formatNumber(val) : String(val)
  }

  let missing = false
  const substituted = expr.replace(fieldRefRegex, (_, key) => {
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

// fields: collectFields의 결과
export function applyInlineDataview(tree, fields) {
  visit(tree, "inlineCode", (node, index, parent) => {
    const match = node.value.match(inlineQueryRegex)
    if (!match || parent === undefined || index === undefined) return
    const result = evaluate(match[1].trim(), fields)
    if (result !== undefined) parent.children[index] = { type: "text", value: result }
  })

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
}
