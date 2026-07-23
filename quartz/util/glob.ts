import fs from "fs"
import path from "path"
import { FilePath } from "./path"
import { globby } from "globby"

export function toPosixPath(fp: string): string {
  return fp.split(path.sep).join("/")
}

export async function glob(
  pattern: string,
  cwd: string,
  ignorePatterns: string[],
): Promise<FilePath[]> {
  // content가 심볼릭 링크일 때 globby의 gitignore 탐색이 링크의 어휘적 경로 기준으로
  // 저장소 루트 .gitignore(content 항목)까지 거슬러 올라가 모든 파일을 무시하므로,
  // 실제 경로로 해석해 링크 대상 기준으로 동작하게 한다.
  const fps = (
    await globby(pattern, {
      cwd: fs.realpathSync(cwd),
      ignore: ignorePatterns,
      gitignore: true,
    })
  ).map(toPosixPath)
  return fps as FilePath[]
}
