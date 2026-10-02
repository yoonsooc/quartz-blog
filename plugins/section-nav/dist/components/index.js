// 섹션 디렉토리 내비게이션: sections 옵션의 categories를 분류 목록으로 보여 준다.
// 넓은 화면에서는 본문 왼쪽 여백에 세로 목록으로, 좁은 화면에서는 본문 위 가로
// 탭으로 나온다. 분류에 속한 노트 목록은 변환기(../directory.js)가 섹션 인덱스
// 본문에 <section class="section-group" data-category="키">로 넣는다.
//
// 이 컴포넌트는 암호화 영역 밖에 평문으로 렌더링된다. 그래서 분류 이름만 다루고,
// 노트 제목이나 외부 주소처럼 숨겨야 하는 값은 여기에 넣지 않는다. 같은 이유로
// 비공개 섹션에는 { fromTags: true }를 쓰지 않는 편이 안전하다(태그 이름이 드러난다).
import { jsx } from "preact/jsx-runtime"
import { resolveCategories, sectionOf } from "../sections.js"

function pathToRoot(slug) {
  const rootPath = slug
    .split("/")
    .filter((x) => x !== "")
    .slice(0, -1)
    .map(() => "..")
    .join("/")
  return rootPath.length === 0 ? "." : rootPath
}

export const SectionNav = (opts) => {
  const sections = opts?.sections ?? []

  const Component = ({ ctx, fileData, displayClass }) => {
    const slug = fileData.slug ?? ""
    const section = sectionOf(slug, sections)
    const categories = section ? resolveCategories(ctx, section, sections) : []
    if (categories.length === 0) return null

    const indexHref = [pathToRoot(slug), section.prefix].filter((s) => s !== "").join("/") + "/"
    return jsx("nav", {
      class: `${displayClass ?? ""} section-nav`.trim(),
      "aria-label": section.label,
      children: jsx("ul", {
        children: categories.map((c) =>
          jsx("li", {
            children: jsx("a", {
              href: `${indexHref}#${encodeURIComponent(c.key)}`,
              "data-category": c.key,
              // 비공개 섹션은 SPA 전환 대신 전체 로드를 써야 잠금 해제 흐름이 유지된다
              ...(section.private ? { "data-router-ignore": true } : {}),
              children: c.label,
            }),
          }),
        ),
      }),
    })
  }

  // 섹션 인덱스에서는 주소의 #분류에 해당하는 묶음만 보여 준다. 비공개 섹션의 묶음은
  // 잠금 해제 뒤에야 DOM에 생기므로 encrypted-pages가 내는 render 이벤트에서도 다시
  // 맞춘다. 스크립트가 실패해도 모든 묶음이 그대로 보이므로 내용에는 문제가 없다.
  Component.afterDOMLoaded = `
    function syncSectionNav() {
      const groups = Array.from(document.querySelectorAll('.section-group[data-category]'));
      const links = document.querySelectorAll('.section-nav a[data-category]');
      if (groups.length === 0) {
        links.forEach((a) => a.classList.remove('active'));
        return;
      }
      const keys = groups.map((g) => g.dataset.category);
      let hash = location.hash.slice(1);
      try { hash = decodeURIComponent(hash); } catch (e) {}
      const active = keys.includes(hash) ? hash : keys[0];
      groups.forEach((g) => { g.hidden = g.dataset.category !== active; });
      links.forEach((a) => {
        const on = a.dataset.category === active;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }
    if (!window.__sectionNavBound) {
      window.__sectionNavBound = true;
      document.addEventListener('nav', syncSectionNav);
      document.addEventListener('render', syncSectionNav);
      window.addEventListener('hashchange', syncSectionNav);
      // SPA 라우터는 같은 페이지의 # 링크를 pushState로 처리해서 hashchange가 나지
      // 않는다. 그래서 분류 링크 클릭과 뒤로/앞으로 가기에서도 직접 다시 맞춘다.
      window.addEventListener('popstate', () => setTimeout(syncSectionNav, 0));
      document.addEventListener('click', (e) => {
        const link = e.target instanceof Element && e.target.closest('.section-nav a[data-category]');
        if (link) setTimeout(syncSectionNav, 0);
      });
    }
    syncSectionNav();
  `

  Component.css = `
.section-nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
}
.section-nav {
  margin: 1rem 0 0;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--lightgray);
}
.section-nav a {
  display: block;
  color: var(--darkgray);
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 600;
  opacity: 0.55;
  transition: opacity 0.15s ease, color 0.15s ease;
}
.section-nav a:hover { opacity: 1; }
.section-nav a.active {
  opacity: 1;
  color: var(--secondary);
}
.section-group > h2:first-child { margin-top: 1rem; }
.section-date {
  margin-left: 0.7rem;
  font-size: 0.85rem;
  color: var(--gray);
}
.section-embed {
  width: 100%;
  height: 75vh;
  border: 1px solid var(--lightgray);
  border-radius: 6px;
}
/* 본문(800px) 왼쪽에 12rem 여백이 생기는 너비부터 세로 사이드바로 바꾼다 */
@media (min-width: 1240px) {
  .section-nav {
    float: left;
    width: 10rem;
    margin: 1.6rem 0 0 -12rem;
    padding: 0;
    border-bottom: none;
  }
  .section-nav ul {
    flex-direction: column;
    gap: 0.1rem;
  }
  .section-nav a {
    padding: 0.3rem 0.7rem;
    border-left: 2px solid var(--lightgray);
  }
  .section-nav a.active { border-left-color: var(--secondary); }
}
`

  return Component
}
