// 첫 화면(/)을 다른 섹션으로 보낸다. 정적 사이트에는 서버 리다이렉트가 없으므로
// "열리자마자 이동하는" index.html을 만들어 둔다. alias-redirects가 별칭 주소에
// 쓰는 것과 같은 방식(meta refresh)이고, 볼트 노트의 frontmatter를 건드리지 않으려고
// 별도 플러그인으로 뒀다.
//
// 옵션
//   to  이동할 경로 (예: posts). content에 index.md가 있으면 그 페이지가 첫 화면이
//       되어야 하므로 아무것도 만들지 않는다.
import fs from "node:fs/promises"
import path from "node:path"

function redirectHtml(url) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting…</title>
<link rel="canonical" href="${url}">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${url}">
<script>location.replace(${JSON.stringify(url)} + location.search + location.hash)</script>
</head>
<body><a href="${url}">${url}</a></body>
</html>
`
}

export const RootRedirect = (opts) => {
  const to = String(opts?.to ?? "").replace(/^\/+|\/+$/g, "")
  return {
    name: "RootRedirect",
    async emit(ctx) {
      if (to === "") return []
      if (ctx.allSlugs.includes("index")) {
        console.warn(
          "[root-redirect] content에 index.md가 있어 첫 화면 리다이렉트를 만들지 않습니다",
        )
        return []
      }
      const dest = path.join(ctx.argv.output, "index.html")
      await fs.mkdir(path.dirname(dest), { recursive: true })
      // 상대 경로라서 사이트가 하위 경로에 배포돼도 동작한다
      await fs.writeFile(dest, redirectHtml(`./${to}/`))
      return [dest]
    },
  }
}

export default RootRedirect
