import { joinSegments, pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const PageTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const baseDir = pathToRoot(fileData.slug!)
  const slug = fileData.slug ?? ""
  const isDaily = slug === "daily" || slug.startsWith("daily/")
  const dailyHref = joinSegments(baseDir, "daily/")
  return (
    <h2 class={classNames(displayClass, "page-title")}>
      <a
        href={baseDir}
        class={isDaily ? "section-link" : "section-link active"}
        aria-current={isDaily ? undefined : "page"}
      >
        Posts
      </a>
      <span class="section-sep" aria-hidden="true">
        |
      </span>
      <a
        href={dailyHref}
        class={isDaily ? "section-link active" : "section-link"}
        aria-current={isDaily ? "page" : undefined}
        data-router-ignore
      >
        Daily
      </a>
    </h2>
  )
}

PageTitle.afterDOMLoaded = `
  // StatiCrypt-protected routes can't be SPA-navigated (Quartz's micromorph
  // chokes on the password-form wrapper). Force a full page load for any
  // link that targets /daily/* so the browser hits StatiCrypt directly.
  function markPrivateLinks() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      try {
        var u = new URL(a.href, window.location.origin)
        if (u.pathname === '/daily' || u.pathname.startsWith('/daily/')) {
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
