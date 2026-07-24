// v4 커스텀 PageTitle 포팅: Posts | Daily 섹션 탭 내비게이션.
// 섹션 목록은 플러그인 options.sections (quartz.config.yaml)에서 온다.
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

  const Component = ({ fileData, displayClass }) => {
    const slug = fileData.slug ?? ""
    const baseDir = pathToRoot(slug)
    const activeKey = sectionOf(slug, sections).key
    return jsx("h2", {
      class: `${displayClass ?? ""} page-title section-tabs`.trim(),
      children: sections.map((s, i) => {
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
