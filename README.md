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

원본 노트는 Obsidian vault에 남기고, `content/` 디렉토리를 vault 내 **발행 전용 폴더(`_blog/`)** 로 symlink 해서 사용한다. PARA 같은 vault 내부 정리 구조가 공개 URL 에 노출되지 않도록, 발행할 글은 vault 안의 별도 영역에 모아둔다.

```bash
# vault 안에 발행 전용 폴더 생성
mkdir -p /path/to/ObsidianVault/_blog/posts

# content 디렉토리 재연결
rm -rf content
ln -s /path/to/ObsidianVault/_blog content

# 확인
ls -la content
# → content -> /.../ObsidianVault/_blog
```

이 레포의 실제 연결: `content -> ~/Documents/gdv/Obsidian/Yersona/_blog`

### 게시 규칙

`_blog/` 안의 노트 중 프론트매터에 `publish: true` 가 있는 파일만 빌드에 포함된다. 필터는 [`quartz.config.ts`](./quartz.config.ts)의 `Plugin.ExplicitPublish()` 가 담당.

```yaml
---
title: 포스트 제목
publish: true
tags:
  - engineering
---
```

URL 슬러그는 `_blog/` 하위 경로 기준이다. 예: `_blog/posts/hello.md` → `/posts/hello/`. vault의 PARA 구조(`100. Inbox/`, `300. Resource/` 등)는 사이트에 노출되지 않는다.

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

소스(이 레포, private)와 빌드 산출물(`nkinba/nkinba.github.io`, public)을 분리한다. Obsidian vault 가 로컬 symlink 로만 들어오므로 GitHub Actions 에서는 빌드가 불가능 — 로컬에서 빌드하고 결과만 푸시하는 수동 배포 방식을 쓴다.

```
quartz-blog (private)  ──[npx quartz build]──>  public/  ──[scripts/deploy.sh]──>  nkinba.github.io (public) → GitHub Pages
```

### 배포 실행

```bash
./scripts/deploy.sh
```

스크립트가 하는 일:
1. `npx quartz build` 실행 → `public/` 생성
2. `~/.cache/quartz-blog-deploy` 에 `nkinba/nkinba.github.io` 를 clone (최초 1회) 또는 갱신
3. `public/` 내용을 deploy clone 으로 `rsync --delete` (기존 파일 정리)
4. `.nojekyll` 추가 (Jekyll 처리 비활성화)
5. 타임스탬프 + 소스 커밋 SHA 가 들어간 메시지로 commit & push

배포 위치를 바꾸려면 환경변수 `DEPLOY_WORK_DIR` 로 작업 디렉토리를 지정할 수 있다.

### 사이트

- 라이브: https://nkinba.github.io/
- 빌드 출력 레포: https://github.com/nkinba/nkinba.github.io

### 커스텀 도메인

1. `nkinba.github.io` 레포 루트에 `CNAME` 파일 생성 (도메인만 한 줄)
2. DNS 에 GitHub Pages IP 또는 `nkinba.github.io` CNAME 등록
3. `quartz.config.ts` 의 `baseUrl` 을 새 도메인으로 변경 후 재배포

`scripts/deploy.sh` 의 housekeeping 섹션에 `echo "your.domain" > "$WORK_DIR/CNAME"` 한 줄을 추가하면 매 배포마다 CNAME 이 유지된다.

## 디렉토리 구조

```
quartz-blog/
├── content/              # → Obsidian vault/_blog (symlink)
├── scripts/
│   └── deploy.sh         # 빌드 + nkinba.github.io 푸시
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
