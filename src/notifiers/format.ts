import type { ScoredArticle } from "../lib/alert-scorer";

export interface FormattedAlert {
  plain: string;
  markdown: string;
  subject: string;
  emoji: string;
}

export function formatAlert(sa: ScoredArticle, appUrl = ""): FormattedAlert {
  const { article, score } = sa;
  const emoji = score >= 90 ? "🚨" : score >= 80 ? "⚠️" : "📌";
  const section = article.section.toUpperCase();

  // Use article's direct source URL first, fall back to app URL
  const articleLink = article.sourceUrl && article.sourceUrl !== "#" ? article.sourceUrl : appUrl;
  const appLink = appUrl ? appUrl : "";

  const subject = `${emoji} [${section}] ${article.headline.slice(0, 80)}`;

  const plain = [
    `${emoji} GLOBAL REPORT ALERT`,
    `[${section}] ${article.category} | ${article.region} | Score: ${score}/100`,
    article.headline,
    article.body[0]?.slice(0, 200) + (article.body[0]?.length > 200 ? "…" : ""),
    `Source: ${article.source}`,
    articleLink ? `Article: ${articleLink}` : "",
    appLink && articleLink !== appLink ? `App: ${appLink}` : "",
  ].filter(Boolean).join("\n");

  const markdown = [
    `${emoji} *GLOBAL REPORT ALERT*`,
    `\`[${section}]\` ${article.category} | ${article.region} | Score: *${score}/100*`,
    `*${article.headline}*`,
    article.body[0]?.slice(0, 300) + (article.body[0]?.length > 300 ? "…" : ""),
    `_Source: ${article.source}_`,
    articleLink ? `[📄 Read article](${articleLink})` : "",
    appLink && articleLink !== appLink ? `[🌐 Open app](${appLink})` : "",
  ].filter(Boolean).join("\n\n");

  return { plain, markdown, subject, emoji };
}

export function formatDigest(articles: ScoredArticle[], appUrl = ""): FormattedAlert {
  const top = articles.slice(0, 5);
  const emoji = "📋";
  const subject = `${emoji} Global Report — ${top.length} alerts`;

  const plain = [
    `${emoji} GLOBAL REPORT — ${top.length} ALERT${top.length > 1 ? "S" : ""}`,
    ...top.map((sa, i) => {
      const link = sa.article.sourceUrl && sa.article.sourceUrl !== "#" ? `\n   ${sa.article.sourceUrl}` : "";
      return `${i + 1}. [${sa.score}] ${sa.article.headline.slice(0, 90)}${link}`;
    }),
    appUrl ? `Full briefing: ${appUrl}` : "",
  ].filter(Boolean).join("\n");

  const markdown = [
    `${emoji} *GLOBAL REPORT — ${top.length} ALERT${top.length > 1 ? "S" : ""}*`,
    ...top.map((sa, i) => {
      const link = sa.article.sourceUrl && sa.article.sourceUrl !== "#"
        ? ` — [article](${sa.article.sourceUrl})`
        : "";
      return `*${i + 1}.* [${sa.score}/100] ${sa.article.headline.slice(0, 90)}${link}`;
    }),
    appUrl ? `[🌐 Full briefing](${appUrl})` : "",
  ].filter(Boolean).join("\n");

  return { plain, markdown, subject, emoji };
}
