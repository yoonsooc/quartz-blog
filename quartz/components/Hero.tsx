import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { joinSegments, pathToRoot } from "../util/path"
import { sectionOf } from "../util/sections"

interface Options {
  image: string
  subtitle?: string | string[]
}

export default ((opts: Options) => {
  const Hero: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => {
    const baseDir = pathToRoot(fileData.slug!)
    const imgSrc = joinSegments(baseDir, opts.image)

    // Pages that get the full hero (root landing + non-root section pages)
    const slug = fileData.slug ?? ""
    const fullHero = slug === "index" || sectionOf(slug).prefix !== ""
    if (fullHero) {
      return (
        <div class="hero">
          <div class="hero-bg" data-src={imgSrc}></div>
          <div class="hero-gradient"></div>
          <div class="hero-content">
            <div class="hero-title">
              <a href={baseDir}>{cfg.pageTitle}</a>
            </div>
            {opts.subtitle && (
              <div class="hero-subtitle">
                {Array.isArray(opts.subtitle)
                  ? opts.subtitle.map((line, i) => (
                      <>
                        {i > 0 && <br />}
                        {line}
                      </>
                    ))
                  : opts.subtitle}
              </div>
            )}
          </div>
        </div>
      )
    }

    // Content pages: banner fade-out background (demo 1 style)
    return <div class="page-banner" data-src={imgSrc}></div>
  }

  Hero.afterDOMLoaded = `
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

  Hero.css = `
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
  background: linear-gradient(
    to bottom,
    transparent 0%,
    transparent 40%,
    rgba(255, 255, 255, 0.6) 70%,
    var(--light) 100%
  );
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
  text-transform: none;
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

:root[saved-theme="dark"] .hero-bg {
  opacity: 0.10;
}

:root[saved-theme="dark"] .hero-gradient {
  background: linear-gradient(
    to bottom,
    transparent 0%,
    transparent 40%,
    rgba(14, 14, 14, 0.6) 70%,
    var(--light) 100%
  );
}

/* Demo 1: Banner fade-out for content pages */
.page-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
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

:root[saved-theme="dark"] .page-banner {
  opacity: 0.08;
}
`

  return Hero
}) satisfies QuartzComponentConstructor
