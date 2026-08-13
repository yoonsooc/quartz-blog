---
title: 컴포넌트 플러그인 만들기
---

> [!warning]
> 이 가이드는 JavaScript 작성 경험이 있고 TypeScript에 익숙하다는 것을 전제로 한다.

일반적으로 웹에서는 다음과 같은 HTML로 레이아웃 코드를 작성한다:

```html
<article>
  <h1>An article header</h1>
  <p>Some content</p>
</article>
```

이 HTML 조각은 "An article header"라는 머리글과 "Some content"라는 텍스트를 담은 문단으로 시작하는 글(article)을 나타낸다. 여기에 페이지를 꾸미기 위한 CSS와 상호작용을 더하기 위한 JavaScript가 결합된다.

하지만 HTML로는 재사용 가능한 템플릿을 만들 수 없다. 새 페이지를 만들고 싶다면 위 코드 조각을 복사해 붙여 넣고 머리글과 내용을 직접 수정해야 한다. 사이트에 비슷한 레이아웃을 공유하는 콘텐츠가 많다면 이는 좋은 방식이 아니다. React를 만든 똑똑한 사람들도 비슷한 불만을 가졌고, 이 코드 중복 문제를 해결하기 위해 컴포넌트(Component)라는 개념, 즉 JSX를 반환하는 JavaScript 함수를 발명했다.

요컨대 컴포넌트를 사용하면 어떤 데이터를 받아 HTML을 출력으로 만들어내는 JavaScript 함수를 작성할 수 있다. **Quartz는 React를 사용하지 않지만, 같은 컴포넌트 개념을 사용해 Quartz 사이트에서 레이아웃 템플릿을 쉽게 표현할 수 있게 해준다.**

## 커뮤니티 컴포넌트 플러그인

v5에서는 대부분의 컴포넌트가 커뮤니티 플러그인, 즉 `QuartzComponent`를 내보내는 독립적인 저장소이다. 이 플러그인들은 Quartz 코어 저장소로부터 분리되어 있어서, 유지보수와 공유가 더 쉽다.

### 시작하기

새 컴포넌트 플러그인을 만들려면 공식 플러그인 템플릿을 사용할 수 있다:

```shell
git clone https://github.com/quartz-community/plugin-template.git my-component
cd my-component
npm install
```

### 플러그인 구조

컴포넌트 플러그인의 `src/index.ts`는 보통 `QuartzComponent`를 반환하는 함수(생성자)를 내보낸다. 이를 통해 사용자가 컴포넌트에 설정 옵션을 전달할 수 있다.

```tsx title="src/index.ts"
import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types"

interface Options {
  favouriteNumber: number
}

const defaultOptions: Options = {
  favouriteNumber: 42,
}

const MyComponent: QuartzComponentConstructor<Options> = (userOpts?: Options) => {
  const opts = { ...defaultOptions, ...userOpts }

  const Component: QuartzComponent = (props: QuartzComponentProps) => {
    if (opts.favouriteNumber < 0) return null
    return <p>My favourite number is {opts.favouriteNumber}</p>
  }

  return Component
}

export default MyComponent
```

### Props

모든 Quartz 컴포넌트는 동일한 프로퍼티(props) 집합을 받는다:

```tsx
export type QuartzComponentProps = {
  fileData: QuartzPluginData
  cfg: GlobalConfiguration
  tree: Node<QuartzPluginData>
  allFiles: QuartzPluginData[]
  displayClass?: "mobile-only" | "desktop-only"
}
```

- `fileData`: 플러그인들이 현재 페이지에 추가했을 수 있는 모든 메타데이터.
  - `fileData.slug`: 현재 페이지의 slug.
  - `fileData.frontmatter`: 파싱된 모든 frontmatter.
- `cfg`: `quartz.config.yaml`의 `configuration` 필드.
- `tree`: 파일을 처리하고 변환한 결과인 [HTML AST](https://github.com/syntax-tree/hast).
- `allFiles`: 파싱된 모든 파일의 메타데이터. 페이지 목록을 만들거나 사이트 전체 구조를 파악할 때 유용하다.
- `displayClass`: 모바일 또는 데스크톱 환경에서 어떻게 렌더링할지에 대한 사용자의 선호를 나타내는 유틸리티 클래스.

### 스타일링

커뮤니티 플러그인에서는 스타일이 플러그인과 함께 번들링된다. 컴포넌트의 `.css` 프로퍼티를 사용해 스타일을 정의할 수 있다:

```tsx
Component.css = `
  .my-component { color: red; }
`
```

SCSS의 경우, 임포트해서 `.css` 프로퍼티에 할당하면 된다. 변환은 빌드 시스템이 처리한다:

```tsx
import styles from "./styles.scss"
Component.css = styles
```

> [!warning]
> Quartz는 CSS 모듈을 사용하지 않으므로 여기서 선언한 스타일은 _전역적으로_ 적용된다. 자신의 컴포넌트에만 적용하고 싶다면 구체적인 클래스 이름과 선택자를 사용해야 한다.

### 국제화

컴포넌트 플러그인은 사용자에게 노출되는 모든 문자열에 i18n 패턴을 사용해야 한다. 전체 설정 가이드는 [[making plugins#Internationalization (i18n)|플러그인 만들기#국제화 (i18n)]]를 참고하라.

간단한 참고 예시:

```tsx
import { i18n } from "../i18n"

const MyComponent: QuartzComponent = ({ cfg }) => {
  const t = i18n(cfg.locale ?? "en-US").components.myComponent
  return <h2>{t.title}</h2>
}
```

폴백으로 최소한 `en-US` 로케일은 항상 제공해야 한다. 추가 로케일은 선택 사항이지만, 국제적인 도달 범위를 위해 권장된다.

### 스크립트와 상호작용

상호작용이 필요하면 컴포넌트에 `.beforeDOMLoaded`와 `.afterDOMLoaded` 프로퍼티를 선언할 수 있다. 이들은 브라우저에서 실행될 JavaScript를 담은 문자열이어야 한다.

- `.beforeDOMLoaded`: 페이지 로딩이 끝나기 _전에_ 실행된다. 프리페칭(prefetching)이나 초기 초기화에 사용된다.
- `.afterDOMLoaded`: 페이지가 완전히 로드된 후 실행된다.

네비게이션 시 바뀔 수 있는 페이지별 요소에 의존하는 `afterDOMLoaded` 스크립트를 만들어야 한다면, `"nav"` 이벤트를 수신하면 된다:

```ts
document.addEventListener("nav", () => {
  // do page specific logic here
  const toggleSwitch = document.querySelector("#switch") as HTMLInputElement
  if (toggleSwitch) {
    toggleSwitch.addEventListener("change", switchTheme)
    window.addCleanup(() => toggleSwitch.removeEventListener("change", switchTheme))
  }
})
```

SPA 네비게이션 중에 페이지가 교체되기 전에 발생하는 `"prenav"` 이벤트도 사용할 수 있다.

`"render"` 이벤트는 전체 네비게이션 없이 DOM이 제자리에서 갱신되었을 때 발생하는데, 예를 들어 콘텐츠 복호화 후나 다른 플러그인에 의한 동적 DOM 수정 후가 그렇다. 컴포넌트가 콘텐츠 요소에 이벤트 리스너를 붙인다면, 재초기화를 보장하기 위해 `"nav"`에 더해 `"render"`도 수신해야 한다:

```ts
function setupMyComponent() {
  const elements = document.querySelectorAll(".my-interactive")
  for (const el of elements) {
    el.addEventListener("click", handleClick)
    window.addCleanup(() => el.removeEventListener("click", handleClick))
  }
}

document.addEventListener("nav", setupMyComponent)
document.addEventListener("render", setupMyComponent)
```

SPA 네비게이션 중 메모리 누수를 방지하기 위해, 모든 이벤트 핸들러를 `window.addCleanup`으로 추적하는 것이 모범 사례이다.

#### 코드 임포트하기

커뮤니티 플러그인에서 TypeScript 스크립트는 빌드 시점에 트랜스파일되어야 한다. 플러그인 템플릿의 `tsup.config.ts`에는 텍스트로 임포트된 `.inline.ts` 파일을 자동으로 트랜스파일하는 `inlineScriptPlugin`이 포함되어 있다:

```tsx title="src/index.ts"
import script from "./script.inline.ts"

const Component: QuartzComponent = (props) => {
  return <button id="btn">Click me</button>
}
Component.afterDOMLoaded = script
```

`inlineScriptPlugin`은 빌드 단계에서 TypeScript를 브라우저 호환 JavaScript로 트랜스파일하는 일을 처리하므로, 타입 안전한 클라이언트 사이드 코드를 작성할 수 있다.

### 컴포넌트 설치하기

컴포넌트가 (예를 들어 GitHub이나 npm에) 게시되고 나면, 사용자는 Quartz CLI를 사용해 설치할 수 있다:

```shell
npx quartz plugin add github:your-username/my-component
```

그런 다음 `quartz.config.yaml`에 추가하면 된다:

```yaml title="quartz.config.yaml"
plugins:
  - source: github:your-username/my-component
    enabled: true
    options:
      favouriteNumber: 42
    layout:
      position: left
      priority: 60
```

`quartz.ts`의 TS 오버라이드를 통한 고급 사용법은 다음과 같다:

```ts title="quartz.ts (override)"
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import Plugin from "./.quartz/plugins"

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout({
  byPageType: {
    content: {
      left: [Plugin.MyComponent({ favouriteNumber: 42 })],
    },
  },
})
```

### 컴포넌트 전용 플러그인에서 YAML 옵션 받기

처리 카테고리(transformer, filter, emitter, 페이지 타입)에도 속하는 컴포넌트 플러그인은 팩토리 함수를 통해 자동으로 옵션을 받는다. 하지만 **컴포넌트 전용 플러그인**, 즉 매니페스트에 `"category": ["component"]`만 선언한 플러그인은 부수 효과(side-effect) 임포트로 로드되기 때문에 팩토리 경로를 거치지 않는다.

컴포넌트 전용 플러그인에서 YAML 옵션을 받으려면 진입점에서 `init` 함수를 내보내면 된다:

```ts title="src/index.ts"
export function init(options?: Record<string, unknown>): void {
  // options contains merged defaultOptions + user's YAML options
  const myFlag = (options?.myFlag as boolean) ?? false
  // Use options to configure registrations, global state, etc.
}
```

Quartz의 config-loader는 모듈을 임포트한 후 `init()`을 호출하며, 이때 매니페스트의 `defaultOptions`와 사용자가 `quartz.config.yaml`에 적은 `options`를 병합한 결과를 전달한다. 병합은 처리 플러그인에 사용되는 것과 같은 `{ ...defaultOptions, ...userOptions }` 패턴을 따르므로, 사용자 값이 우선한다.

기본값은 `package.json`에 선언한다:

```json title="package.json"
{
  "quartz": {
    "category": ["component"],
    "defaultOptions": {
      "myFlag": false
    }
  }
}
```

플러그인이 `init`을 내보내지 않으면 순수한 부수 효과 임포트로 계속 동작하므로, 완전한 하위 호환성이 유지된다.

## 내부 컴포넌트

Quartz에는 레이아웃 유틸리티를 제공하는 내부 컴포넌트도 있다. 이들은 `quartz/components/`에 있으며 주로 구조적인 용도로 사용된다:

- `Component.Head()` — `<head>` 태그를 렌더링한다
- `Component.Spacer()` — 유연한 공간을 추가한다
- `Component.Flex()` — 유연한 레이아웃 컨테이너
- `Component.MobileOnly()` — 모바일에서만 컴포넌트를 표시한다
- `Component.DesktopOnly()` — 데스크톱에서만 컴포넌트를 표시한다
- `Component.ConditionalRender()` — 페이지 데이터에 따라 조건부로 렌더링한다

이 유틸리티들에 대한 자세한 내용은 [[layout-components|레이아웃 컴포넌트]]를 참고하라.

> [!hint]
> 실제 사례를 보려면 [Explorer](https://github.com/quartz-community/explorer)나 [Darkmode](https://github.com/quartz-community/darkmode) 같은 기존 커뮤니티 플러그인을 살펴보라.
