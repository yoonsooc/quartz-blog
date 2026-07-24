// 비공개 섹션(sections 옵션에서 private: true)의 노트에 빌드 시점에
// encrypted-pages가 읽는 password frontmatter를 환경변수에서 주입한다.
// 비밀번호를 vault 노트에 저장하지 않기 위한 어댑터.
// encrypted-pages(order 900)보다 먼저 실행되어야 한다 (order 890).

export const SectionPrivacy = (opts) => {
  const sections = opts?.sections ?? []
  const passwordField = opts?.passwordField ?? "password"
  const privatePrefixes = sections
    .filter((s) => s.private && s.prefix !== "")
    .map((s) => s.prefix)

  return {
    name: "SectionPrivacy",
    markdownPlugins() {
      return [
        () => (_tree, file) => {
          const slug = file.data.slug ?? ""
          const isPrivate = privatePrefixes.some((p) => slug === p || slug.startsWith(`${p}/`))
          if (!isPrivate) return

          const password = process.env.SITE_PRIVATE_PASSWORD ?? process.env.STATICRYPT_PASSWORD
          if (!password) {
            // fail-closed: 비밀번호 없이 비공개 노트가 평문으로 나가는 것을 막는다
            throw new Error(
              `SectionPrivacy: SITE_PRIVATE_PASSWORD is not set but private page "${slug}" exists`,
            )
          }

          file.data.frontmatter = file.data.frontmatter ?? {}
          if (file.data.frontmatter[passwordField] === undefined) {
            file.data.frontmatter[passwordField] = password
          }

          // 제목·설명은 암호화 대상 밖(meta 태그, article-title, og-image)에도
          // 렌더링되므로 슬러그 마지막 조각으로 소독한다. 원 제목은 본문(암호화
          // 영역)에서만 보이게 된다.
          const safeTitle = slug.split("/").pop() ?? slug
          if (file.data.frontmatter.title !== safeTitle) {
            file.data.frontmatter.title = safeTitle
          }
          delete file.data.frontmatter.description
          file.data.description = undefined
        },
      ]
    },
  }
}

export default SectionPrivacy
