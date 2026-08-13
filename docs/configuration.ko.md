---
title: 설정
---

Quartz는 코딩을 전혀 몰라도 매우 폭넓게 설정할 수 있도록 만들어졌다. 필요한 설정의 대부분은 `quartz.config.yaml`을 편집하는 것만으로 가능하다.

> [!tip]
> VSCode처럼 YAML 언어 지원이 있는 텍스트 에디터로 `quartz.config.yaml`을 편집하면, 설정에 오류가 있을 때 경고를 표시해 주기 때문에 설정 실수를 피하는 데 도움이 된다.

Quartz의 설정은 크게 두 부분으로 나눌 수 있다:

```yaml title="quartz.config.yaml"
configuration:
  pageTitle: "My Site"
  # ... general configuration
plugins:
  - source: github:quartz-community/some-plugin
    enabled: true
    # ... plugin entries
```

## 일반 설정

이 부분은 사이트 전체에 영향을 줄 수 있는 모든 설정을 다룬다. 다음은 설정 가능한 항목들을 정리한 목록이다:

- `pageTitle`: 사이트의 제목. 사이트의 [[RSS Feed|RSS 피드]]를 생성할 때도 사용된다.
- `pageTitleSuffix`: 페이지 제목 끝에 덧붙이는 문자열. 브라우저 탭 제목에만 적용되며, 페이지 상단에 표시되는 제목에는 적용되지 않는다.
- `enableSPA`: 사이트에서 [[SPA Routing|SPA 라우팅]]을 활성화할지 여부.
- `enablePopovers`: 사이트에서 [[popover previews|팝오버 미리보기]]를 활성화할지 여부.
- `analytics`: 사이트에서 사용할 분석 도구. 가능한 값은 다음과 같다
  - `null`: 분석 도구를 사용하지 않는다;
  - `{ provider: 'google', tagId: '<your-google-tag>' }`: Google Analytics를 사용한다;
  - `{ provider: 'plausible' }`(관리형) 또는 `{ provider: 'plausible', host: 'https://<your-plausible-host>' }`(자체 호스팅, `https://` 프로토콜 접두사를 반드시 포함해야 한다): [Plausible](https://plausible.io/)을 사용한다;
  - `{ provider: 'umami', host: '<your-umami-host>', websiteId: '<your-umami-website-id>' }`: [Umami](https://umami.is/)를 사용한다;
  - `{ provider: 'goatcounter', websiteId: 'my-goatcounter-id' }`(관리형) 또는 `{ provider: 'goatcounter', websiteId: 'my-goatcounter-id', host: 'my-goatcounter-domain.com', scriptSrc: 'https://my-url.to/counter.js' }`(자체 호스팅): [GoatCounter](https://goatcounter.com)를 사용한다;
  - `{ provider: 'posthog', apiKey: '<your-posthog-project-apiKey>', host: '<your-posthog-host>' }`: [Posthog](https://posthog.com/)를 사용한다;
  - `{ provider: 'tinylytics', siteId: '<your-site-id>' }`: [Tinylytics](https://tinylytics.app/)를 사용한다;
  - `{ provider: 'cabin' }` 또는 `{ provider: 'cabin', host: 'https://cabin.example.com' }`(커스텀 도메인): [Cabin](https://withcabin.com)을 사용한다;
  - `{provider: 'clarity', projectId: '<your-clarity-id-code' }`: [Microsoft clarity](https://clarity.microsoft.com/)를 사용한다. 프로젝트 ID는 개요 페이지 상단에서 확인할 수 있다.
  - `{ provider: 'matomo', siteId: '<your-matomo-id-code', host: 'matomo.example.com' }`: [Matomo](https://matomo.org/)를 사용한다. host에는 프로토콜을 포함하지 않는다.
  - `{ provider: 'vercel' }`: [Vercel Web Analytics](https://vercel.com/docs/concepts/analytics)를 사용한다.
  - `{ provider: 'rybbit', siteId: 'my-rybbit-id' }`(관리형) 또는 `{ provider: 'rybbit', siteId: 'my-rybbit-id', host: 'my-rybbit-domain.com' }`(자체 호스팅): [Rybbit](https://rybbit.com)을 사용한다;
- `locale`: [[i18n|국제화(i18n)]]와 날짜 형식 지정에 사용된다
- `baseUrl`: 사이트의 정식(canonical) '홈'이 어디에 있는지 알기 위해 절대 URL이 필요한 사이트맵과 RSS 피드에 사용된다. 보통 사이트가 배포된 URL이다(예: 이 사이트의 경우 `quartz.jzhao.xyz`). 프로토콜(즉 `https://`)이나 앞뒤 슬래시는 포함하지 않는다.
  - [[create|`npx quartz create`]] 실행 중에 이 값을 설정하라는 안내를 받게 된다. CLI가 `https://`나 `http://` 프로토콜 접두사와 끝의 슬래시를 자동으로 제거해 준다.
  - 커스텀 도메인 없이 GitHub Pages로 [[hosting|호스팅]]하는 경우에는 하위 경로(subpath)도 포함해야 한다. 예를 들어 저장소가 `jackyzha0/quartz`라면 GitHub Pages는 `https://jackyzha0.github.io/quartz`로 배포하므로 `baseUrl`은 `jackyzha0.github.io/quartz`가 된다.
  - 참고로 Quartz 5는 실제로 어디에 배포하든 사이트가 동작하도록, 이 값의 사용을 최대한 피하고 가능한 한 상대 URL을 사용한다.
- `ignorePatterns`: `content` 폴더 안에서 파일을 찾을 때 Quartz가 무시하고 탐색하지 않을 [glob](<https://en.wikipedia.org/wiki/Glob_(programming)>) 패턴 목록. 자세한 내용은 [[private pages|비공개 페이지]]를 참고한다.
- `theme`: 사이트의 외관을 설정한다.
  - `fontOrigin`: 폰트를 어디에서 불러올지 지정한다.
    - `"googleFonts"`(기본값): Google Fonts API에서 폰트를 불러온다. 특히 CDN 캐싱이 활성화된 경우 가장 빠른 옵션이다.
    - `"local"`: 폰트를 다운로드하여 사이트에서 직접 제공한다. 외부 요청 없이 완전히 자체 완결적이다.
  - `cdnCaching`: `true`(기본값)이면 Google CDN을 사용해 폰트를 캐싱한다. 일반적으로 더 빠르다. Quartz가 폰트를 다운로드하여 자체 완결적으로 동작하게 하려면 이 옵션을 비활성화(`false`)한다.
  - `typography`: 사용할 폰트. [Google Fonts](https://fonts.google.com/)에서 제공하는 어떤 폰트든 사용할 수 있다.
    - `title`: 사이트 제목에 사용할 폰트 (선택 사항, 기본값은 `header`와 동일)
    - `header`: 헤더에 사용할 폰트
    - `code`: 인라인 코드와 블록 인용에 사용할 폰트
    - `body`: 그 외 모든 곳에 사용할 폰트
  - `colors`: 사이트의 테마 색상을 제어한다.
    - `light`: 페이지 배경
    - `lightgray`: 테두리
    - `gray`: 그래프 링크, 더 진한 테두리
    - `darkgray`: 본문 텍스트
    - `dark`: 헤더 텍스트와 아이콘
    - `secondary`: 링크 색상, [[graph view|그래프]]의 현재 노드
    - `tertiary`: 호버 상태와 방문한 [[graph view|그래프]] 노드
    - `highlight`: 내부 링크 배경, 강조된 텍스트, [[syntax highlighting|강조된 코드 줄]]
    - `textHighlight`: 마크다운 강조 텍스트의 배경

## 플러그인

Quartz의 플러그인은 콘텐츠에 대한 일련의 변환(transformation)이라고 생각하면 된다.

![[quartz transform pipeline.png]]

```yaml title="quartz.config.yaml"
plugins:
  - source: github:quartz-community/created-modified-date
    enabled: true
    order: 10 # controls execution order
  - source: github:quartz-community/syntax-highlighting
    enabled: true
    order: 20
  # ... more plugins
```

플러그인은 manifest에 기반해 타입(transformer, filter, emitter, pageType)별로 분류된다. `order` 필드는 각 카테고리 안에서의 실행 순서를 제어한다.

> [!note]
> 플러그인 설정을 TS로 고급 오버라이드하려면 `quartz.ts`를 수정하면 된다:
>
> ```ts title="quartz.ts"
> import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
>
> const config = await loadQuartzConfig({
>   // override any configuration field here
> })
> export default config
> export const layout = await loadQuartzLayout()
> ```

- [[tags/plugin/transformer|Transformer]]는 콘텐츠에 대해 **map** 연산을 수행한다 (예: frontmatter 파싱, 설명 생성)
- [[tags/plugin/filter|Filter]]는 콘텐츠를 **필터링**한다 (예: 초안 걸러내기)
- [[tags/plugin/emitter|Emitter]]는 콘텐츠에 대해 **reduce** 연산을 수행한다 (예: RSS 피드나 특정 태그가 달린 모든 파일을 나열하는 페이지 생성)
- **Page Type**은 서로 다른 종류의 페이지(콘텐츠 페이지, 폴더 목록, 태그 목록)가 어떻게 렌더링되는지를 정의한다. 각 page type은 서로 다른 [[layout#Page Frames|페이지 프레임]]을 사용해 전체 HTML 구조를 제어할 수 있다.

`quartz.config.yaml`의 `layout.byPageType` 섹션에서 `template` 필드를 설정해 특정 page type의 페이지 프레임을 오버라이드할 수도 있다:

```yaml title="quartz.config.yaml"
layout:
  byPageType:
    canvas:
      template: minimal # Override the page frame for canvas pages
```

사용 가능한 프레임과 프레임 결정(resolution) 방식에 대한 자세한 내용은 [[layout#Page Frames]]를 참고한다.

### 내부 플러그인과 외부 플러그인

Quartz는 Quartz에 번들로 포함된 내부 플러그인과 별도로 설치하는 커뮤니티 플러그인을 구분한다.

`quartz.config.yaml`에서 커뮤니티 플러그인은 GitHub 소스로 참조한다:

```yaml title="quartz.config.yaml"
plugins:
  - source: github:quartz-community/explorer
    enabled: true
  - source: github:quartz-community/syntax-highlighting
    enabled: true
    options:
      theme:
        light: github-light
        dark: github-dark
```

내부 플러그인(`FrontMatter` 같은 것)은 Quartz에 번들로 포함되어 있다. 커뮤니티 플러그인은 별도로 설치하며 `github:org/repo` 형태의 소스로 참조한다.

### 커뮤니티 플러그인

커뮤니티 플러그인을 설치하려면 다음 명령을 사용하면 된다:

```shell
npx quartz plugin add github:quartz-community/explorer
```

이 명령은 플러그인을 `quartz.config.yaml`에 추가하고 `.quartz/plugins/`에 설치한다.

설정 파일에 참조되어 있지만 아직 설치되지 않은 모든 플러그인을 설치하려면(프로젝트를 클론하거나 CI를 구성할 때 유용하다):

```shell
npx quartz plugin install --from-config
```

설치되어 있지만 더 이상 설정에 없는 플러그인을 제거하려면:

```shell
npx quartz plugin prune
```

두 명령 모두 `--dry-run`으로 변경 사항을 미리 볼 수 있다. 자세한 내용은 [[cli/plugin|플러그인 CLI 레퍼런스]]를 참고한다.

### 고급 소스 옵션

플러그인의 `source` 필드에는 단순 문자열 또는 추가 옵션이 담긴 객체를 쓸 수 있다. 문자열 형태가 가장 일반적이다:

```yaml title="quartz.config.yaml"
plugins:
  - source: github:quartz-community/explorer
    enabled: true
```

저장소의 하위 디렉토리에 있는 플러그인(모노레포 스타일)이거나, 특정 브랜치나 태그에 고정(pin)해야 할 때는 객체 형태를 사용한다:

```yaml title="quartz.config.yaml"
plugins:
  - source:
      repo: "https://github.com/user/repo.git"
      subdir: plugin
      ref: main
      name: my-plugin
    enabled: true
```

객체 형태는 다음 필드를 지원한다:

| 필드     | 필수     | 설명                                                                                                       |
| -------- | :------: | --------------------------------------------------------------------------------------------------------- |
| `repo`   |    ✅    | Git 저장소 URL (예: `https://github.com/user/repo.git`).                                                  |
| `subdir` |    ❌    | 플러그인이 들어 있는 저장소 내 하위 디렉토리. 모노레포 스타일의 플러그인 저장소에 사용한다.                |
| `ref`    |    ❌    | 고정할 Git ref(브랜치 또는 태그). 문자열 소스의 `#ref` 접미사와 동일하다.                                  |
| `name`   |    ❌    | `.quartz/plugins/`에서 사용할 디렉토리 이름을 오버라이드한다. 기본값은 저장소 이름이다.                    |

> [!example] 실제 사례
> [quartz-themes](https://github.com/saberzero1/quartz-themes) 플러그인은 저장소의 `plugin/` 하위 디렉토리에 있다. 설치하려면:
>
> ```yaml title="quartz.config.yaml"
> plugins:
>   - source:
>       name: quartz-themes
>       repo: "https://github.com/saberzero1/quartz-themes.git"
>       subdir: plugin
>     enabled: true
>     options:
>       theme: "tokyo-night"
>       mode: both
> ```

> [!tip]
> 문자열 형태 `github:user/repo#branch`와 객체 형태 `{ repo, ref }`는 브랜치를 지정하는 동등한 방법이다. `subdir`나 `name`이 함께 필요하거나 더 읽기 좋은 설정을 원할 때 객체 형태를 사용한다.

### 사용법

`quartz.config.yaml`에서 플러그인을 추가하거나 제거하고 순서를 바꿔서 Quartz의 동작을 커스터마이즈할 수 있다. 각 플러그인 항목에는 소스, 활성화 여부, 실행 순서, 그리고 옵션을 지정한다:

```yaml title="quartz.config.yaml"
plugins:
  - source: github:quartz-community/note-properties
    enabled: true
    options:
      includeAll: false
      includedProperties:
        - description
        - tags
        - aliases
    order: 5
  - source: github:quartz-community/created-modified-date
    enabled: true
    options:
      priority:
        - frontmatter
        - git
        - filesystem
    order: 10
  - source: github:quartz-community/latex
    enabled: true
    options:
      renderEngine: katex
    order: 80
```

> [!note]
> 일부 플러그인 옵션은 YAML로 표현할 수 없는 JavaScript 콜백 함수(예: 커스텀 정렬, 필터, 매핑 함수)를 필요로 한다. 이런 경우에는 `quartz.ts`에서 TS 오버라이드를 사용한다:
>
> ```ts title="quartz.ts"
> import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
> import * as ExternalPlugin from "./.quartz/plugins"
>
> ExternalPlugin.Explorer({
>   mapFn: (node) => {
>     node.displayName = node.displayName.toUpperCase()
>     return node
>   },
> })
>
> const config = await loadQuartzConfig()
> export default config
> export const layout = await loadQuartzLayout()
> ```
>
> `quartz.ts`에서 설정한 옵션은 YAML 옵션과 병합되며 우선순위를 가진다. 플러그인 오버라이드는 설정을 불러오는 동안 컴포넌트가 인스턴스화될 때 적용되도록 반드시 `loadQuartzConfig()` **앞에** 두어야 한다. 사용 가능한 콜백 옵션은 각 플러그인의 문서를 참고한다.

전체 플러그인 목록과 각 설정 옵션은 [[tags/plugin|여기]]에서 볼 수 있다.

직접 플러그인을 만들고 싶다면 [[making plugins|커스텀 플러그인 만들기]] 가이드를 참고한다.

## 폰트

폰트는 `quartz.config.yaml`에서 단순 문자열로 지정하거나 고급 옵션과 함께 지정할 수 있다:

```yaml title="quartz.config.yaml"
configuration:
  theme:
    typography:
      title: Schibsted Grotesk # optional, defaults to header font
      header: Schibsted Grotesk
      body: Source Sans Pro
      code: IBM Plex Mono
```

폰트 굵기(weight)와 이탤릭을 더 세밀하게 제어하려면 `quartz.ts`에서 TS 오버라이드를 사용한다:

```ts title="quartz.ts"
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

const config = await loadQuartzConfig({
  theme: {
    typography: {
      header: {
        name: "Schibsted Grotesk",
        weights: [400, 700],
        includeItalic: true,
      },
      body: "Source Sans Pro",
      code: "IBM Plex Mono",
    },
  },
})
export default config
export const layout = await loadQuartzLayout()
```

> [!tip]
> 제목 수준별 폰트 제어, 자체 호스팅 폰트, Obsidian 테마 폰트 연동이 필요하다면 [[plugins/Fonts|Fonts]] 플러그인을 참고한다. 이 플러그인은 빌드 시점에 Google Fonts를 다운로드하고 `fontOrigin: selfHosted`로 로컬에서 제공하여 사이트를 완전히 자체 완결적으로 만들 수 있다.
