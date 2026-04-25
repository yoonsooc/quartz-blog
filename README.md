# NKNB's Blog

[Quartz v4](https://quartz.jzhao.xyz/) 기반의 개인 블로그. Obsidian vault에 기록한 노트 중 `publish: true` 프론트매터가 달린 글만 선별적으로 정적 사이트로 배포한다.

## Stack

- **SSG**: Quartz 4 (Preact + esbuild + unified/remark/rehype)
- **Runtime**: Node.js ≥ 22
- **Source**: Obsidian vault (symlink)
- **Content filter**: `ExplicitPublish` — `publish: true`만 노출
- **Analytics**: Plausible

## 로컬 실행

```bash
# 1. 의존성 설치
npm install

# 2. Dev 서버 (hot reload)
npx quartz build --serve
# → http://localhost:8080

# 포트를 바꾸려면
npx quartz build --serve --port 3000

# 단발성 빌드만 (public/ 에 결과 출력)
npx quartz build
```

자주 쓰는 보조 스크립트:

```bash
npm run check     # tsc --noEmit + prettier 체크
npm run format    # prettier 자동 포맷
```

## Obsidian 연동

원본 노트는 Obsidian vault에 남기고, `content/` 디렉토리를 vault 내 특정 폴더로 **심볼릭 링크**해서 사용한다. 이렇게 하면 Quartz 시스템 파일과 노트가 물리적으로 분리된다.

```bash
# content 디렉토리가 이미 있다면 먼저 제거/백업
rm -rf content

# Obsidian vault 안의 게시 대상 폴더를 symlink
ln -s /path/to/ObsidianVault/YourFolder content

# 확인
ls -la content
# → content -> /Users/you/Documents/.../ObsidianVault/YourFolder
```

### 게시 규칙

노트 프론트매터에 `publish: true`가 있는 파일만 빌드에 포함된다. 필터는 [`quartz.config.ts`](./quartz.config.ts)의 `Plugin.ExplicitPublish()` 가 담당.

```yaml
---
title: 포스트 제목
publish: true
tags:
  - engineering
---
```

### 무시되는 경로

`ignorePatterns: ["private", "templates", ".obsidian"]` — Obsidian 설정/템플릿 폴더는 자동 제외.

### 위키링크 & Obsidian 문법

`ObsidianFlavoredMarkdown` 플러그인이 위키링크 `[[...]]`, 콜아웃, 임베드 등을 처리한다. 별도 조치 없이 그대로 작동.

### Tip: 빌드 경고

- `Warning: couldn't find git repository for content` — symlink 대상이 Obsidian vault(보통 별도 git 저장소)이라 정상. `lastmod` 는 frontmatter/filesystem fallback으로 동작.
- `LaTeX-incompatible input ... unicodeTextInMathMode` — `$` 기호를 달러로 쓴 경우 KaTeX가 수식으로 파싱해서 뜨는 경고. 본문 달러는 `\$` 로 escape 하거나 코드블록으로 감쌀 것.

## 커스터마이징 구성

이 레포의 주요 커스텀 포인트:

| 위치 | 내용 |
|---|---|
| `quartz.config.ts` | 사이트 제목, 라이트/다크 색상 팔레트 (secondary `#d62839`), Inter + JetBrains Mono |
| `quartz.layout.ts` | 메인 배너에 **Hero** 컴포넌트 추가, 우측 사이드바 비움 |
| `quartz/components/Hero.tsx` | 홈 상단 커스텀 히어로 배너 |
| `quartz/components/pages/DateArchiveContent.tsx` | 날짜별 아카이브 페이지 |
| `quartz/plugins/emitters/dateArchive.tsx` | `/date/YYYY/...` 경로 생성 emitter |
| `quartz/static/bg-city.png` | Hero 배경 이미지 |
| `quartz/styles/custom.scss` | 전역 스타일 오버라이드 |

컴포넌트를 추가/제거했다면 `quartz/components/index.ts` 에서 export 를 확인할 것.

## 배포

### GitHub Pages (정적 호스팅)

```bash
npx quartz build
# public/ 디렉토리 전체를 gh-pages 브랜치로 푸시
npx quartz sync --no-pull
```

`quartz.config.ts` 의 `baseUrl` 을 실제 배포 도메인으로 변경해야 링크가 깨지지 않는다.

### GitHub Actions

`.github/workflows/ci.yaml` 은 업스트림 Quartz 의 CI (타입체크/포맷 검사) 이다. 직접 배포 파이프라인을 붙이려면 별도 워크플로우를 추가한다. 예시 — GitHub Pages 자동 배포:

```yaml
# .github/workflows/deploy.yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx quartz build
      - uses: actions/upload-pages-artifact@v3
        with: { path: public }
      - uses: actions/deploy-pages@v4
```

> Obsidian vault 가 private 이라면 `content/` 는 CI에서 접근할 수 없다. 배포용으로는 ① vault 자체를 private repo 로 만들어 CI에서 checkout 하거나, ② 로컬에서 `npx quartz build` 후 `public/` 만 배포 브랜치로 푸시하는 방식을 쓴다.

## 디렉토리 구조

```
quartz-blog/
├── content/              # → Obsidian vault (symlink)
├── quartz/
│   ├── components/       # Preact 컴포넌트 (Hero, PageTitle, Footer ...)
│   ├── plugins/
│   │   ├── transformers/ # AST 변환 (frontmatter, lastmod ...)
│   │   └── emitters/     # HTML 출력 (contentPage, dateArchive ...)
│   ├── styles/           # SCSS 전역 스타일
│   └── static/           # 이미지, 폰트 등 정적 자산
├── public/               # 빌드 산출물 (gitignore 대상)
├── quartz.config.ts      # 사이트/테마/플러그인 설정
└── quartz.layout.ts      # 페이지 레이아웃 (Hero, 사이드바 등)
```

## 참고

- Quartz 공식 문서: https://quartz.jzhao.xyz/
- 업스트림: https://github.com/jackyzha0/quartz
