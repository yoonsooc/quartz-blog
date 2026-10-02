// 왼쪽 내비게이션. 왼쪽 칼럼에서 사이트 제목과 검색 아래에 놓인다. 좁은 화면에서는
// 본문 위 가로 한 줄로 나온다. 페이지가 속한 섹션에 따라 두 가지 모양 중 하나를 그린다.
//
// 1) 최근 글 (기본): sections 옵션에서 nav를 준 섹션마다 묶음을 하나씩 만든다.
//      nav: { title: "Writing", limit: 4 }
//    묶음에는 제목(섹션 인덱스로 가는 링크), 최근 노트 limit개, "See N more →"가 들어간다.
//
// 2) 분류 목록: categories를 정의한 섹션(비공개 섹션)의 페이지에서는 분류 이름만 나열한다.
//    분류에 속한 노트 목록은 변환기(../directory.js)가 섹션 인덱스 본문에
//    <section class="section-group" data-category="키">로 넣는다.
//
// 이 컴포넌트는 암호화 영역 밖에 평문으로 렌더링된다. 그래서 비공개 섹션에서는 분류
// 이름만 다루고, 노트 제목이나 외부 주소처럼 숨겨야 하는 값은 넣지 않는다. 최근 글
// 묶음도 비공개 섹션(private: true)은 만들지 않는다.
import { jsx, jsxs } from "preact/jsx-runtime"
import { recentNotes, resolveCategories, sectionOf } from "../sections.js"

function pathToRoot(slug) {
  const rootPath = slug
    .split("/")
    .filter((x) => x !== "")
    .slice(0, -1)
    .map(() => "..")
    .join("/")
  return rootPath.length === 0 ? "." : rootPath
}

// Quartz의 목록(folder-page, content-meta)과 같은 표기: 빌드하는 컴퓨터의 현지 시간 기준
const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
    : ""

function categoryNav(section, categories, root, displayClass) {
  const indexHref = `${root}/${section.prefix}/`
  return jsx("nav", {
    class: `${displayClass ?? ""} section-nav section-nav-categories`.trim(),
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

function recentNav(blocks, slug, root, displayClass) {
  return jsx("nav", {
    class: `${displayClass ?? ""} section-nav section-nav-recent`.trim(),
    "aria-label": "Recent",
    children: blocks.map(({ section, notes }) => {
      const indexHref = `${root}/${section.prefix}/`
      const limit = section.nav.limit ?? 4
      const remaining = notes.length - limit
      return jsxs("div", {
        class: "section-nav-block",
        children: [
          jsx("h3", {
            children: jsx("a", {
              href: indexHref,
              class: slug === `${section.prefix}/index` ? "active" : undefined,
              children: section.nav.title ?? section.label,
            }),
          }),
          jsx("ul", {
            children: notes.slice(0, limit).map((n) =>
              jsx("li", {
                children: jsxs("a", {
                  href: `${root}/${n.slug}`,
                  class: n.slug === slug ? "active" : undefined,
                  "aria-current": n.slug === slug ? "page" : undefined,
                  children: [
                    jsx("span", { class: "section-nav-title", children: n.title }),
                    n.date && jsx("time", { datetime: n.date, children: formatDate(n.date) }),
                  ],
                }),
              }),
            ),
          }),
          remaining > 0 &&
            jsx("a", {
              href: indexHref,
              class: "section-nav-more",
              children: `See ${remaining} more →`,
            }),
        ],
      })
    }),
  })
}

export const SectionNav = (opts) => {
  const sections = opts?.sections ?? []

  const Component = ({ ctx, fileData, displayClass }) => {
    const slug = fileData.slug ?? ""
    const root = pathToRoot(slug)
    const section = sectionOf(slug, sections)

    if (section?.categories?.length) {
      const categories = resolveCategories(ctx, section, sections)
      return categories.length > 0 ? categoryNav(section, categories, root, displayClass) : null
    }

    const blocks = sections
      .filter((s) => s.nav && !s.private)
      .map((s) => ({ section: s, notes: recentNotes(ctx, s, sections) }))
      .filter((b) => b.notes.length > 0)
    return blocks.length > 0 ? recentNav(blocks, slug, root, displayClass) : null
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
/* 이 컴포넌트는 왼쪽 칼럼(.sidebar.left) 안에 놓인다. 800px 이상에서는 칼럼이 세로로
   서고, 그 미만에서는 본문 위의 가로 줄이 된다(Quartz 기본 그리드). */
.section-nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.section-nav a {
  color: var(--darkgray);
  text-decoration: none;
  transition: opacity 0.15s ease, color 0.15s ease;
}
.section-nav a.active { color: var(--secondary); }

/* ---------- 분류 목록 ---------- */
.section-nav-categories a {
  display: block;
  padding: 0.3rem 0.7rem;
  border-left: 2px solid var(--lightgray);
  font-size: 0.95rem;
  font-weight: 600;
  opacity: 0.55;
}
.section-nav-categories a:hover,
.section-nav-categories a.active { opacity: 1; }
.section-nav-categories a.active { border-left-color: var(--secondary); }

/* ---------- 최근 글 ---------- */
.section-nav-block + .section-nav-block { margin-top: 1.8rem; }
.section-nav-recent h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  /* 사이트 전역의 h3 스타일(대문자·자간)을 따르지 않고 적은 그대로 보여 준다 */
  text-transform: none;
  letter-spacing: normal;
}
.section-nav-recent h3 a { color: var(--dark); }
.section-nav-recent h3 a:hover,
.section-nav-recent h3 a.active { color: var(--secondary); }
.section-nav-recent ul { margin-top: 0.7rem; }
.section-nav-recent li + li { margin-top: 0.9rem; }
.section-nav-recent li a { display: block; }
.section-nav-title {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--dark);
}
.section-nav-recent li a:hover .section-nav-title,
.section-nav-recent a.active .section-nav-title { color: var(--secondary); }
.section-nav-recent time {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.88rem;
  color: var(--gray);
}
.section-nav-recent .section-nav-more {
  display: inline-block;
  margin-top: 0.9rem;
  font-size: 0.9rem;
  color: var(--gray);
}
.section-nav-recent .section-nav-more:hover { color: var(--secondary); }

/* ---------- 분류별 노트 목록(섹션 인덱스 본문) ---------- */
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

/* ---------- 좁은 화면: 한 줄로, 최근 글은 묶음 제목만 ---------- */
@media (max-width: 800px) {
  .section-nav {
    flex: 1 0 100%;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--lightgray);
  }
  .section-nav-categories ul,
  .section-nav-recent {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
  }
  .section-nav-categories a {
    padding: 0;
    border-left: none;
  }
  .section-nav-block + .section-nav-block { margin-top: 0; }
  .section-nav-recent h3 { font-size: 0.95rem; font-weight: 600; }
  .section-nav-recent h3 a { color: var(--darkgray); opacity: 0.55; }
  .section-nav-recent h3 a:hover,
  .section-nav-recent h3 a.active { opacity: 1; }
  .section-nav-recent ul,
  .section-nav-recent .section-nav-more { display: none; }
}
`

  return Component
}
