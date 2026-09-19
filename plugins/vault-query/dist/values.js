// Bases와 Dataview가 함께 쓰는 값 규칙: 빈 값 판정, 비교·동등성, 날짜 표기.
// frontmatter의 날짜는 YAML 파서가 문자열로 돌려주므로("2026-05-20"),
// 날짜가 필요한 자리에서만 asDate로 해석한다.
import { Link, nfc } from "./vault.js"

const isoDateRegex =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

export const isEmpty = (v) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)

export const truthy = (v) => !isEmpty(v) && v !== false && v !== 0

export function asDate(v) {
  if (v instanceof Date) return v
  if (typeof v === "string" && isoDateRegex.test(v)) return new Date(v)
  return undefined
}

// 자정(UTC)이면 날짜만, 아니면 분 단위까지 표기한다
export function formatDate(date) {
  const iso = date.toISOString()
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ")
}

// 정렬용 비교. 빈 값은 방향과 무관하게 항상 뒤로 보낸다(호출부에서 방향을 곱하기 전에
// isEmpty를 먼저 확인할 것). 문자열은 한국어 로캘 기준이라 한글이 영문보다 앞선다.
export function compareValues(a, b) {
  const ae = isEmpty(a)
  const be = isEmpty(b)
  if (ae || be) return ae && be ? 0 : ae ? 1 : -1
  if (a instanceof Link) a = a.text
  if (b instanceof Link) b = b.text
  if (typeof a === "number" && typeof b === "number") return a - b
  if (a instanceof Date || b instanceof Date) {
    const da = asDate(a)
    const db = asDate(b)
    if (da && db) return da.getTime() - db.getTime()
  }
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b)
  return String(a).localeCompare(String(b), "ko", { numeric: true })
}

// 방향("ASC" | "DESC", 대소문자 무관)을 반영한 비교 함수를 만든다
export function comparator(direction, get = (v) => v) {
  const sign = String(direction ?? "asc").toLowerCase() === "desc" ? -1 : 1
  return (a, b) => {
    const va = get(a)
    const vb = get(b)
    const c = compareValues(va, vb)
    return isEmpty(va) || isEmpty(vb) ? c : sign * c
  }
}

export function equals(a, b) {
  if (isEmpty(a) || isEmpty(b)) return isEmpty(a) && isEmpty(b)
  if (a instanceof Link && b instanceof Link) return a.path === b.path
  if (a instanceof Link || b instanceof Link) return compareValues(a, b) === 0
  if (a instanceof Date || b instanceof Date) {
    const da = asDate(a)
    const db = asDate(b)
    return !!da && !!db && da.getTime() === db.getTime()
  }
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => equals(x, b[i]))
  if (typeof a === "string" && typeof b === "string") return nfc(a) === nfc(b)
  return a === b
}
