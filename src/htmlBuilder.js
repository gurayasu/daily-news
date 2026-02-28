// ============================================================
// htmlBuilder.js - HTMLメール生成モジュール
// GASの Code.gs から buildHtmlEmail を移植
// ============================================================

/**
 * MarkdownテキストをHTMLメール形式に変換する
 * @param {string} markdownText - Markdown形式のテキスト
 * @param {string} today - 今日の日付文字列（表示用）
 * @returns {string} HTML文字列
 */
export function buildHtmlEmail(markdownText, today) {
  // MarkdownをシンプルなHTMLに変換
  let html = markdownText
    // h2 見出し
    .replace(
      /^## (.+)$/gm,
      '<h2 style="color:#1a3a5c;border-left:4px solid #2563eb;padding-left:12px;margin-top:28px;font-size:17px;">$1</h2>',
    )
    // 太字
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#374151;">$1</strong>')
    // 水平線
    .replace(
      /^---$/gm,
      '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">',
    )
    // URLリンク化
    .replace(
      /\[?(https?:\/\/[^\s\]]+)\]?/g,
      '<a href="$1" style="color:#2563eb;word-break:break-all;">$1</a>',
    )
    // 改行
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${today} ニュースダイジェスト</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN',sans-serif;">
  <div style="max-width:680px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">

    <!-- ヘッダー -->
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 36px;">
      <div style="font-size:12px;color:#93c5fd;letter-spacing:2px;margin-bottom:8px;">DAILY NEWS DIGEST</div>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">📰 日刊ニュースダイジェスト</h1>
      <div style="color:#bfdbfe;margin-top:8px;font-size:14px;">${today}</div>
    </div>

    <!-- 本文 -->
    <div style="padding:28px 36px;color:#1f2937;line-height:1.8;font-size:14px;">
      ${html}
    </div>

    <!-- フッター -->
    <div style="background:#f9fafb;padding:20px 36px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
      このメールはGitHub ActionsとGemini AIによって自動生成されました。<br>
      情報源はNHK、BBC News Japan、毎日新聞、Al Jazeera、Deutsche Welle、France 24などの報道機関です。<br>
      <span style="color:#d1d5db;">配信停止はGitHub ActionsのScheduleトリガーを無効にしてください。</span>
    </div>

  </div>
</body>
</html>`;
}
