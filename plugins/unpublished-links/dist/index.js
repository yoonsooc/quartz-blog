// 게시되지 않은 노트로 가는 위키링크를 일반 텍스트로 바꾼다.
//
// crawl-links의 disableBrokenWikilinks 옵션은 이름과 달리 링크를 없애지 않고
// "broken" 클래스만 붙인다(흐리게 칠할 뿐, 누르면 404로 간다). 지식 저장소에서는
// 아직 게시하지 않은 노트를 가리키는 링크가 흔하므로, 그 표식이 붙은 링크를 실제
// 텍스트(<span class="unpublished-link">)로 바꾸고 나가는 링크 목록에서도 뺀다.
// 목록에서 빼 두어야 백링크·그래프에 존재하지 않는 노트가 잡히지 않는다.
//
// crawl-links(order 60) 뒤에 실행되어야 하고, 그쪽의 disableBrokenWikilinks가
// 켜져 있어야 한다.
import { visit } from "unist-util-visit"

const simplify = (slug) => (slug === "index" ? "/" : slug.replace(/\/index$/, ""))

export const UnpublishedLinks = () => ({
  name: "UnpublishedLinks",
  htmlPlugins() {
    return [
      () => (tree, file) => {
        const removed = new Set()
        visit(tree, "element", (node) => {
          if (node.tagName !== "a") return
          const classes = [].concat(node.properties?.className ?? [])
          if (!classes.includes("broken")) return
          const slug = node.properties["data-slug"]
          if (typeof slug === "string") removed.add(simplify(slug))
          node.tagName = "span"
          node.properties = { className: ["unpublished-link"] }
        })
        if (removed.size > 0 && Array.isArray(file.data.links)) {
          file.data.links = file.data.links.filter((link) => !removed.has(link))
        }
      },
    ]
  },
})

export default UnpublishedLinks
