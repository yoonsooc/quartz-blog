import { joinSegments, pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { sections, sectionOf, privatePrefixes } from "../util/sections"

const PageTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const baseDir = pathToRoot(fileData.slug!)
  const slug = fileData.slug ?? ""
  const activeKey = sectionOf(slug).key
  return (
    <h2 class={classNames(displayClass, "page-title")}>
      {sections.map((s, i) => {
        const href = s.prefix === "" ? baseDir : joinSegments(baseDir, `${s.prefix}/`)
        const active = activeKey === s.key
        return (
          <>
            {i > 0 && (
              <span class="section-sep" aria-hidden="true">
                |
              </span>
            )}
            <a
              href={href}
              class={active ? "section-link active" : "section-link"}
              aria-current={active ? "page" : undefined}
              {...(s.private ? { "data-router-ignore": true } : {})}
            >
              {s.label}
            </a>
          </>
        )
      })}
    </h2>
  )
}

PageTitle.afterDOMLoaded = `
  // StatiCrypt-protected routes can't be SPA-navigated (Quartz's micromorph
  // chokes on the password-form wrapper). Force a full page load for any
  // link that targets a private section so the browser hits StatiCrypt directly.
  var privatePrefixes = ${JSON.stringify(privatePrefixes)}
  function markPrivateLinks() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      try {
        var u = new URL(a.href, window.location.origin)
        var isPrivate = privatePrefixes.some(function (p) {
          return u.pathname === '/' + p || u.pathname.startsWith('/' + p + '/')
        })
        if (isPrivate) {
          a.dataset.routerIgnore = ''
        }
      } catch (_) {}
    })
  }
  markPrivateLinks()
  document.addEventListener('nav', markPrivateLinks)
`

PageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.page-title .section-link {
  color: var(--dark);
  text-decoration: none;
  opacity: 0.4;
  transition: opacity 0.15s ease, color 0.15s ease;
}
.page-title .section-link:hover {
  opacity: 1;
}
.page-title .section-link.active {
  opacity: 1;
  color: var(--secondary);
}
.page-title .section-sep {
  color: var(--gray);
  font-weight: 400;
  font-size: 0.85em;
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
