---
title: 아키텍처
---

Quartz는 정적 사이트 생성기(static site generator)이다. 어떻게 동작하는가?

이 질문에 답하는 가장 좋은 방법은 사용자(바로 당신!)가 커맨드라인에서 `npx quartz build`를 실행했을 때 무슨 일이 일어나는지 따라가 보는 것이다:

## 서버에서

1. `npx quartz build`를 실행하면, npm은 `package.json`에서 `quartz`의 `bin` 항목을 찾는다. 이 항목은 `./quartz/bootstrap-cli.mjs`를 가리킨다.
2. 이 파일의 맨 위에는 [셔뱅(shebang)](<https://en.wikipedia.org/wiki/Shebang_(Unix)>) 줄이 있어서, npm이 이 파일을 Node로 실행하도록 지시한다.
3. `bootstrap-cli.mjs`는 다음 몇 가지를 담당한다:
   1. [yargs](http://yargs.js.org/)를 사용해 커맨드라인 인자를 파싱한다. 외부 플러그인 관리를 위한 `plugin` 서브커맨드도 여기서 처리된다.
   2. [esbuild](https://esbuild.github.io/)를 사용해 (TypeScript로 작성된) Quartz의 나머지 부분을 일반 JavaScript로 트랜스파일하고 번들링한다. 여기서 쓰이는 `esbuild` 설정은 약간 특별한데, [esbuild-sass-plugin v2](https://www.npmjs.com/package/esbuild-sass-plugin)를 사용해 `.scss` 파일 임포트도 처리하기 때문이다. 또한 컴포넌트가 선언하는 '인라인' 클라이언트 사이드 스크립트(모든 `.inline.ts` 파일)를 커스텀 `esbuild` 플러그인으로 번들링하는데, 이 플러그인은 `node`가 아니라 브라우저를 대상으로 번들링하는 또 하나의 `esbuild` 인스턴스를 실행한다. 두 종류의 모듈 모두 일반 텍스트로 임포트된다.
   3. `--serve`가 설정되어 있으면 로컬 프리뷰 서버를 실행한다. 이때 두 개의 서버가 시작된다:
      1. 핫 리로드(hot-reload) 신호를 처리하는 3001번 포트의 WebSocket 서버. 이 서버는 모든 인바운드 연결을 추적하며, 서버 측 변경(콘텐츠 또는 설정)이 감지되면 'rebuild' 메시지를 보낸다.
      2. 실제 웹사이트 파일을 제공하는, 사용자가 정의한 포트(보통 8080)의 HTTP 파일 서버.
   4. `--serve` 플래그가 설정되어 있으면, 소스 코드 변경(예: `.ts`, `.tsx`, `.scss` 또는 패키저 파일)을 감지하는 파일 워처(file watcher)도 시작한다. 변경이 일어나면 esbuild의 [rebuild API](https://esbuild.github.io/api/#rebuild)를 사용해 모듈(위의 2단계)을 다시 빌드하는데, 덕분에 빌드 시간이 크게 줄어든다.
   5. Quartz의 메인 빌드 모듈(`quartz/build.ts`)을 트랜스파일한 뒤 캐시 파일 `.quartz-cache/transpiled-build.mjs`에 기록하고, `await import(cacheFile)`로 동적으로 임포트한다. 다만 Node의 [임포트 캐시](https://github.com/nodejs/modules/issues/307)를 무효화하려면 꽤 영리하게 처리해야 하므로, 랜덤 쿼리 문자열을 붙여 Node가 새 모듈이라고 착각하게 만든다. 하지만 이 방식은 메모리 누수를 일으키기 때문에, 사용자가 한 세션에서 설정을 너무 여러 번 핫 리로드하지 않기를 바랄 뿐이다 :)) (리로드할 때마다 약 350kB의 메모리가 누수된다). 모듈을 임포트한 후에는, 앞서 파싱한 커맨드라인 인자와 함께 클라이언트에 새로고침 신호를 보내기 위한 콜백 함수를 전달하면서 이를 호출한다.
4. `build.ts`에서는 먼저 앞서 도입한 쿼리 문자열 캐시 무효화 꼼수를 감안해 소스 맵 지원을 수동으로 설치한다. 그런 다음 콘텐츠 처리를 시작한다:
   1. 출력 디렉토리를 정리한다.
   2. `.gitignore`를 존중하면서 `content` 폴더의 모든 파일을 재귀적으로 글롭(glob)한다.
   3. Markdown 파일을 파싱한다.
      1. Quartz는 사용 가능한 스레드 수를 감지하고, 파싱할 콘텐츠가 128개를 넘으면(대략적인 휴리스틱) 워커 스레드를 생성하기로 결정한다. 워커를 생성해야 하는 경우, esbuild를 다시 호출해 워커 스크립트 `quartz/worker.ts`를 트랜스파일한다. 그런 다음 작업 훔치기(work-stealing) 방식의 [workerpool](https://www.npmjs.com/package/workerpool)이 생성되고, 128개 파일 단위의 배치가 워커들에 할당된다.
      2. 각 워커(동시성이 없으면 그냥 메인 스레드)는 [[configuration|설정]]에 정의된 플러그인을 기반으로 [unified](https://github.com/unifiedjs/unified) 파서를 생성한다.
      3. 파싱은 세 단계로 이루어진다:
         1. 파일을 [vfile](https://github.com/vfile/vfile)로 읽어 들인다.
         2. 플러그인이 정의한 텍스트 변환을 콘텐츠에 적용한다.
         3. 파일 경로를 slug화하고 이를 해당 파일의 데이터에 저장한다. Quartz에서 경로 로직이 어떻게 동작하는지에 대한 자세한 내용은 [[paths|경로]] 페이지를 참고하라(스포일러: 복잡하다).
         4. [remark-parse](https://www.npmjs.com/package/remark-parse)를 사용해 Markdown을 파싱한다(텍스트에서 [mdast](https://github.com/syntax-tree/mdast)로).
         5. 플러그인이 정의한 Markdown에서 Markdown으로의 변환을 적용한다.
         6. [remark-rehype](https://github.com/remarkjs/remark-rehype)를 사용해 Markdown을 HTML로 변환한다([mdast](https://github.com/syntax-tree/mdast)에서 [hast](https://github.com/syntax-tree/hast)로).
         7. 플러그인이 정의한 HTML에서 HTML로의 변환을 적용한다.
   4. 플러그인을 사용해 원치 않는 콘텐츠를 걸러낸다.
   5. 플러그인을 사용해 파일을 방출(emit)한다.
      1. 각 emitter 플러그인이 선언하는 모든 정적 리소스(예: 외부 CSS, JS 모듈 등)를 수집한다.
      2. HTML 파일을 방출하는 emitter는 여기서 약간의 추가 작업을 하는데, 파싱 단계에서 생성된 [hast](https://github.com/syntax-tree/hast)를 JSX로 변환해야 하기 때문이다. 이 변환은 [Preact](https://preactjs.com/) 런타임과 함께 [hast-util-to-jsx-runtime](https://github.com/syntax-tree/hast-util-to-jsx-runtime)을 사용해 이루어진다. 마지막으로 JSX는 [preact-render-to-string](https://github.com/preactjs/preact-render-to-string)을 사용해 HTML로 렌더링되는데, 이는 JSX를 정적으로 HTML로 렌더링한다(즉, `useState`, `useEffect` 등 React/Preact의 상호작용 관련 요소는 신경 쓰지 않는다). 여기서는 그 밖에도 `quartz.config.yaml`로부터 페이지 [[layout|레이아웃]]을 조립하고, 실제로 클라이언트에 전달되는 모든 인라인 스크립트와 트랜스파일된 스타일 전부를 조립하는 등 여러 흥미로운 일을 한다. 이 로직의 대부분은 `quartz/components/renderPage.tsx`에서 찾을 수 있다. 그 밖에 주목할 만한 흥미로운 것들:
         1. CSS는 [Lightning CSS](https://github.com/parcel-bundler/lightningcss)를 사용해 최소화(minify)되고 변환되어, 벤더 프리픽스가 추가되고 문법 하향 변환(syntax lowering)이 수행된다.
         2. 스크립트는 `beforeDOMLoaded`와 `afterDOMLoaded`로 나뉘어 각각 `<head>`와 `<body>`에 삽입된다.
      3. 마지막으로, 각 emitter 플러그인은 자신이 방출한 파일을 직접 디스크에 기록할 책임을 진다.
   6. `--serve` 플래그가 감지된 경우, 콘텐츠 변경(`.md` 파일만)을 감지하는 또 다른 파일 워처도 설정한다. 각 slug에 대해 파싱된 AST와 플러그인 데이터를 추적하는 콘텐츠 맵을 유지하며, 파일이 변경되면 이를 갱신한다. 새로 추가되거나 수정된 경로는 다시 빌드되어 콘텐츠 맵에 추가된다. 그런 다음 모든 filter와 emitter가 결과 콘텐츠 맵 전체에 대해 실행된다. 이 파일 워처는 250ms 임계값으로 디바운스(debounce)된다. 성공하면, 전달받은 콜백 함수를 사용해 클라이언트 새로고침 신호를 보낸다.

## 클라이언트에서

1. 브라우저가 Quartz 페이지를 열고 HTML을 로드한다. `<head>`는 페이지 스타일(`public/index.css`로 방출됨)과 페이지에 필수적인 JS(`public/prescript.js`로 방출됨)도 링크한다.
2. 그런 다음 body가 로드되면, 브라우저는 필수적이지 않은 JS(`public/postscript.js`로 방출됨)를 로드한다.
3. 페이지 로딩이 끝나면, 페이지는 커스텀 합성 브라우저 이벤트인 `"nav"`를 디스패치한다. 이는 컴포넌트가 선언한 클라이언트 사이드 스크립트가 페이지 DOM 접근이 필요한 것들을 '설정(setup)'할 수 있도록 하기 위해 사용된다.
   1. [[configuration|설정]]에서 [[SPA Routing|enableSPA 옵션]]이 활성화되어 있으면, 이 `"nav"` 이벤트는 클라이언트 측 네비게이션이 일어날 때마다 발생하여, 컴포넌트가 이벤트 핸들러와 상태를 해제하고 다시 등록할 수 있게 한다.
   2. 활성화되어 있지 않으면, `"nav"` 이벤트가 페이지 로드 후 딱 한 번만 발생하도록 연결하여, SPA 컨텍스트와 비 SPA 컨텍스트 양쪽에서 상태가 설정되는 방식의 일관성을 보장한다.
   3. 전체 네비게이션 없이 DOM이 제자리에서 갱신될 때(예: 콘텐츠 복호화 후)는 별도의 `"render"` 이벤트가 디스패치될 수 있다. 콘텐츠 요소에 리스너를 붙이는 컴포넌트는 `"nav"`와 `"render"` 모두를 수신해야 한다.

## 커뮤니티 패키지 계층화

Quartz v5는 공유 코드를 세 개의 커뮤니티 패키지로 분리하며, 각각은 뚜렷한 책임을 가진다:

- **`@quartz-community/types`** — 타입 정의, 인터페이스, 그리고 표준(canonical) `vfile` DataMap 확장(augmentation). 이는 Quartz와 플러그인 사이의 "계약"이다. 런타임 의존성이 없다.
- **`@quartz-community/utils`** — 공유 유틸리티 함수(경로 조작, DOM 헬퍼, 정렬, 날짜 포매팅, JSX 변환 등). `@quartz-community/types`에 의존한다.
- **`@quartz-community/runtime`** — 클라이언트 사이드 스크립트를 위한 브라우저 전용 유틸리티(이벤트 처리, 네비게이션, 스토리지, 스크립트 로딩). `types`와 `utils` 모두에 의존한다.

```
types (no deps)
  ↑
utils (depends on types)
  ↑
runtime (depends on types + utils)
  ↑
plugins (depend on any combination)
```

플러그인은 타입은 `@quartz-community/types`에서, 유틸리티 함수는 `@quartz-community/utils`에서, 브라우저 유틸리티는 `@quartz-community/runtime`에서 임포트해야 한다. 이 계층화 덕분에 플러그인이 Quartz 코어에 의존하지 않게 된다.

## 플러그인 시스템

페이지 타입(page type)은 어떤 범주의 페이지들이 어떻게 렌더링되는지를 정의한다. `quartz.config.yaml`의 `pageTypes` 배열에서 설정한다.

Quartz v5는 커뮤니티 플러그인 시스템을 도입한다. 플러그인은 독립적인 Git 저장소로, `.quartz/plugins/`에 클론되며 자동 생성되는 인덱스 파일 `.quartz/plugins/index.ts`를 통해 다시 내보내진다(re-export).

### 플러그인 타입

이제 네 가지 플러그인 카테고리가 있다:

- **Transformer**: 콘텐츠를 매핑(map)한다(frontmatter 파싱, 설명 생성, 구문 강조)
- **Filter**: 콘텐츠를 필터링한다(초안 제거, 명시적 게시)
- **Emitter**: 콘텐츠를 리듀스(reduce)한다(RSS, 사이트맵, 별칭 리다이렉트, OG 이미지 생성)
- **Page Type**: 페이지가 렌더링되는 방식을 정의한다. 각 페이지 타입은 특정 종류의 페이지(콘텐츠 노트, 폴더 목록, 태그 목록, 404)를 처리한다. `PageTypeDispatcher` emitter가 콘텐츠에 따라 페이지를 적절한 페이지 타입 플러그인으로 라우팅한다.
- **Bases View**: `bases-page` 플러그인의 데이터베이스형 뷰 시스템을 위한 커스텀 뷰 렌더러. 플러그인은 `ViewRegistry`를 통해 새로운 뷰 타입(예: 타임라인, 칸반)을 등록할 수 있다. 자세한 내용은 [[making plugins#Bases Views|플러그인 만들기#Bases Views]]를 참고하라.

플러그인 타입은 **상호 배타적이지 않다**는 점에 유의하라. 즉, 하나의 플러그인이 transformer이면서 동시에 컴포넌트를 제공할 수도 있고(예: `obsidian-flavored-markdown`), 페이지 타입이면서 커스텀 프레임을 제공할 수도 있다(예: `canvas-page`).

### 플러그인 해석(resolution)

`npx quartz plugin add github:quartz-community/explorer`가 실행되면:

1. 저장소가 `.quartz/plugins/explorer/`에 클론된다
2. 플러그인이 `tsup`으로 빌드된다(각 플러그인의 `tsup.config.ts`에 정의됨)
3. 자동 생성되는 `.quartz/plugins/index.ts`가 설치된 모든 플러그인을 다시 내보낸다
4. 플러그인의 커밋 해시가 `quartz.lock.json`에 기록된다

### 플러그인 CLI 명령어

- `npx quartz plugin add github:quartz-community/<name>` — 커뮤니티 플러그인을 설치한다
- `npx quartz plugin install --latest` — 모든 플러그인을 최신 커밋으로 업데이트한다
- `npx quartz plugin install --clean` — `quartz.lock.json`에 고정된 커밋으로 플러그인을 복원한다(CI/CD에서 사용)
- `npx quartz plugin remove <name>` — 설치된 플러그인을 제거한다

### 플러그인 구조

각 커뮤니티 플러그인 저장소는 다음을 포함한다:

- `src/index.ts` — 플러그인 함수를 내보내는 플러그인 진입점
- `tsup.config.ts` — tsup을 사용하는 빌드 설정
- `package.json` — `@quartz-community/types`와 `@quartz-community/utils`에 대한 의존성을 선언

플러그인 시스템의 아키텍처와 설계는 여기서는 의도적으로 다소 모호하게 남겨두었는데, 왜냐하면 [[making plugins|플러그인 만들기]] 가이드에서 훨씬 더 깊이 있게 설명하기 때문이다.

## 페이지 프레임

페이지 프레임(page frame)은 각 페이지의 내부 HTML 구조를 제어한다. 바깥 껍데기(`<html>`, `<head>`, `<body>`, `#quartz-root`)는 항상 동일하지만([[SPA Routing|SPA 라우팅]]에 필요하다), 프레임은 페이지 내부에서 레이아웃 슬롯이 어떻게 배치되는지를 결정한다.

프레임 시스템은 `quartz/components/frames/`에 있으며 다음으로 구성된다:

- `types.ts` — `PageFrame`과 `PageFrameProps` 인터페이스를 정의
- `DefaultFrame.tsx` — 3열 레이아웃(왼쪽 사이드바, 중앙, 오른쪽 사이드바, 푸터)
- `FullWidthFrame.tsx` — 사이드바 없이 단일 중앙 열
- `MinimalFrame.tsx` — 사이드바와 헤더/beforeBody 없이 콘텐츠와 푸터만
- `registry.ts` — 플러그인이 등록한 프레임을 위한 `FrameRegistry` 싱글턴
- `index.ts` — `resolveFrame()` 함수와 내장 프레임 레지스트리

### 프레임 레지스트리

`FrameRegistry`(`quartz/components/frames/registry.ts`)는 커뮤니티 플러그인이 등록한 프레임을 저장하는 싱글턴이다. `ComponentRegistry`의 설계를 그대로 따른다. 플러그인은 `package.json` 매니페스트의 `"quartz"."frames"` 필드에 프레임을 선언하며, 이는 플러그인 초기화 중에 `quartz/plugins/loader/frameLoader.ts`에 의해 로드된다.

### 프레임 해석

`quartz/components/renderPage.tsx`의 렌더링 파이프라인은 해석된 프레임의 `render()` 함수에 렌더링을 위임한다. 프레임 해석은 `PageTypeDispatcher` emitter(`quartz/plugins/pageTypes/dispatcher.ts`)에서 다음 우선순위에 따라 일어난다:

1. YAML 설정: `layout.byPageType.<name>.template`
2. 플러그인이 등록한 프레임: `FrameRegistry`에서 이름으로 조회
3. 내장 프레임: `builtinFrames` 맵에서 이름으로 조회
4. 폴백: `"default"`

활성 프레임 이름은 `.page` 요소의 `data-frame` 속성으로 설정되며, 이를 통해 `quartz/styles/base.scss`에서 프레임별 CSS 오버라이드가 가능해진다.

### 플러그인이 제공하는 프레임

커뮤니티 플러그인은 `./frames` 서브패스에서 프레임을 내보내고 플러그인 매니페스트에 이를 선언함으로써 자체 프레임을 제공할 수 있다. 예를 들어 `canvas-page` 플러그인은 전체 화면 레이아웃과 토글 가능한 사이드바를 갖춘 `"canvas"` 프레임을 제공한다. 구현 세부 사항은 [[making plugins#Providing Custom Frames|플러그인 만들기#커스텀 프레임 제공]]을 참고하라.

사용자 대상 문서는 [[layout#Page Frames|레이아웃#페이지 프레임]]을, 페이지 타입 플러그인에서 프레임을 설정하는 방법은 [[making plugins#Page Types|플러그인 만들기#페이지 타입]]을 참고하라.
