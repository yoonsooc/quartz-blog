// 조회 결과를 마크다운으로 내보낼 때 쓰는 공용 조각.

// 데이터 값(frontmatter에서 온 문자열)을 표 셀에 넣을 때: 마크다운·위키링크·수식으로
// 해석될 수 있는 문자를 모두 이스케이프한다.
export function escapeCell(text) {
  return String(text)
    .replace(/[\\|*_[\]<>`~$]/g, "\\$&")
    .replace(/\r?\n/g, "<br>")
}

// 사용자가 직접 쓴 마크다운(dv.table의 셀 등)을 표 셀에 넣을 때: 서식은 살리고
// 표 구조를 깨는 문자만 막는다.
export function pipeSafe(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>")
}

// headers와 rows는 이미 셀용으로 이스케이프된 문자열이어야 한다
export function markdownTable(headers, rows) {
  const line = (cells) => `| ${cells.join(" | ")} |`
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n")
}

export function warningCallout(title, message) {
  return `> [!warning] ${title}\n> ${String(message).replace(/\r?\n/g, " ")}`
}
