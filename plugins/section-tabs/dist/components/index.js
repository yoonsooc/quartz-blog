// v4 커스텀 PageTitle 포팅: Posts | Private 섹션 탭 내비게이션.
// 섹션 목록은 플러그인 options.sections (quartz.config.yaml)에서 온다.
// 노트가 있는 공개 섹션이 둘 이상일 때만 그린다. 하나뿐이면 고를 것이 없으므로
// 아무것도 그리지 않고, 그러면 상단 바도 생기지 않는다(custom.scss).
// hideTab: true인 섹션은 탭에 내놓지 않는다(주소를 직접 입력해 들어가는 섹션).
// 다만 탭이 그려지는 상태에서 그 섹션 안의 페이지라면 현재 위치로 보여 준다.
import { jsx, jsxs, Fragment } from "preact/jsx-runtime"

function pathToRoot(slug) {
  const rootPath = slug
    .split("/")
    .filter((x) => x !== "")
    .slice(0, -1)
    .map(() => "..")
    .join("/")
  return rootPath.length === 0 ? "." : rootPath
}

function joinSegments(...args) {
  return args
    .filter((s) => s !== "" && s !== "/")
    .map((s) => s.replace(/^\/+|\/+$/g, ""))
    .join("/")
}

function sectionOf(slug, sections) {
  let best = sections.find((s) => s.prefix === "") ?? { key: "root", prefix: "" }
  for (const s of sections) {
    if (s.prefix === "") continue
    if (slug === s.prefix || slug.startsWith(`${s.prefix}/`)) {
      if (s.prefix.length > best.prefix.length) best = s
    }
  }
  return best
}

export const SectionTabs = (opts) => {
  const sections = opts?.sections ?? []
  const privatePrefixes = sections.filter((s) => s.private && s.prefix !== "").map((s) => s.prefix)

  const Component = ({ ctx, fileData, displayClass }) => {
    const slug = fileData.slug ?? ""
    const baseDir = pathToRoot(slug)
    const activeKey = sectionOf(slug, sections).key
    const hasPages = (s) =>
      s.prefix === "" || ctx.allSlugs.some((x) => x === s.prefix || x.startsWith(`${s.prefix}/`))
    const listed = sections.filter((s) => !s.hideTab && hasPages(s))
    if (listed.length < 2) return null
    const visible = sections.filter((s) => listed.includes(s) || (s.hideTab && s.key === activeKey))
    return jsx("h2", {
      class: `${displayClass ?? ""} page-title section-tabs`.trim(),
      children: visible.map((s, i) => {
        const href = s.prefix === "" ? baseDir : joinSegments(baseDir, `${s.prefix}/`)
        const active = activeKey === s.key
        return jsxs(Fragment, {
          children: [
            i > 0 && jsx("span", { class: "section-sep", "aria-hidden": "true", children: "|" }),
            jsx("a", {
              href,
              class: active ? "section-link active" : "section-link",
              "aria-current": active ? "page" : undefined,
              ...(privatePrefixes.some((p) => s.prefix === p) ? { "data-router-ignore": true } : {}),
              children: s.label,
            }),
          ],
        })
      }),
    })
  }

  Component.css = `
.page-title.section-tabs {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.section-tabs .section-link {
  color: var(--dark);
  text-decoration: none;
  opacity: 0.4;
  transition: opacity 0.15s ease, color 0.15s ease;
}
.section-tabs .section-link:hover {
  opacity: 1;
}
.section-tabs .section-link.active {
  opacity: 1;
  color: var(--secondary);
}
.section-tabs .section-sep {
  color: var(--gray);
  font-weight: 400;
  font-size: 0.85em;
}
`

  return Component
}
