// v4 커스텀 Hero 포팅: 루트/섹션 랜딩·항목 페이지는 full hero,
// 일반 콘텐츠 페이지는 상단 페이드아웃 배너.
import { jsx, jsxs } from "preact/jsx-runtime"

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

function inNonRootSection(slug, sections) {
  return sections.some(
    (s) => s.prefix !== "" && (slug === s.prefix || slug.startsWith(`${s.prefix}/`)),
  )
}

export const Hero = (opts) => {
  const image = opts?.image ?? "static/bg-city.png"
  const subtitle = opts?.subtitle
  const sections = opts?.sections ?? []

  const Component = ({ fileData, cfg }) => {
    const slug = fileData.slug ?? ""
    const baseDir = pathToRoot(slug)
    const imgSrc = joinSegments(baseDir, image)
    const fullHero = slug === "index" || inNonRootSection(slug, sections)

    if (fullHero) {
      return jsxs("div", {
        class: "hero",
        children: [
          jsx("div", { class: "hero-bg", "data-src": imgSrc }),
          jsx("div", { class: "hero-gradient" }),
          jsxs("div", {
            class: "hero-content",
            children: [
              jsx("div", {
                class: "hero-title",
                children: jsx("a", { href: baseDir, children: cfg?.pageTitle ?? "" }),
              }),
              subtitle &&
                jsx("div", {
                  class: "hero-subtitle",
                  children: Array.isArray(subtitle) ? subtitle.join(" ") : subtitle,
                }),
            ],
          }),
        ],
      })
    }

    return jsx("div", { class: "page-banner", "data-src": imgSrc })
  }

  Component.afterDOMLoaded = `
    function setBgImages() {
      document.querySelectorAll('[data-src]').forEach(function(el) {
        if (el.classList.contains('hero-bg') || el.classList.contains('page-banner')) {
          el.style.backgroundImage = 'url("' + el.getAttribute('data-src') + '")';
        }
      });
    }
    setBgImages();
    document.addEventListener('nav', () => setTimeout(setBgImages, 0));
  `

  Component.css = `
.hero {
  position: relative;
  height: 220px;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background-position: center 30%;
  background-size: cover;
  background-repeat: no-repeat;
  opacity: 0.18;
  mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%);
}
.hero-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(255,255,255,0.6) 70%, var(--light) 100%);
}
.hero-content {
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.hero-title {
  font-family: "DM Serif Display", serif;
  font-weight: 700;
  font-style: italic;
  letter-spacing: 0.02em;
  font-size: 2.4rem;
}
.hero-title a {
  color: var(--dark);
  text-decoration: none;
  font-family: "DM Serif Display", serif;
  font-weight: 700;
  font-style: italic;
}
.hero-subtitle {
  font-size: 0.9rem;
  color: var(--darkgray);
  margin-top: 0.3rem;
}
:root[saved-theme="dark"] .hero-bg { opacity: 0.10; }
:root[saved-theme="dark"] .hero-gradient {
  background: linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(14,14,14,0.6) 70%, var(--light) 100%);
}
.page-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 350px;
  z-index: 0;
  background-position: center top;
  background-size: cover;
  background-repeat: no-repeat;
  opacity: 0.12;
  mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 100%);
  pointer-events: none;
}
:root[saved-theme="dark"] .page-banner { opacity: 0.08; }
`

  return Component
}
