---
title: 레이아웃
---

일부 emitter는 [HTML](https://developer.mozilla.org/en-US/docs/Web/HTML) 파일을 출력하기도 한다. 이런 emitter들은 손쉬운 커스터마이즈를 위해 페이지의 레이아웃을 자유롭게 재배치할 수 있도록 한다.

v5에서 레이아웃은 `quartz.config.yaml`에 정의한다. 각 플러그인은 `layout.position`과 `layout.priority` 필드를 통해 자신의 레이아웃 위치를 스스로 제어한다. 최상위 `layout` 섹션은 두 가지 추가 메커니즘을 제공한다:

- `layout.groups`는 여러 컴포넌트를 하나의 행 또는 열로 묶는 플렉스 컨테이너(예: `toolbar`)를 정의한다. 자세한 내용은 [[layout-components]]를 참고한다.
- `layout.byPageType`은 page type별(content, folder, tag, 404) 오버라이드를 담는다. beforeBody, left, right 섹션을 오버라이드할 수 있으며, 선택적으로 `template`을 지정해 페이지의 [[#Page Frames|페이지 프레임]]을 제어할 수 있다.

각 페이지는 `QuartzComponents`를 담는 여러 섹션으로 구성된다. 다음 코드 조각은 컴포넌트를 추가할 수 있는 모든 유효한 섹션을 나열한다:

```typescript title="quartz/cfg.ts"
export interface FullPageLayout {
  head: QuartzComponent // single component
  header: QuartzComponent[] // laid out horizontally
  beforeBody: QuartzComponent[] // laid out vertically
  pageBody: QuartzComponent // single component
  afterBody: QuartzComponent[] // laid out vertically
  left: QuartzComponent[] // vertical on desktop and tablet, horizontal on mobile
  right: QuartzComponent[] // vertical on desktop, horizontal on tablet and mobile
  footer: QuartzComponent[] // laid out vertically
}
```

이 섹션들은 페이지의 다음 부분에 해당한다:

| 레이아웃                          | 미리보기                            |
| ------------------------------- | ----------------------------------- |
| 데스크톱 (width > 1200px)        | ![[quartz-layout-desktop.png\|800]] |
| 태블릿 (800px < width < 1200px)  | ![[quartz-layout-tablet.png\|800]]  |
| 모바일 (width < 800px)           | ![[quartz-layout-mobile.png\|800]]  |

> [!note]
> 위 다이어그램에 표시되지 _않은_ 레이아웃 필드가 두 가지 더 있다.
>
> 1. `head`는 HTML의 `<head>` [태그](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/head)를 렌더링하는 단일 컴포넌트다. 페이지에 시각적으로 나타나지 않으며, 탭 제목, 스크립트, 스타일처럼 문서에 대한 메타데이터만 담당한다.
> 2. `header`는 가로로 배치되는 컴포넌트들의 집합으로, `beforeBody` 섹션 _앞에_ 나타난다. 플러그인 설정에서 `layout.position: header`를 지정해 컴포넌트를 header에 배치할 수 있다. 이를 통해 제목, 검색창, 다크 모드 토글이 있는 Quartz 3의 헤더 바와 유사한 레이아웃을 만들 수 있다.

레이아웃 컴포넌트는 `quartz.config.yaml`의 `layout` 섹션에서 설정한다. 플러그인이 자신의 위치와 우선순위를 선언하면 레이아웃 시스템이 자동으로 배치한다:

```yaml title="quartz.config.yaml"
plugins:
  - source: github:quartz-community/explorer
    enabled: true
    layout:
      position: left
      priority: 50
  - source: github:quartz-community/graph
    enabled: true
    layout:
      position: right
      priority: 10
  - source: github:quartz-community/search
    enabled: true
    layout:
      position: left
      priority: 20
  - source: github:quartz-community/backlinks
    enabled: true
    layout:
      position: right
      priority: 30
  - source: github:quartz-community/article-title
    enabled: true
    layout:
      position: beforeBody
      priority: 10
  - source: github:quartz-community/content-meta
    enabled: true
    layout:
      position: beforeBody
      priority: 20
  - source: github:quartz-community/tag-list
    enabled: true
    layout:
      position: beforeBody
      priority: 30
  - source: github:quartz-community/darkmode
    enabled: true
    layout:
      position: header
      priority: 10
  - source: github:quartz-community/footer
    enabled: true
    options:
      links:
        GitHub: https://github.com/jackyzha0/quartz
        Discord Community: https://discord.gg/cRFFHYye7t
    layout:
      position: footer
      priority: 50

layout:
  groups:
    toolbar:
      direction: row
      gap: 0.5rem
  byPageType:
    content: {}
    folder:
      exclude:
        - reader-mode
      positions:
        right: []
    tag:
      exclude:
        - reader-mode
      positions:
        right: []
    "404":
      positions:
        beforeBody: []
        left: []
        right: []
```

### 조건부 렌더링

플러그인은 레이아웃 블록에 `condition`을 지정해 언제 표시될지 제어할 수 있다. 이는 내장 프리셋을 사용한다:

```yaml title="quartz.config.yaml"
plugins:
  - source: github:quartz-community/breadcrumbs
    enabled: true
    layout:
      position: beforeBody
      priority: 5
      condition: not-index
```

사용 가능한 조건:

| 조건        | 효과                                                  |
| ----------- | ---------------------------------------------------- |
| `not-index` | 루트 인덱스 페이지에서는 숨겨지고 그 외 모든 곳에서 표시된다 |
| `has-tags`  | frontmatter에 태그가 있는 페이지에서만 표시된다          |

조건부 렌더링과 표시 옵션에 대한 자세한 내용은 [[layout-components]]를 참고한다.

TypeScript를 이용한 고급 레이아웃 오버라이드(예: 커스텀 컴포넌트 래퍼나 조건부 로직)가 필요하면 `quartz.ts`에서 TS 오버라이드를 사용할 수 있다:

```ts title="quartz.ts"
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout({
  defaults: {
    // override default layout for all page types
  },
  byPageType: {
    content: {
      // override layout for content pages only
    },
    folder: {
      // override layout for folder pages only
    },
  },
})
```

`defaults`에 정의된 필드는 `byPageType`의 개별 항목으로 오버라이드할 수 있다.

커뮤니티 컴포넌트 플러그인은 `npx quartz plugin add github:quartz-community/<name>`으로 설치한다. 내장 레이아웃 유틸리티(Flex, MobileOnly, DesktopOnly 등)는 [[layout-components]]를 참고한다.

Quartz의 동작을 더 깊이 커스터마이즈하는 데 관심이 있다면 [[creating components|컴포넌트 만들기]] 가이드도 확인해 볼 수 있다.

### Page Frames

페이지 프레임(page frame)은 페이지의 전체 HTML 구조를 제어한다. 구체적으로는 레이아웃 슬롯(사이드바, 헤더, 콘텐츠, 푸터)이 페이지 셸 안에서 어떻게 배치되는지를 결정한다. page type마다 서로 다른 프레임을 사용해 근본적으로 다른 레이아웃을 만들 수 있다.

Quartz는 세 가지 내장 프레임을 제공한다:

| 프레임        | 설명                                                                                                                                                            | 사용처                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `default`    | 왼쪽 사이드바, 중앙 콘텐츠(header, beforeBody, content, afterBody), 오른쪽 사이드바, 푸터로 이루어진 3열 레이아웃. Quartz의 표준 레이아웃이다.                      | ContentPage, FolderPage, TagPage, BasesPage |
| `full-width` | 사이드바 없음. header, content, afterBody, footer가 있는 단일 중앙 열이 전체 너비를 차지한다.                                                                     | —                                           |
| `minimal`    | 사이드바 없음, header나 beforeBody 같은 부가 요소도 없음. 콘텐츠와 푸터만 있다.                                                                                  | NotFoundPage (404)                          |

플러그인이 자체 프레임을 제공할 수도 있다. 예를 들어 `canvas-page` 플러그인은 토글 가능한 사이드바가 있는 전체 화면 캔버스를 제공하는 `"canvas"` 프레임을 포함한다.

#### 프레임 결정 방식

각 page type은 플러그인 소스 코드의 `frame` 속성으로 기본 프레임을 선언할 수 있다. 결정 순서는 다음과 같다:

1. **YAML 설정 오버라이드**: `quartz.config.yaml`의 `layout.byPageType.<name>.template`
2. **플러그인이 등록한 프레임**: 플러그인이 Frame Registry를 통해 등록한 프레임 (플러그인의 `frames` export에서 로드된다)
3. **플러그인 선언**: page type 플러그인의 소스 코드에 설정된 `frame` 속성
4. **폴백**: `"default"`

예를 들어 canvas 페이지가 minimal 프레임을 사용하도록 오버라이드하려면:

```yaml title="quartz.config.yaml"
layout:
  byPageType:
    canvas:
      template: minimal
```

#### 커스텀 프레임

커스텀 프레임을 제공하는 방법은 두 가지다:

**1. 플러그인 제공 프레임 (재사용 가능한 프레임에 권장):**

플러그인은 `package.json`에 프레임을 선언하고 `./frames` 서브패스에서 export하여 자체 프레임을 제공할 수 있다. 자세한 내용은 [[making plugins#Providing Custom Frames|플러그인 가이드]]를 참고한다. 프레임이 있는 플러그인이 설치되면 그 프레임들은 Frame Registry에 자동으로 등록되어 이름으로 사용할 수 있게 된다.

**2. 코어 프레임 (프로젝트 전용 프레임용):**

`quartz/components/frames/`에 직접 프레임을 만들 수도 있다. `PageFrame` 인터페이스를 구현하고 `quartz/components/frames/index.ts`에 프레임을 등록하면 된다. 전체 `PageFrame` 인터페이스는 [[architecture|아키텍처 개요]]를 참고한다.

프레임은 `.page` 요소의 `data-frame` 속성으로 적용되며, CSS에서 이를 타겟팅할 수 있다:

```scss
.page[data-frame="my-frame"] > #quartz-body {
  /* custom grid layout */
}
```

다른 프레임과의 충돌을 피하기 위해 프레임 CSS는 `[data-frame="name"]` 셀렉터로 스코프를 한정해야 한다.

### 레이아웃 브레이크포인트

Quartz는 웹사이트를 보는 화면의 너비에 따라 서로 다른 레이아웃을 사용한다.

레이아웃의 브레이크포인트는 `variables.scss`에서 설정할 수 있다.

- `mobile`: 이 크기보다 작은 화면 너비에서는 모바일 레이아웃을 사용한다.
- `desktop`: 이 크기보다 큰 화면 너비에서는 데스크톱 레이아웃을 사용한다.
- `mobile`과 `desktop` 너비 사이의 화면에서는 태블릿 레이아웃을 사용한다.

```scss
$breakpoints: (
  mobile: 800px,
  desktop: 1200px,
);
```

### 스타일

색상 구성이나 폰트처럼 의미 있는 스타일 변경의 대부분은 [[configuration#General Configuration|일반 설정]] 옵션만으로 간단히 할 수 있다. 다만 더 깊이 있는 스타일 변경을 원한다면 직접 스타일을 작성하면 된다. Quartz는 스타일링에 [Sass](https://sass-lang.com/guide/)를 사용한다.

기본 스타일시트는 `quartz/styles/base.scss`에서 볼 수 있으며, 자신만의 스타일은 `quartz/styles/custom.scss`에 작성한다.

> [!note]
> 일부 컴포넌트는 자체 스타일을 함께 제공할 수 있다. 커뮤니티 플러그인은 자체 스타일을 번들로 포함한다. 특정 컴포넌트의 스타일을 커스터마이즈하고 싶다면 해당 컴포넌트 정의를 확인해 스타일이 어떻게 정의되어 있는지 살펴보아야 한다.
