// 사이트 제목 블록: 왼쪽 칼럼 맨 위에 놓이는 사이트 제목과 부제.
// 모든 페이지에서 같은 모양이라 목록 페이지와 글 페이지를 오갈 때 화면 구성이
// 바뀌지 않는다. 예전의 배경 그림은 사이트 전체 배경(custom.scss의 body::before)으로
// 옮겼다.
//
// 옵션
//   subtitle  제목 아래 한 줄
//   home      제목을 눌렀을 때 갈 경로. 첫 화면이 리다이렉트 페이지일 때 그 목적지를
//             직접 걸어 한 번 더 이동하지 않게 한다. 생략하면 사이트 루트다.
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

export const Hero = (opts) => {
  const subtitle = opts?.subtitle
  const home = String(opts?.home ?? "").replace(/^\/+|\/+$/g, "")

  const Component = ({ fileData, cfg, displayClass }) => {
    const baseDir = pathToRoot(fileData.slug ?? "")
    const homeHref = home === "" ? baseDir : `${joinSegments(baseDir, home)}/`
    return jsxs("div", {
      class: `${displayClass ?? ""} hero`.trim(),
      children: [
        jsx("div", {
          class: "hero-title",
          children: jsx("a", { href: homeHref, children: cfg?.pageTitle ?? "" }),
        }),
        subtitle &&
          jsx("div", {
            class: "hero-subtitle",
            children: Array.isArray(subtitle) ? subtitle.join(" ") : subtitle,
          }),
      ],
    })
  }

  Component.css = `
.hero-title {
  font-family: "DM Serif Display", serif;
  font-weight: 700;
  letter-spacing: 0.02em;
  font-size: 1.7rem;
  line-height: 1.2;
}
.hero-title a {
  color: var(--dark);
  text-decoration: none;
  font-family: "DM Serif Display", serif;
  font-weight: 700;
}
.hero-subtitle {
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--darkgray);
  margin-top: 0.35rem;
}
/* 좁은 화면: 왼쪽 칼럼이 본문 위 가로 줄이 된다. 제목이 남는 폭을 차지한다 */
@media (max-width: 800px) {
  .hero { flex: 1 1 auto; }
  .hero-title { font-size: 1.4rem; }
  .hero-subtitle { font-size: 0.8rem; }
}
`

  return Component
}
