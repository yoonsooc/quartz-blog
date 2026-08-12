---
title: 나만의 플러그인 만들기
---

> [!warning]
> 이 문서는 TypeScript에 대한 실무 지식이 있다고 가정하며, Quartz 플러그인이 어떤 인터페이스를 가져야 하는지 설명하는 코드 스니펫을 포함한다.

Quartz의 플러그인은 콘텐츠에 대한 일련의 변환이다. 이는 아래 처리 파이프라인 다이어그램에 나타나 있다:

![[quartz transform pipeline.png]]

모든 플러그인은 옵션을 위한 단일 매개변수 `type OptionType = object | undefined`를 받아, 해당 플러그인 종류에 대응하는 객체를 반환하는 함수로 정의된다.

```ts
type OptionType = object | undefined
type QuartzPlugin<Options extends OptionType = undefined> = (opts?: Options) => QuartzPluginInstance
type QuartzPluginInstance =
  | QuartzTransformerPluginInstance
  | QuartzFilterPluginInstance
  | QuartzEmitterPluginInstance
  | QuartzPageTypePluginInstance
```

이어지는 섹션에서는 각 플러그인 종류별로 구현할 수 있는 메서드를 자세히 다룬다. 그 전에, 다소 모호한 타입 몇 가지를 먼저 정리한다:

- `BuildCtx`는 `@quartz-community/types`에 정의되어 있다. 구성 요소는 다음과 같다
  - `argv`: Quartz [[build|build]] 명령에 전달된 커맨드라인 인자
  - `cfg`: 전체 Quartz [[configuration|설정]]
  - `allSlugs`: 유효한 모든 콘텐츠 slug의 목록 (slug가 무엇인지에 대한 자세한 내용은 [[paths|경로]]를 참고)
- `StaticResources`는 `@quartz-community/types`에 정의되어 있다. 구성 요소는 다음과 같다
  - `css`: 로드해야 하는 CSS 스타일 정의 목록. CSS 스타일은 `CSSResource` 타입으로 기술한다. 소스 URL 또는 스타일시트의 인라인 내용을 받는다.
  - `js`: 로드해야 하는 스크립트 목록. 스크립트는 `JSResource` 타입으로 기술한다. 로드 시점(DOM 로드 전 또는 후), 모듈 여부, 그리고 소스 URL 또는 스크립트의 인라인 내용을 정의할 수 있다.
  - `additionalHead`: 페이지의 `<head>` 태그에 추가할 JSX 요소 또는 JSX 요소를 반환하는 함수의 목록. 함수는 페이지의 데이터를 인자로 받으며 조건부로 요소를 렌더링할 수 있다.

## 시작하기

v5에서 플러그인은 독립 저장소(standalone repository)이다. 플러그인을 만드는 가장 쉬운 방법은 플러그인 템플릿을 사용하는 것이다:

```shell
# Use the plugin template to create a new repository on GitHub
# Then clone it locally
git clone https://github.com/your-username/my-plugin.git
cd my-plugin
npm install
```

템플릿은 빌드 설정(`tsup.config.ts`), TypeScript 설정, 그리고 올바른 패키지 구조를 제공한다.

## 플러그인 구조

플러그인의 기본 파일 구조는 다음과 같다:

```
my-plugin/
├── src/
│   └── index.ts          # Plugin entry point
├── tsup.config.ts         # Build configuration
├── package.json           # Dependencies and exports
└── tsconfig.json          # TypeScript configuration
```

플러그인의 `package.json`은 `@quartz-community/types`(타입 정의용)에 대한 의존성을 선언해야 하며, 선택적으로 `@quartz-community/utils`(공용 유틸리티용)도 선언할 수 있다.

## 플러그인 종류

## 플러그인 종류 선택하기

Quartz는 여섯 가지 플러그인 능력을 지원한다. 하나의 플러그인이 여러 종류를 결합할 수 있다.

| 하고 싶은 일...                                   | 플러그인 종류 |
| ------------------------------------------------ | ----------- |
| Markdown/HTML 콘텐츠 변환                         | Transformer |
| 어떤 페이지를 게시할지 결정                        | Filter      |
| 출력 파일 생성 (RSS, 사이트맵, 매니페스트)          | Emitter     |
| 특정 페이지 범주의 렌더링 방식 정의                 | Page Type   |
| 레이아웃에 UI 컴포넌트 추가                        | Component   |
| Bases 데이터베이스 시스템에 커스텀 뷰 추가          | Bases View  |

이 종류들은 **상호 배타적이지 않다**. 예를 들면:

- `obsidian-flavored-markdown`은 **transformer**(OFM 문법 처리)이면서 동시에 **컴포넌트**(mermaid 렌더링)를 제공한다
- `canvas-page`는 커스텀 **frame**도 함께 제공하는 **page type**이다
- 하나의 플러그인이 메타데이터를 추가하는 **transformer**이면서 그것을 표시하는 **컴포넌트**일 수도 있다

### Transformer

Transformer는 콘텐츠에 대해 **맵(map)** 연산을 수행한다. 즉, Markdown 파일을 받아 수정된 콘텐츠를 출력하거나 파일 자체에 메타데이터를 추가한다.

```ts
export type QuartzTransformerPluginInstance = {
  name: string
  textTransform?: (ctx: BuildCtx, src: string) => string
  markdownPlugins?: (ctx: BuildCtx) => PluggableList
  htmlPlugins?: (ctx: BuildCtx) => PluggableList
  externalResources?: (ctx: BuildCtx) => Partial<StaticResources>
}
```

모든 transformer 플러그인은 플러그인 등록을 위해 최소한 `name` 필드를 정의해야 하며, 단일 Markdown 파일 변환의 여러 단계에 개입할 수 있게 해주는 몇 가지 선택적 함수를 정의할 수 있다.

- `textTransform`은 파일이 [Markdown AST](https://github.com/syntax-tree/mdast)로 파싱되기 _전에_ 텍스트-텍스트 변환을 수행한다.
- `markdownPlugins`는 [remark 플러그인](https://github.com/remarkjs/remark/blob/main/doc/plugins.md)의 목록을 정의한다. `remark`는 Markdown을 구조적인 방식으로 Markdown으로 변환하는 도구이다.
- `htmlPlugins`는 [rehype 플러그인](https://github.com/rehypejs/rehype/blob/main/doc/plugins.md)의 목록을 정의한다. `remark`가 동작하는 방식과 비슷하게, `rehype`는 HTML을 구조적인 방식으로 HTML로 변환하는 도구이다.
- `externalResources`는 플러그인이 제대로 동작하기 위해 클라이언트 측에서 로드해야 할 수 있는 외부 리소스를 정의한다.

일반적으로 `remark`와 `rehype` 모두 이미 만들어진 플러그인을 찾아 사용할 수 있다. 직접 `remark`나 `rehype` 플러그인을 만들고 싶다면, `unified`(기반이 되는 AST 파서 및 변환 라이브러리)를 사용한 [플러그인 만들기 가이드](https://unifiedjs.com/learn/guide/create-a-plugin/)를 참고하라.

`remark`와 `rehype` 생태계를 활용하는 transformer 플러그인의 좋은 예시는 [[plugins/Latex|Latex]] 플러그인이다:

```ts
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeMathjax from "rehype-mathjax/svg"
import { QuartzTransformerPlugin } from "@quartz-community/types"

interface Options {
  renderEngine: "katex" | "mathjax"
}

export const Latex: QuartzTransformerPlugin<Options> = (opts?: Options) => {
  const engine = opts?.renderEngine ?? "katex"
  return {
    name: "Latex",
    markdownPlugins() {
      return [remarkMath]
    },
    htmlPlugins() {
      if (engine === "katex") {
        // if you need to pass options into a plugin, you
        // can use a tuple of [plugin, options]
        return [[rehypeKatex, { output: "html" }]]
      } else {
        return [rehypeMathjax]
      }
    },
    externalResources() {
      if (engine === "katex") {
        return {
          css: [
            {
              // base css
              content: "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css",
            },
          ],
          js: [
            {
              // fix copy behaviour: https://github.com/KaTeX/KaTeX/blob/main/contrib/copy-tex/README.md
              src: "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/copy-tex.min.js",
              loadTime: "afterDOMReady",
              contentType: "external",
            },
          ],
        }
      }
    },
  }
}
```

transformer 플러그인이 흔히 하는 또 다른 일은 파일을 파싱해서 그 파일에 추가 데이터를 붙이는 것이다:

```ts
import { QuartzTransformerPlugin } from "@quartz-community/types"

export const AddWordCount: QuartzTransformerPlugin = () => {
  return {
    name: "AddWordCount",
    markdownPlugins() {
      return [
        () => {
          return (tree, file) => {
            // tree is an `mdast` root element
            // file is a `vfile`
            const text = file.value
            const words = text.split(" ").length
            file.data.wordcount = words
          }
        },
      ]
    },
  }
}

// tell typescript about our custom data fields we are adding
// other plugins will then also be aware of this data field
declare module "vfile" {
  interface DataMap {
    wordcount: number
  }
}
```

마지막으로, `unist-util-visit` 패키지의 `visit` 함수나 `mdast-util-find-and-replace` 패키지의 `findAndReplace` 함수를 사용해 Markdown 또는 HTML AST에 대한 변환을 수행할 수도 있다.

```ts
import { visit } from "unist-util-visit"
import { findAndReplace } from "mdast-util-find-and-replace"
import { QuartzTransformerPlugin } from "@quartz-community/types"
import { Link } from "mdast"

export const TextTransforms: QuartzTransformerPlugin = () => {
  return {
    name: "TextTransforms",
    markdownPlugins() {
      return [
        () => {
          return (tree, file) => {
            // replace _text_ with the italics version
            findAndReplace(tree, /_(.+)_/, (_value: string, ...capture: string[]) => {
              // inner is the text inside of the () of the regex
              const [inner] = capture
              // return an mdast node
              // https://github.com/syntax-tree/mdast
              return {
                type: "emphasis",
                children: [{ type: "text", value: inner }],
              }
            })

            // remove all links (replace with just the link content)
            // match by 'type' field on an mdast node
            // https://github.com/syntax-tree/mdast#link in this example
            visit(tree, "link", (link: Link) => {
              return {
                type: "paragraph",
                children: [{ type: "text", value: link.title }],
              }
            })
          }
        },
      ]
    },
  }
}
```

끝으로 한마디 덧붙이자면, transformer 플러그인은 꽤 복잡하므로 한 번에 이해되지 않아도 걱정하지 않아도 된다. 내장 transformer들이 콘텐츠를 어떻게 처리하는지 살펴보면, 하려는 일을 어떻게 달성할 수 있을지 더 잘 감을 잡을 수 있다.

### Filter

Filter는 콘텐츠를 **필터링(filter)** 한다. 즉, 모든 transformer의 출력을 받아 실제로 어떤 파일을 유지하고 어떤 파일을 버릴지 결정한다.

```ts
export type QuartzFilterPlugin<Options extends OptionType = undefined> = (
  opts?: Options,
) => QuartzFilterPluginInstance

export type QuartzFilterPluginInstance = {
  name: string
  shouldPublish(ctx: BuildCtx, content: ProcessedContent): boolean
}
```

filter 플러그인은 `name` 필드와, 모든 transformer가 처리를 마친 콘텐츠 하나를 받아 emitter 플러그인으로 전달할지 여부에 따라 `true` 또는 `false`를 반환하는 `shouldPublish` 함수를 정의해야 한다.

예를 들어, 다음은 초안(draft)을 제거하는 내장 플러그인이다:

```ts
import { QuartzFilterPlugin } from "@quartz-community/types"

export const RemoveDrafts: QuartzFilterPlugin<{}> = () => ({
  name: "RemoveDrafts",
  shouldPublish(_ctx, [_tree, vfile]) {
    // uses frontmatter parsed from transformers
    const draftFlag: boolean = vfile.data?.frontmatter?.draft ?? false
    return !draftFlag
  },
})
```

### Emitter

Emitter는 콘텐츠에 대해 **리듀스(reduce)** 연산을 수행한다. 즉, 변환되고 필터링된 모든 콘텐츠의 목록을 받아 출력 파일을 생성한다.

```ts
export type QuartzEmitterPlugin<Options extends OptionType = undefined> = (
  opts?: Options,
) => QuartzEmitterPluginInstance

export type QuartzEmitterPluginInstance = {
  name: string
  emit(
    ctx: BuildCtx,
    content: ProcessedContent[],
    resources: StaticResources,
  ): Promise<FilePath[]> | AsyncGenerator<FilePath>
  partialEmit?(
    ctx: BuildCtx,
    content: ProcessedContent[],
    resources: StaticResources,
    changeEvents: ChangeEvent[],
  ): Promise<FilePath[]> | AsyncGenerator<FilePath> | null
  getQuartzComponents(ctx: BuildCtx): QuartzComponent[]
}
```

emitter 플러그인은 `name` 필드, `emit` 함수, 그리고 `getQuartzComponents` 함수를 정의해야 한다. 증분 빌드(incremental build)를 위해 선택적으로 `partialEmit` 함수를 구현할 수 있다.

- `emit`은 파싱되고 필터링된 모든 콘텐츠를 살펴본 뒤 적절히 파일을 생성하고, 플러그인이 생성한 파일들의 경로 목록을 반환하는 역할을 한다.
- `partialEmit`은 증분 빌드를 가능하게 하는 선택적 함수이다. 어떤 파일이 변경되었는지에 대한 정보(`changeEvents`)를 받아 필요한 파일만 선택적으로 다시 빌드할 수 있다. 이는 개발 모드에서 빌드 시간을 최적화하는 데 유용하다. `partialEmit`이 정의되어 있지 않으면 기본적으로 `emit` 함수가 사용된다.
- `getQuartzComponents`는 emitter가 페이지를 구성하는 데 사용하는 Quartz 컴포넌트를 선언한다.

새 파일을 만드는 것은 일반적인 Node [fs 모듈](https://nodejs.org/api/fs.html)(즉 `fs.cp`나 `fs.writeFile`)로 할 수도 있고, 텍스트를 포함하는 파일을 만드는 경우라면 `@quartz-community/utils`의 `write` 함수로 할 수도 있다. `write`의 시그니처는 다음과 같다:

```ts
export type WriteOptions = (data: {
  // the build context
  ctx: BuildCtx
  // the name of the file to emit (not including the file extension)
  slug: FullSlug
  // the file extension
  ext: `.${string}` | ""
  // the file content to add
  content: string
}) => Promise<FilePath>
```

이 함수는 적절한 출력 폴더에 쓰고 중간 디렉토리가 존재하도록 보장하는 얇은 래퍼(wrapper)이다. Node의 네이티브 `fs` API를 사용하기로 했다면, 마찬가지로 `argv.output` 폴더로 출력해야 한다.

컴포넌트를 렌더링해야 하는 emitter 플러그인을 만들고 있다면, 추가로 알아둘 것이 세 가지 있다:

- 컴포넌트는 페이지를 구성하는 데 사용하는 `QuartzComponents`의 목록을 `getQuartzComponents`로 선언해야 한다. 자세한 내용은 [[creating components|컴포넌트 만들기]] 페이지를 참고하라.
- `@quartz-community/utils`에 정의된 `renderPage` 함수를 사용해 Quartz 컴포넌트를 HTML로 렌더링할 수 있다.
- HTML AST를 JSX로 렌더링해야 한다면, `@quartz-community/utils`의 `htmlToJsx` 함수를 사용할 수 있다.

예를 들어, 다음은 모든 페이지 하나하나를 렌더링하는 콘텐츠 페이지 플러그인의 단순화된 버전이다.

```tsx
import { QuartzEmitterPlugin, FullPageLayout, QuartzComponentProps } from "@quartz-community/types"
import { renderPage, canonicalizeServer, pageResources, write } from "@quartz-community/utils"

export const ContentPage: QuartzEmitterPlugin = () => {
  return {
    name: "ContentPage",
    getQuartzComponents(ctx) {
      const { head, header, beforeBody, pageBody, afterBody, left, right, footer } = ctx.cfg.layout
      return [head, ...header, ...beforeBody, pageBody, ...afterBody, ...left, ...right, footer]
    },
    async emit(ctx, content, resources): Promise<FilePath[]> {
      const cfg = ctx.cfg.configuration
      const fps: FilePath[] = []
      const allFiles = content.map((c) => c[1].data)
      for (const [tree, file] of content) {
        const slug = canonicalizeServer(file.data.slug!)
        const externalResources = pageResources(slug, file.data, resources)
        const componentData: QuartzComponentProps = {
          fileData: file.data,
          externalResources,
          cfg,
          children: [],
          tree,
          allFiles,
        }

        const content = renderPage(cfg, slug, componentData, {}, externalResources)
        const fp = await write({
          ctx,
          content,
          slug: file.data.slug!,
          ext: ".html",
        })

        fps.push(fp)
      }
      return fps
    },
  }
}
```

Page type은 특정 페이지 범주가 어떻게 렌더링되는지를 정의한다. Quartz에서 새 파일 형식이나 가상 페이지에 대한 지원을 추가하는 주된 방법이다.

```ts
export interface QuartzPageTypePluginInstance {
  name: string
  priority?: number
  fileExtensions?: string[]
  match: PageMatcher
  generate?: PageGenerator
  layout: string
  frame?: string
  body: QuartzComponentConstructor
}
```

- `name`: 이 page type의 고유 식별자.
- `priority`: 여러 page type이 하나의 slug에 매칭될 수 있을 때 매칭 순서를 제어한다. 우선순위가 높은 page type이 먼저 검사된다. 기본값: `0`.
- `fileExtensions`: 이 page type이 처리하는 파일 확장자의 배열 (예: `[".canvas"]`, `[".base"]`). 콘텐츠 파일(`.md`)은 기본 콘텐츠 page type이 처리한다.
- `match`: 주어진 slug/파일을 이 page type이 렌더링해야 하는지 판별하는 함수.
- `generate`: 가상 페이지(폴더 목록이나 태그 색인처럼 디스크 상의 파일로 뒷받침되지 않는 페이지)를 생성하는 선택적 함수.
- `layout`: 레이아웃 설정 키 (예: `"content"`, `"folder"`, `"tag"`). `quartz.config.yaml`의 어떤 `byPageType` 항목이 이 page type의 레이아웃 오버라이드를 제공하는지를 결정한다.
- `frame`: 이 page type에 사용할 [[layout#Page Frames|페이지 프레임(page frame)]]. 전체 HTML 구조를 제어한다 (예: `"default"`, `"full-width"`, `"minimal"`, 또는 플러그인이 제공하는 커스텀 frame). 설정하지 않으면 기본값은 `"default"`이다. `quartz.config.yaml`의 `layout.byPageType.<name>.template`을 통해 page type별로 오버라이드할 수 있다.
- `body`: 페이지 본문 콘텐츠를 렌더링하는 Quartz 컴포넌트 생성자.

### 커스텀 Frame 제공하기

플러그인은 자체 [[layout#Page Frames|페이지 프레임]]을 함께 배포할 수 있다. 페이지 프레임은 HTML 구조(사이드바, 헤더, 콘텐츠 영역, 푸터)가 어떻게 배치되는지를 제어하는 커스텀 페이지 레이아웃이다. 이는 근본적으로 다른 레이아웃이 필요한 page type(예: 전체 화면 캔버스, 프레젠테이션 모드, 대시보드)에 유용하다.

커스텀 frame을 제공하려면:

**1. frame 파일을 만든다:**

```tsx title="src/frames/MyFrame.tsx"
import type { PageFrame, PageFrameProps } from "@quartz-community/types"
import type { ComponentChildren } from "preact"

export const MyFrame: PageFrame = {
  name: "my-frame",
  css: `
.page[data-frame="my-frame"] > #quartz-body {
  grid-template-columns: 1fr;
  grid-template-areas: "center";
}
`,
  render({ componentData, pageBody: Content, footer: Footers }: PageFrameProps): unknown {
    const renderSlot = (C: (props: typeof componentData) => unknown): ComponentChildren =>
      C(componentData) as ComponentChildren
    return (
      <div class="center">
        {(Content as any)(componentData)}
        {Footers.map((Footer) => (Footer as any)(componentData))}
      </div>
    )
  },
}
```

핵심 요구사항:

- `name`: 고유한 문자열 식별자. page type과 YAML 설정이 이 값으로 frame을 참조한다.
- `render()`: 모든 레이아웃 슬롯(헤더, 사이드바, 콘텐츠, 푸터)을 받아 페이지 내부 구조에 해당하는 JSX를 반환한다. 참고로 `footer`는 `QuartzComponent[]`(배열)이므로, frame은 `.map()`으로 순회하여 모든 푸터 컴포넌트를 렌더링해야 한다.
- `css` (선택): frame 전용 CSS. 충돌을 피하기 위해 `.page[data-frame="my-frame"]` 셀렉터로 범위를 한정한다.

**2. frame을 다시 내보낸다(re-export):**

```ts title="src/frames/index.ts"
export { MyFrame } from "./MyFrame"
```

**3. `package.json`에 frame을 선언한다:**

```json title="package.json"
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./frames": {
      "import": "./dist/frames/index.js",
      "types": "./dist/frames/index.d.ts"
    }
  },
  "quartz": {
    "frames": {
      "MyFrame": { "exportName": "MyFrame" }
    }
  }
}
```

`"quartz"` 매니페스트의 `"frames"` 필드는 내보내기(export) 이름을 frame 메타데이터에 매핑한다. 키(예: `"MyFrame"`)는 `src/frames/index.ts`의 내보내기 이름과 일치해야 한다.

**4. 빌드 설정에 frame 진입점을 추가한다:**

```ts title="tsup.config.ts"
export default defineConfig({
  entry: ["src/index.ts", "src/frames/index.ts"],
  // ...
})
```

**5. page type에서 frame을 참조한다:**

```ts
export const MyPageType: QuartzPageTypePlugin = () => ({
  name: "MyPageType",
  frame: "my-frame", // References the frame by its name property
  // ...
})
```

사용자가 플러그인을 설치하면 Quartz가 `./frames` 내보내기에서 frame을 자동으로 로드하여 Frame Registry에 등록한다. 그러면 그 frame은 어떤 page type이나 YAML 설정 오버라이드에서든 이름으로 사용할 수 있게 된다.

> [!tip]
> 플러그인이 제공하는 frame의 완전한 실전 예시는 [`canvas-page`](https://github.com/quartz-community/canvas-page) 플러그인을 참고하라.

### Bases View

`bases-page` 플러그인은 Obsidian Bases와 유사한 데이터베이스 형태의 뷰 시스템을 제공한다. 다른 플러그인은 `ViewRegistry`를 통해 커스텀 뷰 타입을 등록할 수 있다:

```ts
import { viewRegistry } from "@quartz-community/bases-page";
import type { ViewTypeRegistration } from "@quartz-community/bases-page";

viewRegistry.register({
  id: "timeline",
  name: "Timeline",
  icon: "git-branch",
  render: ({ entries, view, slug, allSlugs }) => (
    <div class="bases-timeline">
      {entries.map(entry => <div>{entry.properties.title}</div>)}
    </div>
  ),
  css: `.bases-timeline { display: flex; flex-direction: column; }`,
  afterDOMLoaded: `document.addEventListener("nav", () => { /* setup */ })`,
});
```

각 뷰 등록에는 다음이 포함된다:

- `id`: 고유 식별자 (예: `"timeline"`, `"kanban"`)
- `name`: 뷰 선택기에 표시되는 이름
- `icon`: 선택적인 Lucide 아이콘 이름
- `render`: `ViewRendererProps`를 받아 Preact JSX를 반환하는 함수
- `css`: 선택적인 CSS 문자열 (뷰 ID 기준으로 중복 제거됨)
- `afterDOMLoaded`: 선택적인 클라이언트 측 스크립트 (컴포넌트 스크립트와 동일한 생명주기)
- `options`: 모든 render 호출에 전달되는 선택적 설정

`ViewRegistry`는 (`Symbol.for`를 통한) 전역 싱글턴이므로, 모듈의 모든 복사본이 동일한 레지스트리를 공유한다.

## 빌드와 배포

Quartz v5 플러그인은 미리 빌드된 `dist/`를 저장소에 포함해 배포한다. 사용자가 플러그인을 설치할 때 Quartz가 미리 빌드된 출력물을 감지하면 설치/빌드 사이클을 완전히 건너뛴다. 그래서 설치가 거의 즉시 완료된다.

### 빌드 설정

플러그인 템플릿의 `tsup.config.ts`는 기본적으로 모든 의존성을 번들링한다. 다만 **싱글턴 외부 패키지(singleton externals)**, 즉 모든 플러그인에서 동일한 인스턴스여야 하는 패키지들만 번들링에서 제외된다:

```ts
const SINGLETON_EXTERNALS = [
  "preact",
  "preact/hooks",
  "preact/jsx-runtime",
  "preact/compat",
  "@jackyzha0/quartz",
  "@jackyzha0/quartz/*",
  "vfile",
  "vfile/*",
  "unified",
]

export default defineConfig({
  // ...
  noExternal: [/.*/], // Bundle everything
  external: SINGLETON_EXTERNALS, // Except singletons
})
```

즉, 플러그인의 `dist/index.js`는 자급자족적이어서 설치 시점에 `npm install`이 필요 없다.

### 미리 빌드된 출력물 배포하기

플러그인의 `dist/` 디렉토리는 저장소에 커밋되어야 한다:

1. **`dist/`를 `.gitignore`에 추가하지 않는다**
2. 커밋 전에 `npm run build`를 실행한다
3. CI 워크플로가 푸시할 때마다 `dist/`가 최신 상태인지 검증한다

`dist/`가 없거나 gitignore되어 있으면, Quartz는 전체 설치/빌드 사이클로 폴백한다 (심볼릭 링크로 연결된 플러그인으로 로컬 개발할 때 유용하다).

### 네이티브 의존성이 있는 플러그인

네이티브 패키지가 필요한 플러그인(예: 이미지 처리를 위한 `sharp`)은 그 패키지를 번들링할 수 없다. 이런 플러그인의 경우:

1. `package.json`의 quartz 매니페스트에 `"requiresInstall": true`를 설정한다
2. 네이티브 패키지를 `peerDependency`로 선언한다
3. Quartz가 빌드 시점에 호스트 프로젝트에 그 패키지를 설치한다

```shell
# Build the plugin
npm run build
# or
npx tsup
```

## 무엇을 어디서 임포트할까

| 필요한 것...                                                            | 임포트 위치                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 타입 정의 (`QuartzTransformerPlugin`, `QuartzComponent` 등)             | `@quartz-community/types`                                         |
| 경로 유틸리티 (`simplifySlug`, `resolveRelative`, `pathToRoot`)         | `@quartz-community/utils/path`                                    |
| DOM 유틸리티 (`removeAllChildren`, `registerEscapeHandler`)             | `@quartz-community/utils/dom`                                     |
| JSX 변환 (`htmlToJsx`)                                                  | `@quartz-community/utils/jsx`                                     |
| 언어 유틸리티 (`classNames`, `capitalize`)                              | `@quartz-community/utils/lang`                                    |
| 날짜/정렬 유틸리티 (`formatDate`, `getDate`, `byDateAndAlphabetical`)   | `@quartz-community/utils/date` 및 `@quartz-community/utils/sort`  |
| HTML 이스케이프 (`escapeHTML`, `unescapeHTML`)                          | `@quartz-community/utils/escape`                                  |
| 이모지 유틸리티 (`getIconCode`)                                         | `@quartz-community/utils/emoji`                                   |
| 브라우저 런타임 (`onNav`, `onRender`, `fetchContentIndex`)              | `@quartz-community/runtime`                                       |

`@jackyzha0/quartz`나 `vfile`에서 직접 임포트하지 **않는다**. 대신 커뮤니티 패키지를 사용한다.

## 국제화(i18n)

플러그인은 사용자에게 보이는 문자열에 대해 자체 번역을 제공해야 한다. 컴포넌트에 문자열을 하드코딩하지 **않는다**.

### i18n 설정하기

다음 구조를 만든다:

```
src/i18n/
├── index.ts
└── locales/
    └── en-US.ts
```

**`src/i18n/locales/en-US.ts`** (필수 기본 로케일):

```ts
export default {
  components: {
    myPlugin: {
      title: "My Plugin",
      description: "A description",
      itemCount: ({ count }: { count: number }) => (count === 1 ? "1 item" : `${count} items`),
    },
  },
}
```

**`src/i18n/index.ts`**:

```ts
import enUS from "./locales/en-US"

const locales: Record<string, typeof enUS> = {
  "en-US": enUS,
}

export function i18n(locale: string) {
  return locales[locale] || enUS
}
```

### 컴포넌트에서 i18n 사용하기

```tsx
import { i18n } from "../i18n"

const MyComponent: QuartzComponent = ({ cfg }) => {
  const locale = cfg.locale ?? "en-US"
  const t = i18n(locale).components.myPlugin
  return <h2>{t.title}</h2>
}
```

### 번역 추가하기

새 로케일을 추가하려면 `en-US.ts`를 복사해서 문자열을 번역한 뒤 등록한다:

```ts
// src/i18n/locales/fr-FR.ts
export default {
  components: {
    myPlugin: {
      title: "Mon Plugin",
      description: "Une description",
      itemCount: ({ count }: { count: number }) =>
        count === 1 ? "1 élément" : `${count} éléments`,
    },
  },
}
```

```ts
// src/i18n/index.ts
import enUS from "./locales/en-US"
import frFR from "./locales/fr-FR"

const locales: Record<string, typeof enUS> = {
  "en-US": enUS,
  "fr-FR": frFR,
}
```

[BCP 47](https://en.wikipedia.org/wiki/IETF_language_tag) 로케일 코드를 사용한다 (예: `en-US`, `de-DE`, `ja-JP`, `zh-CN`). 동적인 내용에는 위의 `itemCount`처럼 함수 기반 번역을 사용한다.

## 플러그인 설치하기

```shell
# In your Quartz project
npx quartz plugin add github:your-username/my-plugin
```

이 명령은 플러그인을 클론하고 `quartz.config.yaml`과 `quartz.lock.json` 양쪽에 추가한다. 플러그인이 미리 빌드된 `dist/`를 포함해 배포된다면(권장), 빌드 단계 없이 설치가 몇 초 안에 완료된다. 그 후 설정 파일에서 플러그인을 구성할 수 있다:

```yaml title="quartz.config.yaml"
plugins:
  - source: github:your-username/my-plugin
    enabled: true
```

JavaScript 콜백 함수가 필요한 옵션(YAML로 표현할 수 없는 것)에는 `quartz.ts`의 TS 오버라이드를 사용한다:

```ts title="quartz.ts (override)"
import * as ExternalPlugin from "./.quartz/plugins"

// Must be placed before loadQuartzConfig()
ExternalPlugin.MyPlugin({
  customFn: (data) => {
    // ...
  },
})
```

`quartz.ts`로 설정한 옵션은 인스턴스화 시점에 YAML 옵션과 병합되며, `quartz.ts`의 오버라이드가 우선한다. 이 호출들은 `quartz.ts`에서 반드시 `loadQuartzConfig()` **앞에** 배치해야 한다.

### 개발 워크플로

플러그인을 개발하는 동안에는 변경 사항을 테스트하기 위해 플러그인을 자주 설치하고 제거하게 된다. 다음 명령들이 이 사이클을 관리하는 데 도움이 된다:

```shell
# Remove your plugin and clean up
npx quartz plugin remove my-plugin

# Re-add after making changes
npx quartz plugin add github:your-username/my-plugin
```

아직 설치되지 않은 플러그인을 참조하도록 `quartz.config.yaml`을 갱신했다면, 수동으로 `add`를 실행하지 않고도 설치할 수 있다:

```shell
# Install all config-referenced plugins missing from the lockfile
npx quartz plugin install --from-config

# Preview first without making changes
npx quartz plugin install --from-config --dry-run
```

설치되어 있지만 설정에서 더 이상 참조하지 않는 플러그인을 정리하려면:

```shell
# Remove orphaned plugins
npx quartz plugin prune

# Preview first without making changes
npx quartz plugin prune --dry-run
```

> [!tip]
> `resolve`와 `prune` 모두 `quartz.config.yaml`이 없으면 `quartz.config.default.yaml`로 폴백한다. 기본 설정이 진실의 원천인 CI 환경에서 유용하다. 전체 세부 사항은 [[cli/plugin#prune|prune]]과 [[cli/plugin#resolve|resolve]]를 참고하라.

## 컴포넌트 플러그인

시각적 컴포넌트(Explorer, Graph, Search 같은)를 제공하는 플러그인에 대해서는 [[creating components|컴포넌트 플러그인 만들기]] 가이드를 참고하라.

컴포넌트 전용 플러그인(매니페스트에 `"category": ["component"]`가 있는 플러그인)은 팩토리 함수가 아니라 부수 효과(side-effect) 임포트로 로드된다. 컴포넌트 전용 플러그인이 `quartz.config.yaml`에서 사용자 옵션을 받아야 한다면 `init(options)` 함수를 내보내면 된다. 자세한 내용은 [[creating components#Receiving YAML Options in Component-Only Plugins|YAML 옵션 받기]]를 참고하라.
