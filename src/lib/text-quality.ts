/** Reject decoded binary/compressed payloads and severely damaged Unicode. */
export function isLikelyCorruptedText(value: string): boolean {
  if (!value) return false;
  const replacementCount = (value.match(/\uFFFD/g) ?? []).length;
  const controlCount = (value.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;
  return replacementCount >= 2 || replacementCount / value.length > 0.005 || controlCount / value.length > 0.01;
}

export function hasUsableArticleText(article: { headline?: string; body?: string[] }): boolean {
  return !isLikelyCorruptedText(`${article.headline ?? ""} ${(article.body ?? []).join(" ")}`);
}

