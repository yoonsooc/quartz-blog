// 비공개 섹션(sections 옵션에서 private: true)의 노트에 빌드 시점에
// encrypted-pages가 읽는 password frontmatter를 환경변수에서 주입한다.
// 비밀번호를 vault 노트에 저장하지 않기 위한 어댑터.
// encrypted-pages(order 900)보다 먼저 실행되어야 한다 (order 890).
//
// 섹션 인덱스의 노트 목록(디렉토리)은 section-nav 플러그인이 본문에 넣는다.
// 본문에 들어가므로 여기서 주입한 비밀번호로 함께 암호화된다.

// 암호문은 공개 저장소에 그대로 올라가므로 누구나 내려받아 비밀번호를 오프라인에서
// 무제한으로 대입해 볼 수 있다. 접속 횟수 제한 같은 방어가 없어서 비밀번호의 길이와
// 무작위성이 유일한 방어선이다. 약해 보이면 빌드할 때마다 알린다.
let weakPasswordWarned = false
function warnIfWeak(password) {
  if (weakPasswordWarned) return
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length
  const distinct = new Set(password).size
  if (password.length >= 16 && distinct >= 10 && kinds >= 2) return
  weakPasswordWarned = true
  console.warn(
    `[section-privacy] SITE_PRIVATE_PASSWORD가 약합니다 (길이 ${password.length}, 서로 다른 문자 ${distinct}개, ` +
      `문자 종류 ${kinds}가지). 암호문이 공개되므로 16자 이상의 무작위 문자열이나 단어 4개 이상의 문구를 권장합니다.`,
  )
}

export const SectionPrivacy = (opts) => {
  const sections = opts?.sections ?? []
  const passwordField = opts?.passwordField ?? "password"
  const privateSections = sections.filter((s) => s.private && s.prefix !== "")

  return {
    name: "SectionPrivacy",
    markdownPlugins() {
      return [
        () => (tree, file) => {
          const slug = file.data.slug ?? ""
          const section = privateSections.find(
            (s) => slug === s.prefix || slug.startsWith(`${s.prefix}/`),
          )
          if (!section) return

          const password = process.env.SITE_PRIVATE_PASSWORD ?? process.env.STATICRYPT_PASSWORD
          if (!password) {
            // fail-closed: 비밀번호 없이 비공개 노트가 평문으로 나가는 것을 막는다
            throw new Error(
              `SectionPrivacy: SITE_PRIVATE_PASSWORD is not set but private page "${slug}" exists`,
            )
          }

          warnIfWeak(password)

          file.data.frontmatter = file.data.frontmatter ?? {}
          if (file.data.frontmatter[passwordField] === undefined) {
            file.data.frontmatter[passwordField] = password
          }

          // 제목·설명·태그는 암호화 대상 밖(meta 태그, article-title, tag-list,
          // og-image)에도 렌더링되므로 소독한다. 원 제목은 본문(암호화 영역)에서만
          // 보이게 된다. 섹션 인덱스의 제목은 섹션 표시 이름을 쓴다.
          const isIndex = slug === `${section.prefix}/index` || slug === section.prefix
          const safeTitle = isIndex ? section.label : (slug.split("/").pop() ?? slug)
          if (file.data.frontmatter.title !== safeTitle) {
            file.data.frontmatter.title = safeTitle
          }
          delete file.data.frontmatter.description
          delete file.data.frontmatter.tags
          file.data.description = undefined
        },
      ]
    },
  }
}

export default SectionPrivacy
