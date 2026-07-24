import config from "../../sections.config.json"

// 사이트 섹션(Posts/Daily/...)의 단일 소스. 탭 내비게이션(PageTitle), 히어로 분기(Hero),
// 홈 목록 필터(quartz.layout), 암호화 스크립트(scripts/encrypt-private.mjs — JSON을 직접
// 읽음)가 모두 sections.config.json 하나를 소비한다. 섹션 추가는 JSON에 항목 하나 추가로
// 끝나야 하며, 컴포넌트에 섹션 이름을 하드코딩하지 않는다.

export interface Section {
  key: string
  label: string
  /** slug prefix. 루트 섹션(Posts)은 빈 문자열 */
  prefix: string
  /** true면 StatiCrypt 암호화 대상 (빌드 후처리에서 처리) */
  private?: boolean
}

export const sections: Section[] = config.sections

const rootSection = sections.find((s) => s.prefix === "")!

/** slug가 속한 섹션 (최장 prefix 매치, 매치 없으면 루트 섹션) */
export function sectionOf(slug: string): Section {
  let best = rootSection
  for (const s of sections) {
    if (s.prefix === "") continue
    if (slug === s.prefix || slug.startsWith(`${s.prefix}/`)) {
      if (s.prefix.length > best.prefix.length) best = s
    }
  }
  return best
}

export function isPrivateSlug(slug: string): boolean {
  return sectionOf(slug).private === true
}

export const privatePrefixes: string[] = sections
  .filter((s) => s.private && s.prefix !== "")
  .map((s) => s.prefix)
