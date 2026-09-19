// Obsidian Bases 식(filters / formulas)의 부분 구현.
// 지원: 리터럴, 속성 참조(note.x / file.x / formula.x / 맨이름), 비교·논리·산술 연산,
// 전역 함수(link, if, now, today, date, number, list, min, max)와 자주 쓰는 메서드.
// 지원하지 않는 구문은 조용히 틀린 결과를 내지 않도록 예외를 던진다.
import { Link, nfc } from "../vault.js"
import { asDate, compareValues, equals, formatDate, isEmpty, truthy } from "../values.js"

const tokenRegex =
  /\s*(?:(\d+(?:\.\d+)?)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([\p{L}_$][\p{L}\p{N}_$]*)|(==|!=|>=|<=|&&|\|\||[-+*/%!<>(),.[\]]))/uy

function tokenize(src) {
  const tokens = []
  let pos = 0
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break
    tokenRegex.lastIndex = pos
    const m = tokenRegex.exec(src)
    if (!m) throw new Error(`식을 해석할 수 없습니다: ${src.slice(pos, pos + 20)}`)
    pos = tokenRegex.lastIndex
    if (m[1] !== undefined) tokens.push({ t: "num", v: Number(m[1]) })
    else if (m[2] !== undefined)
      tokens.push({ t: "str", v: m[2].slice(1, -1).replace(/\\(.)/g, "$1") })
    else if (m[3] !== undefined) tokens.push({ t: "id", v: m[3] })
    else tokens.push({ t: "op", v: m[4] })
  }
  return tokens
}

const BINARY_LEVELS = [
  ["||"],
  ["&&"],
  ["==", "!="],
  ["<", ">", "<=", ">="],
  ["+", "-"],
  ["*", "/", "%"],
]

function parse(src) {
  const tokens = tokenize(src)
  let i = 0
  const peek = (v) => tokens[i]?.t === "op" && tokens[i].v === v
  const eat = (v) => {
    if (!peek(v)) throw new Error(`'${v}'가 필요합니다: ${src}`)
    i++
  }

  const binary = (level) => {
    if (level === BINARY_LEVELS.length) return unary()
    let left = binary(level + 1)
    while (tokens[i]?.t === "op" && BINARY_LEVELS[level].includes(tokens[i].v)) {
      const op = tokens[i++].v
      left = { k: "bin", op, left, right: binary(level + 1) }
    }
    return left
  }
  const unary = () => {
    if (peek("!") || peek("-")) {
      const op = tokens[i++].v
      return { k: "un", op, arg: unary() }
    }
    return postfix()
  }
  const args = () => {
    const list = []
    if (!peek(")")) {
      do {
        list.push(binary(0))
      } while (peek(",") && ++i)
    }
    eat(")")
    return list
  }
  const postfix = () => {
    let node = primary()
    while (true) {
      if (peek(".")) {
        i++
        const name = tokens[i++]
        if (name?.t !== "id") throw new Error(`속성 이름이 필요합니다: ${src}`)
        node = { k: "member", obj: node, name: name.v }
      } else if (peek("[")) {
        i++
        const index = binary(0)
        eat("]")
        node = { k: "index", obj: node, index }
      } else if (peek("(")) {
        i++
        node = { k: "call", callee: node, args: args() }
      } else return node
    }
  }
  const primary = () => {
    const tok = tokens[i++]
    if (!tok) throw new Error(`식이 중간에 끝났습니다: ${src}`)
    if (tok.t === "num" || tok.t === "str") return { k: "lit", v: tok.v }
    if (tok.t === "id") {
      if (tok.v === "true") return { k: "lit", v: true }
      if (tok.v === "false") return { k: "lit", v: false }
      if (tok.v === "null") return { k: "lit", v: null }
      return { k: "id", name: tok.v }
    }
    if (tok.v === "(") {
      const inner = binary(0)
      eat(")")
      return inner
    }
    if (tok.v === "[") {
      const items = []
      if (!peek("]")) {
        do {
          items.push(binary(0))
        } while (peek(",") && ++i)
      }
      eat("]")
      return { k: "list", items }
    }
    throw new Error(`예상하지 못한 토큰 '${tok.v}': ${src}`)
  }

  const ast = binary(0)
  if (i < tokens.length) throw new Error(`식 뒤에 남은 토큰이 있습니다: ${src}`)
  return ast
}

const astCache = new Map()
function compile(src) {
  let ast = astCache.get(src)
  if (!ast) {
    ast = parse(src)
    astCache.set(src, ast)
  }
  return ast
}

// ---------- 값 다루기 ----------
const durationRegex = /^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*$/
const DURATION_MS = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5, M: 2592e6, y: 31536e6 }
// prettier-ignore
const DURATION_ALIAS = {
  second: "s", seconds: "s", minute: "m", minutes: "m", hour: "h", hours: "h", day: "d",
  days: "d", week: "w", weeks: "w", month: "M", months: "M", year: "y", years: "y",
}

function durationMs(v) {
  const m = typeof v === "string" ? v.match(durationRegex) : null
  const unit = m && (DURATION_MS[m[2]] ? m[2] : DURATION_ALIAS[m[2].toLowerCase()])
  return unit ? Number(m[1]) * DURATION_MS[unit] : undefined
}

const contains = (hay, needle) => {
  if (Array.isArray(hay)) return hay.some((x) => equals(x, needle))
  if (isEmpty(hay)) return false
  return nfc(String(hay)).includes(nfc(String(needle)))
}

function callMethod(target, name, args, src) {
  switch (name) {
    case "isEmpty":
      return isEmpty(target)
    case "isTruthy":
      return truthy(target)
    case "toString":
      return target instanceof Link ? target.text : String(target ?? "")
    case "contains":
      return contains(target, args[0])
    case "containsAny":
      return args.some((a) => contains(target, a))
    case "containsAll":
      return args.every((a) => contains(target, a))
  }
  if (typeof target === "string") {
    switch (name) {
      case "startsWith":
        return target.startsWith(String(args[0]))
      case "endsWith":
        return target.endsWith(String(args[0]))
      case "lower":
        return target.toLowerCase()
      case "upper":
        return target.toUpperCase()
      case "trim":
        return target.trim()
      case "replace":
        return target.replaceAll(String(args[0]), String(args[1] ?? ""))
      case "split":
        return target.split(String(args[0]))
      case "slice":
        return target.slice(args[0], args[1])
    }
  }
  if (Array.isArray(target)) {
    switch (name) {
      case "join":
        return target
          .map((x) => (x instanceof Link ? x.text : String(x ?? "")))
          .join(args[0] ?? ", ")
      case "slice":
        return target.slice(args[0], args[1])
      case "reverse":
        return [...target].reverse()
      case "sort":
        return [...target].sort(compareValues)
      case "unique":
        return target.filter((x, i) => target.findIndex((y) => equals(x, y)) === i)
    }
  }
  if (typeof target === "number") {
    switch (name) {
      case "toFixed":
        return target.toFixed(args[0] ?? 0)
      case "round":
        return args[0] ? Number(target.toFixed(args[0])) : Math.round(target)
      case "abs":
        return Math.abs(target)
      case "ceil":
        return Math.ceil(target)
      case "floor":
        return Math.floor(target)
    }
  }
  if (target instanceof Date) {
    switch (name) {
      case "date":
        return new Date(target.toISOString().slice(0, 10))
      case "format":
        return formatDate(target)
    }
  }
  throw new Error(`지원하지 않는 메서드 '.${name}()': ${src}`)
}

function callGlobal(name, args, ctx, src) {
  switch (name) {
    case "link": {
      const [target, display] = args
      if (target instanceof Link)
        return new Link(ctx.vault, target.entry, display ?? target.display)
      if (target?.__entry) return new Link(ctx.vault, target.__entry, display)
      const entry = typeof target === "string" ? ctx.vault.resolve(target) : undefined
      return new Link(ctx.vault, entry, display ?? target)
    }
    case "if":
      return truthy(args[0]) ? args[1] : (args[2] ?? null)
    case "now":
      return new Date()
    case "today":
      return new Date(new Date().toISOString().slice(0, 10))
    case "date":
      return asDate(args[0]) ?? null
    case "number":
      return Number(args[0])
    case "list":
      return Array.isArray(args[0]) ? args[0] : isEmpty(args[0]) ? [] : [args[0]]
    case "min":
      return Math.min(...args.flat())
    case "max":
      return Math.max(...args.flat())
  }
  throw new Error(`지원하지 않는 함수 '${name}()': ${src}`)
}

function member(obj, name) {
  if (obj === undefined || obj === null) return null
  if (name === "length" && (typeof obj === "string" || Array.isArray(obj))) return obj.length
  if (obj instanceof Date) {
    const parts = { year: obj.getFullYear(), month: obj.getMonth() + 1, day: obj.getDate() }
    return parts[name] ?? null
  }
  if (typeof obj === "object") return obj[name] ?? null
  return null
}

function evaluate(node, ctx, src) {
  switch (node.k) {
    case "lit":
      return node.v
    case "list":
      return node.items.map((n) => evaluate(n, ctx, src))
    case "id":
      if (node.name === "file") return ctx.file
      if (node.name === "note") return ctx.note
      if (node.name === "formula") return ctx.formula
      if (node.name === "this") return ctx.self ?? null
      return ctx.note[node.name] ?? null
    case "member":
      return member(evaluate(node.obj, ctx, src), node.name)
    case "index":
      return member(evaluate(node.obj, ctx, src), evaluate(node.index, ctx, src))
    case "un": {
      const v = evaluate(node.arg, ctx, src)
      return node.op === "!" ? !truthy(v) : -Number(v)
    }
    case "call": {
      const callArgs = node.args.map((n) => evaluate(n, ctx, src))
      if (node.callee.k === "id") return callGlobal(node.callee.name, callArgs, ctx, src)
      if (node.callee.k !== "member") throw new Error(`호출할 수 없는 식: ${src}`)
      const target = evaluate(node.callee.obj, ctx, src)
      if (target === ctx.file && typeof ctx.file[node.callee.name] === "function")
        return ctx.file[node.callee.name](...callArgs)
      return callMethod(target, node.callee.name, callArgs, src)
    }
    case "bin": {
      if (node.op === "&&")
        return truthy(evaluate(node.left, ctx, src)) && truthy(evaluate(node.right, ctx, src))
      if (node.op === "||")
        return truthy(evaluate(node.left, ctx, src)) || truthy(evaluate(node.right, ctx, src))
      const a = evaluate(node.left, ctx, src)
      const b = evaluate(node.right, ctx, src)
      switch (node.op) {
        case "==":
          return equals(a, b)
        case "!=":
          return !equals(a, b)
        case "<":
        case ">":
        case "<=":
        case ">=": {
          if (isEmpty(a) || isEmpty(b)) return false
          const c = compareValues(a, b)
          return node.op === "<"
            ? c < 0
            : node.op === ">"
              ? c > 0
              : node.op === "<="
                ? c <= 0
                : c >= 0
        }
        case "+":
        case "-": {
          const date = asDate(a)
          const ms = durationMs(b)
          if (date && ms !== undefined)
            return new Date(date.getTime() + (node.op === "+" ? ms : -ms))
          if (node.op === "-" && date && asDate(b)) return date.getTime() - asDate(b).getTime()
          if (node.op === "+" && (typeof a === "string" || typeof b === "string"))
            return `${a ?? ""}${b ?? ""}`
          return node.op === "+" ? Number(a) + Number(b) : Number(a) - Number(b)
        }
        case "*":
          return Number(a) * Number(b)
        case "/":
          return Number(a) / Number(b)
        case "%":
          return Number(a) % Number(b)
      }
    }
  }
  throw new Error(`평가할 수 없는 식: ${src}`)
}

export function evalExpression(src, ctx) {
  return evaluate(compile(String(src)), ctx, src)
}
