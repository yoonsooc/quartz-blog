// 게시 노트 안의 Obsidian 동적 조회(Bases, Dataview)를 빌드 타임에 정적 마크다운으로
// 굳힌다. 자세한 설명과 지원 범위는 ../README.md 참고.
//
//   텍스트 단계   ![[이름.base#뷰]] 임베드, ```base 블록, ```dataviewjs 블록 → 표·문단
//   마크다운 단계 인라인 식(`=this.x`) 치환, 인라인 필드 줄(key:: value) 숨김,
//                 비공개 섹션 밖으로 볼트 데이터가 나가는지 점검
//
// 블록 치환은 위키링크·임베드 처리(obsidian-flavored-markdown, order 30)보다 먼저
// 일어나야 하므로 order는 3이다. frontmatter는 직접 파싱하므로 다른 플러그인의
// 실행 순서에 의존하지 않는다.
import fs from "node:fs"
import { visit } from "unist-util-visit"
import { Vault, findVaultRoot, parseFrontmatter } from "./vault.js"
import { warningCallout } from "./markdown.js"
import { renderBase } from "./bases/render.js"
import { runDataviewJs } from "./dataview/js.js"
import { applyInlineDataview, collectFields } from "./dataview/inline.js"

const LOG_PREFIX = "[vault-query]"
// 치환이 일어난 파일에 남기는 표식. 마크다운 단계에서 회수한다.
const MARKER = "<!--vault-query-->"
const triggerRegex = /\.base[#|\]]|^ {0,3}(?:`{3,}|~{3,})\s*(?:dataviewjs|base)\s*$/m
const fenceRegex = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/
const baseEmbedRegex = /!\[\[([^\]|#]+?\.base)(?:#([^\]|]+?))?(?:\|[^\]]*)?\]\]/g

let vaultCache

function getVault(ctx, opts) {
  const contentDir = ctx.argv.directory
  const explicit = opts?.vaultRoot ?? process.env.OBSIDIAN_VAULT_ROOT
  const key = `${contentDir}::${explicit ?? ""}`
  if (vaultCache?.key === key) return vaultCache.vault

  let root
  try {
    root = findVaultRoot(contentDir, explicit)
  } catch {
    // content 또는 vaultRoot 경로가 없는 환경(CI 등)
  }
  if (!root) {
    console.warn(
      `${LOG_PREFIX} 볼트 루트(.obsidian)를 찾지 못해 .base/dataviewjs를 치환하지 않습니다. vaultRoot 옵션을 확인하세요.`,
    )
  }
  vaultCache = { key, vault: root ? new Vault(root, contentDir) : undefined }
  return vaultCache.vault
}

// 렌더링 실패는 빌드를 멈추지 않고 그 자리에 경고 콜아웃으로 남긴다
function guarded(kind, render) {
  try {
    return render()
  } catch (err) {
    const message = String(err?.message ?? err)
    console.warn(`${LOG_PREFIX} ${kind} 렌더링 실패: ${message}`)
    return warningCallout(`${kind} 렌더링 실패`, message)
  }
}

function expandQueries(src, vault, opts) {
  const { data: frontmatter, body, raw } = parseFrontmatter(src)
  const lines = body.split("\n")
  const out = []
  let expanded = false

  const renderers = {
    dataviewjs: (code) => runDataviewJs(vault, code, collectFields(body, frontmatter)),
    base: (code) => renderBase(vault, code, undefined, opts),
  }
  const renderEmbed = (_whole, target, viewName) => {
    expanded = true
    const table = guarded(target, () => {
      const entry = vault.resolve(target, "base")
      if (!entry) throw new Error(`'${target}' 파일을 볼트에서 찾지 못했습니다`)
      return renderBase(vault, fs.readFileSync(entry.abs, "utf8"), viewName?.trim(), opts)
    })
    return `\n\n${table}\n\n`
  }

  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(fenceRegex)
    if (!open) {
      out.push(lines[i].replace(baseEmbedRegex, renderEmbed))
      continue
    }
    // 코드 펜스는 닫는 펜스까지 통째로 읽는다. dataviewjs/base만 치환하고, 나머지
    // 코드 블록은 (안에 임베드 예시가 있더라도) 손대지 않는다.
    const [, fence, lang] = open
    const closeRegex = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`)
    let end = i + 1
    while (end < lines.length && !closeRegex.test(lines[end])) end++
    if (renderers[lang]) {
      expanded = true
      const code = lines.slice(i + 1, end).join("\n")
      out.push(
        "",
        guarded(lang, () => renderers[lang](code)),
        "",
      )
    } else {
      out.push(...lines.slice(i, end + 1))
    }
    i = end
  }

  return expanded ? `${raw}${out.join("\n")}\n\n${MARKER}\n` : src
}

function takeMarker(tree) {
  let found = false
  visit(tree, "html", (node, index, parent) => {
    if (node.value.trim() !== MARKER || parent === undefined || index === undefined) return
    found = true
    parent.children.splice(index, 1)
    return index
  })
  return found
}

export const VaultQuery = (opts) => {
  const publicPages = opts?.publicPages ?? "warn"
  const privatePrefixes = (opts?.sections ?? [])
    .filter((s) => s.private && s.prefix !== "")
    .map((s) => s.prefix)
  const isPrivate = (slug) => privatePrefixes.some((p) => slug === p || slug.startsWith(`${p}/`))

  return {
    name: "VaultQuery",
    textTransform(ctx, src) {
      if (!triggerRegex.test(src)) return src
      const vault = getVault(ctx, opts)
      return vault ? expandQueries(src, vault, opts) : src
    },
    markdownPlugins() {
      return [
        () => (tree, file) => {
          const source = file.value?.toString() ?? ""
          if (source.includes("`=") || source.includes("::")) {
            const { data, body } = parseFrontmatter(source)
            applyInlineDataview(tree, collectFields(body, data))
          }

          // textTransform 단계에서는 slug를 알 수 없으므로 여기서 점검한다
          if (!takeMarker(tree) || publicPages === "allow") return
          const slug = file.data.slug ?? ""
          if (isPrivate(slug)) return
          const message = `공개 페이지 "${slug}"에 볼트(비게시 노트) 조회 결과가 포함됩니다`
          if (publicPages === "error") throw new Error(`VaultQuery: ${message}`)
          console.warn(`${LOG_PREFIX} ${message}`)
        },
      ]
    },
  }
}

export default VaultQuery
