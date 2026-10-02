// 섹션 인덱스 본문 끝에 디렉토리(분류별 노트 목록)를 넣는 변환기.
//
// 각 분류는 <section class="section-group" data-category="키">로 감싼다. 이 표식은
// 내비게이션 컴포넌트가 선택된 분류만 보이게 할 때 쓴다.
//
// 비공개 섹션에서는 이 목록이 본문에 들어가기 때문에 encrypted-pages가 함께
// 암호화한다. 하위 노트는 unlisted라 폴더 자동 목록에 잡히지 않고, 암호화 영역
// 밖에 목록을 두면 제목이 평문으로 유출되므로 반드시 본문 안에 넣어야 한다.
import { allNotes, indexSlug, resolveCategories } from "./sections.js"

const text = (value) => ({ type: "text", value })
const paragraph = (...children) => ({ type: "paragraph", children })
const heading = (depth, value) => ({ type: "heading", depth, children: [text(value)] })
// mdast가 모르는 노드도 data.hName이 있으면 그 태그의 HTML 요소로 변환된다
const element = (hName, hProperties, children = []) => ({
  type: "sectionElement",
  data: { hName, hProperties },
  children,
})

// showDate: 제목 옆에 날짜를 붙인다. 비공개 섹션은 파일 이름이 곧 날짜라서 붙이지 않는다.
function noteList(notes, showDate) {
  return {
    type: "list",
    ordered: false,
    spread: false,
    children: notes.map((n) => {
      const link = { type: "link", url: `/${n.slug}`, children: [text(n.title)] }
      const date =
        showDate && n.date
          ? [element("span", { className: ["section-date"] }, [text(n.date.slice(0, 10))])]
          : []
      return { type: "listItem", spread: false, children: [paragraph(link, ...date)] }
    }),
  }
}

// 최신순(날짜, 없으면 이름 내림차순). 섹션에 groupByFolder가 켜져 있으면 하위
// 폴더별 소제목 아래에 묶는다(예: 월별 폴더로 나뉜 일일 기록).
function notesBody(notes, section) {
  const { groupByFolder } = section
  const showDate = !section.private
  if (notes.length === 0) return [paragraph(text("항목이 없습니다."))]
  const newestFirst = (a, b) => b.date.localeCompare(a.date) || b.name.localeCompare(a.name)
  if (!groupByFolder) return [noteList([...notes].sort(newestFirst), showDate)]
  const folders = [...new Set(notes.map((n) => n.folder))].sort().reverse()
  return folders.flatMap((folder) => {
    const list = noteList(notes.filter((n) => n.folder === folder).sort(newestFirst), showDate)
    return folder === "" ? [list] : [heading(3, folder), list]
  })
}

// 노션은 웹에 게시한 페이지의 /ebd/ 주소만 iframe을 허용한다. 그 외 주소는
// X-Frame-Options로 막혀 있으므로 링크로만 연결한다.
function externalBody(category) {
  const link = {
    type: "link",
    url: category.url,
    data: { hProperties: { target: "_blank", rel: "noopener noreferrer" } },
    children: [text(`${category.label} 새 탭에서 열기`)],
  }
  if (!/\/ebd\//.test(category.url)) return [paragraph(link)]
  const frame = element("iframe", {
    src: category.url,
    className: ["section-embed"],
    loading: "lazy",
    allowFullScreen: true,
    title: category.label,
  })
  return [frame, paragraph(link)]
}

function buildDirectory(ctx, section, sections) {
  if (!section.categories?.length) {
    // 분류를 정의하지 않은 비공개 섹션은 묶지 않은 목록 하나만 넣는다. 공개 섹션은
    // recent-notes 같은 일반 목록 컴포넌트가 있으므로 아무것도 넣지 않는다.
    const notes = section.private ? allNotes(ctx, section, sections) : []
    return notes.length > 0 ? notesBody(notes, section) : []
  }
  return resolveCategories(ctx, section, sections).map((category) =>
    element("section", { className: ["section-group"], dataCategory: category.key }, [
      heading(2, category.label),
      ...(category.url ? externalBody(category) : notesBody(category.notes, section)),
    ]),
  )
}

export const SectionDirectory = (opts) => {
  const sections = opts?.sections ?? []
  return {
    name: "SectionDirectory",
    markdownPlugins(ctx) {
      return [
        () => (tree, file) => {
          const slug = file.data.slug ?? ""
          const section = sections.find((s) => slug === indexSlug(s))
          if (section) tree.children.push(...buildDirectory(ctx, section, sections))
        },
      ]
    },
  }
}
