---
title: "GitHub Dependabot 의존성 일괄 업데이트 후 빌드 실패 (js-yaml 5, TypeScript 7)"
date: 2026-07-23
tags:
  - troubleshoot
  - dependencies
---

## 증상

Dependabot PR(#33, `production-dependencies` 그룹 20개 일괄 업데이트) 머지 후 `npm run preview:secure` / `npm run build` 실행 시 빌드가 즉시 실패했다.

```
SyntaxError: The requested module 'js-yaml' does not provide an export named 'default'
    at #asyncInstantiate (node:internal/modules/esm/module_job:319:21)
    ...
    at async build (file:///.../quartz/cli/handlers.js:339:38)
```

에러 앞에 수천 줄의 트랜스파일된 번들 코드(`transpiled-build.mjs`)가 함께 출력되어 원인 파악이 어려웠다. 실제 에러 메시지는 **출력 맨 끝**에 있다.

## 원인

### 1. js-yaml 4 → 5 major 업데이트 (빌드 실패의 직접 원인)

js-yaml 5.x는 ESM **named export만** 제공하고 default export를 제거했다.
`quartz/plugins/transformers/frontmatter.ts`가 default import를 사용하고 있었다:
esbuild는 아래 코드를 그대로 트랜스파일하므로 타입 체크가 아닌 **Runtime(Node ESM 로더)** 시점에 터진다.

```ts
import yaml from "js-yaml" // v5에서는 런타임 에러를 발생시킴
```


### 2. TypeScript 6 → 7 major 업데이트 (타입 체크 불능)

TypeScript 7은 `moduleResolution: "node"`(node10) 옵션을 **완전히 제거**했다.
`npx tsc --noEmit`이 코드를 보기도 전에 설정 에러로 종료됐다:

```
tsconfig.json(7,25): error TS5108: Option 'moduleResolution=node10' has been removed.
```

## 해결

### js-yaml — named import로 변경

`quartz/plugins/transformers/frontmatter.ts`:

```diff
-import yaml from "js-yaml"
+import { load as yamlLoad, JSON_SCHEMA } from "js-yaml"

-yaml: (s) => yaml.load(s, { schema: yaml.JSON_SCHEMA }) as object,
+yaml: (s) => yamlLoad(s, { schema: JSON_SCHEMA }) as object,
```

`load(input, { schema })` 시그니처는 v4와 호환되므로 import 형태만 바꾸면 된다.
(v5의 타입 선언 `node_modules/js-yaml/dist/js-yaml.d.ts`에서 확인)

### TypeScript — moduleResolution 교체

`tsconfig.json`:

```diff
-    "moduleResolution": "node",
+    "moduleResolution": "bundler",
```

Quartz는 esbuild로 번들링하므로 `"bundler"`가 의미상으로도 맞다.

### 검증

```bash
npm run build:secure   # 17개 파일 빌드 + daily/ 암호화 정상
npm run preview:secure # 8080 포트 서빙 + StatiCrypt 게이트 정상
npx tsc --noEmit       # 설정 에러 해소 (기존 코드의 타입 에러 일부 잔존)
```

## 재발 방지를 위해

- **그룹화된 dependabot PR은 major 범프를 숨긴다.**
  -  20개 업데이트 중 js-yaml 4→5, TypeScript 6→7 두 개가 breaking이었다.
  -  머지 전에 PR 본문에서 **major 범프(ex. 4.x -> 5.x) 목록을 먼저 확인**하고 해당 섹션에서 "Breaking Changes"를 확인할 것 
  - 시그니처가 호환되면 import만 수정, 아니면 마이그레이션 가이드(GitHub Releases의 해당 major 릴리스 노트)를 참조
    
- **CI가 실제 빌드를 돌리지 않으면 이런 에러를 못 잡는다.**
  -  `npm run check`(tsc + prettier)는 esbuild 런타임 에러를 잡지 못한다. CI에 `npm run build` 스텝 추가를 고려할 것.
  - 빌드 스텝을 추가함으로서 dependabot PR 머지 전에 CI에서 에러를 발견할 수 있다.

- **혹은 major는 별도 PR로 분리**
  - 문제는 현재 dependabot.yml이 모든 npm 업데이트를 패턴 "*" 하나로 묶어 주간 PR 1개로 만든다는 점.
  -  20개 업데이트에 major 2개가 섞여 있으면 눈에 안 띔.
  ```yaml
  groups:
  production-dependencies:
    applies-to: "version-updates"
    patterns: ["*"]
    update-types: ["minor", "patch"]   # major는 그룹에서 제외 → 개별 PR로 분리
  ```

- **lockfile(package-lock.json)을 커밋해야 하는 이유이기도 하다.**
  -  의존성 변경이 리뷰 가능한 diff로 남았기 때문에 원인 커밋(`bd5c0ae`)을 바로 특정할 수 있었다.

- 빌드 에러 출력이 번들 코드로 도배될 때는 **출력의 마지막 부분**에서 실제 스택트레이스를 찾을 것.
