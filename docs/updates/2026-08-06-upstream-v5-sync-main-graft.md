---
title: "upstream/v5 동기화 (레이아웃 슬롯 통합) 및 main 브랜치 v5 전환"
date: 2026-08-06
tags:
  - updates
  - upstream-sync
---

## 요약

v5-migration 브랜치에 upstream/v5 최신 13커밋을 병합하고, PR #42로 main을
Quartz 5 기준으로 전환했다. 이 시점부터 main이 작업 기준 브랜치다.

## upstream 변경 내용 (13커밋)

### 1. 레이아웃 슬롯 아키텍처 통합 — `a121f2d`

- `footer` 슬롯이 단일 컴포넌트에서 **배열**로 변경 (`header`, `left`, `right` 등
  다른 슬롯과 일관성 확보). 내장 프레임 3종(Default/FullWidth/Minimal)이 footer
  배열을 순회하도록 수정됨.
- `header`/`footer`가 **정식 layout position**이 됨 — 플러그인이 YAML에서
  `layout: { position: header }` 선언 가능.
- **`defaultPosition` 폴백** 추가 — config에서 layout 생략 시 플러그인 매니페스트의
  `defaultPosition` 사용. 로컬 section-tabs 매니페스트가 이미 선언하고 있어 수혜 대상.
- `quartz.config.yaml` 형식은 **변경 없음**. 마이그레이션이 필요한 건 `quartz.ts`
  layout 오버라이드 또는 커스텀 프레임 사용 시뿐 — 이 포크는 둘 다 해당 없음.

### 2. 코드 현대화 + 테스트 추가 — `508f73a`, `41864a0`

- config-loader / registry / dispatcher의 CJS `require` → 정적 import 전환.
- `createRequire` → `import.meta.resolve` 전환 (config-loader, gitLoader).
- 테스트 신규: config-loader(300줄), registry(140줄), frames, dispatcher.
  로컬 플러그인을 로더에 태우는 이 포크 입장에서 회귀 안전망.

### 3. 의존성·잡무 — 나머지 커밋

- `@quartz-community/types` 0.2.1 → 0.3.0, `@quartz-themes/core` → 1.1.0,
  커뮤니티 플러그인 최신 릴리스 락파일 반영.
- 포매팅 정리, `.turbo/` gitignore 추가 (이 항목이 로컬 `.gitignore`와 충돌 →
  양쪽 유지로 해소).

## 포크 측 작업

- **병합 충돌 2건**: `.gitignore`(양쪽 유지), `package-lock.json`(upstream 채택 후
  `npm install` 재생성).
- **core 패치 유지 확인**: `quartz/util/glob.ts`의 `realpathSync` (content 심볼릭
  링크 대응) — 병합 후에도 유일한 core 수정으로 유지.
- **main 히스토리 접합**: main(v4, filter-repo 재작성)과 v5-migration(upstream/v5
  분기)은 공통 조상이 없어 GitHub이 PR을 거부 →
  `git merge -s ours --allow-unrelated-histories main`으로 트리는 v5 그대로 두고
  히스토리만 연결. v4 커밋 40개는 병합 커밋의 둘째 부모로 보존됨.
- v4 전용 파일(quartz.config.ts, StatiCrypt 일체, sections.config.json)은 v5
  구성으로 대체되어 제외. `docs/troubleshoot/`와 `.claude/CLAUDE.md`는 이관
  (CLAUDE.md는 v5 기준으로 갱신).
- **PR #42** 생성 → CI(check.yaml) 통과 확인 → main을 v5-migration으로
  fast-forward 후 push (GitHub이 PR을 merged로 자동 처리).

## 검증

- 빌드: 20개 노트 파싱, 93개 파일 emit, 설정 수정 없이 통과.
- 유출 검사: 비공개 콘텐츠 평문 0건, sitemap/RSS 신규 도메인(yoonsooc.github.io) 반영.

## 후속 아이디어

- 상단 헤더 바를 `position: left` + CSS 우회 대신 신설된 `position: header`
  슬롯으로 이전하면 custom.scss의 레이아웃 변형 코드를 줄일 수 있다.
