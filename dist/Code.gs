// ============================================================
// Code.gs - メインスクリプト
// Google Apps Script にこのファイルとConfig.gsを貼り付けて使用する
// ============================================================

/**
 * メインエントリーポイント
 * トリガーから毎朝7時に呼び出される
 */
function sendDailyNewsDigest() {
  try {
    Logger.log(
      "ニュースダイジェスト生成開始: " + new Date().toLocaleString("ja-JP"),
    );

    // 1. 全RSSフィードから記事を収集
    const allArticles = collectAllArticles();
    Logger.log(`収集した記事数: ${allArticles.length}`);

    if (allArticles.length === 0) {
      Logger.log("記事が0件のため処理を中止します");
      return;
    }

    // 2. Gemini APIでニュース整理・要約
    const digest = generateDigestWithGemini(allArticles);

    // 3. HTMLメールを作成して送信
    sendNewsEmail(digest);

    Logger.log("ニュースダイジェスト送信完了");
  } catch (error) {
    Logger.log("エラーが発生しました: " + error.toString());
    // エラー時は管理者に通知
    GmailApp.sendEmail(
      CONFIG.EMAIL_RECIPIENTS[0],
      "【エラー】ニュースダイジェスト生成失敗",
      "エラー内容:\n" +
        error.toString() +
        "\n\nスタックトレース:\n" +
        error.stack,
    );
  }
}

// ============================================================
// RSS収集
// ============================================================

/**
 * 全RSSフィードを巡回して記事を収集する
 * @returns {Array<Object>} 記事オブジェクトの配列
 */
function collectAllArticles() {
  const articles = [];
  // 直近24時間のみ対象とする
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // 実行開始時刻を記録（GASは最大6分制限のため4分でフィード取得を打ち切る）
  const startTime = Date.now();
  const MAX_FETCH_MS = 4 * 60 * 1000; // 4分

  for (const feed of CONFIG.RSS_FEEDS) {
    // 経過時間チェック：4分を超えたらフィード取得を中断してGemini処理に進む
    if (Date.now() - startTime > MAX_FETCH_MS) {
      Logger.log(`⏱ 実行時間4分超過のため残りのフィード取得をスキップします`);
      break;
    }

    try {
      const feedArticles = fetchRssFeed(feed, cutoffTime);
      articles.push(...feedArticles);
      Logger.log(`${feed.name}: ${feedArticles.length}件取得`);
    } catch (error) {
      Logger.log(`${feed.name} の取得に失敗: ${error.toString()}`);
    }
  }

  return articles;
}

/**
 * 単一のRSSフィードを取得・パースして記事配列を返す
 * @param {Object} feed - フィード設定オブジェクト
 * @param {Date} cutoffTime - これより古い記事は除外する基準日時
 * @returns {Array<Object>} 記事オブジェクトの配列
 */
function fetchRssFeed(feed, cutoffTime) {
  const response = UrlFetchApp.fetch(feed.url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; GoogleAppsScript/1.0)",
    },
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`HTTPエラー: ${response.getResponseCode()}`);
  }

  const xmlText = response.getContentText("UTF-8");
  const parsed = parseRssXml(xmlText, feed, cutoffTime);
  return parsed;
}

/**
 * RSS/AtomのXMLをパースして記事配列を返す
 * @param {string} xmlText - XML文字列
 * @param {Object} feed - フィード設定
 * @param {Date} cutoffTime - 除外基準日時
 * @returns {Array<Object>} 記事配列
 */
function parseRssXml(xmlText, feed, cutoffTime) {
  const articles = [];

  try {
    const document = XmlService.parse(xmlText);
    const root = document.getRootElement();
    const ns = root.getNamespace();

    // RSS 2.0 と Atom の両方に対応
    let items = [];

    if (root.getName() === "rss") {
      // RSS 2.0 形式
      const channel = root.getChild("channel");
      if (channel) {
        items = channel.getChildren("item");
      }
    } else if (root.getName() === "feed") {
      // Atom 形式
      const atomNs = XmlService.getNamespace("http://www.w3.org/2005/Atom");
      items = root.getChildren("entry", atomNs);
      if (items.length === 0) {
        items = root.getChildren("entry");
      }
    } else {
      // RDF/RSS 1.0 形式
      const rdfNs = XmlService.getNamespace(
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      );
      items = root.getChildren(
        "item",
        XmlService.getNamespace("http://purl.org/rss/1.0/"),
      );
      if (items.length === 0) {
        items = root.getChildren("item");
      }
    }

    let count = 0;

    for (const item of items) {
      if (count >= CONFIG.MAX_ARTICLES_PER_FEED) break;

      const title = getXmlText(item, ["title"]);
      const link = getXmlText(item, ["link", "id", "guid"]);
      const description = getXmlText(item, [
        "description",
        "summary",
        "content",
      ]);
      const pubDateStr = getXmlText(item, [
        "pubDate",
        "published",
        "updated",
        "dc:date",
      ]);

      if (!title || !link) continue;

      // 日時チェック（取得できない場合は直近24時間内とみなして含める）
      if (pubDateStr) {
        const pubDate = new Date(pubDateStr);
        if (!isNaN(pubDate.getTime()) && pubDate < cutoffTime) continue;
      }

      // 説明文をテキスト化（HTMLタグを除去）送信トークン削減のため300字に制限
      const cleanDescription = stripHtml(description || "").substring(0, 300);

      articles.push({
        source: feed.name,
        type: feed.type,
        title: title.trim(),
        link: link.trim(),
        description: cleanDescription.trim(),
        publishedAt: pubDateStr || "不明",
      });

      count++;
    }
  } catch (parseError) {
    Logger.log(`XMLパースエラー (${feed.name}): ${parseError.toString()}`);
  }

  return articles;
}

/**
 * XML要素から指定した子要素名の最初のテキストを返す
 * @param {XmlElement} element - 親要素
 * @param {Array<string>} tagNames - 試すタグ名リスト
 * @returns {string} テキスト値
 */
function getXmlText(element, tagNames) {
  for (const tagName of tagNames) {
    try {
      // コロンを含む名前空間付きタグへの対応
      if (tagName.includes(":")) {
        const parts = tagName.split(":");
        const ns = element.getNamespace(parts[0]);
        if (ns) {
          const child = element.getChild(parts[1], ns);
          if (child) return child.getText();
        }
      } else {
        const child = element.getChild(tagName);
        if (child) return child.getText();
      }
    } catch (e) {
      // 無視して次のタグを試す
    }
  }
  return "";
}

/**
 * 文字列からHTMLタグを除去する
 * @param {string} html - HTML文字列
 * @returns {string} プレーンテキスト
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// Gemini API による要約・整理
// ============================================================

/**
 * 収集した記事をGemini APIに送って整形されたダイジェストを生成する
 * @param {Array<Object>} articles - 記事配列
 * @returns {string} ダイジェスト本文（Markdown形式）
 */
function generateDigestWithGemini(articles) {
  // 記事一覧をテキスト化（トークン節約のため要点のみ）
  const articleListText = articles
    .map(
      (a, i) =>
        `[${i + 1}] ソース:${a.source}（${a.type}）\n` +
        `タイトル: ${a.title}\n` +
        `概要: ${a.description}\n` +
        `URL: ${a.link}`,
    )
    .join("\n\n");

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const prompt = `あなたはニュースリサーチ専門のAIです。

以下の記事リストを分析し、${today}の「日本の政治および国際情勢」に関する最も重要なニュース約10件を選定・整理してください。

【対象テーマ】
・日本の政治（政府方針、法改正、国会審議、政党動向、外交・安全保障など）
・国際情勢（米中関係、欧州情勢、ウクライナ情勢、中東、アジア太平洋、安全保障、国際機関の動向など）
・上記に直接影響を与える経済・安全保障ニュースも含める
・上記とは直接関係ない各国の動向や出来事も含める

【重複回避ルール】
・同一テーマの記事が多数ある場合は、最も情報量・分析価値の高いものを1件のみ選ぶ。

【広告・PR排除ルール】
・企業PR・タイアップ・商品宣伝・意見広告は除外すること。

【重要度判断基準】
・政策・制度変更の有無、国際関係への影響度、安全保障リスク、市場・社会への波及可能性、新規性・速報性

【出力形式（日本語のみ）】
各ニュースについて以下の形式で出力すること：

## 【No.X】記事タイトル（ソース名）

**📋 要約**
250〜300字で要約

**🔗 参考URL**: [URLをそのまま記載]

---

【収集した記事リスト】
${articleListText}

※必ず約10件選定し、日本語のみで出力すること。英語記事も日本語で要約して含めること。`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  };

  const response = UrlFetchApp.fetch(apiUrl, {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(
      `Gemini APIエラー (${response.getResponseCode()}): ${response.getContentText()}`,
    );
  }

  const result = JSON.parse(response.getContentText());

  if (
    result.candidates &&
    result.candidates[0] &&
    result.candidates[0].content
  ) {
    const parts = result.candidates[0].content.parts || [];

    // gemini-2.5-flashなどのThinking Modelはpartsに思考パート(thought:true)と
    // 回答パートが混在するため、thought:trueでないパートのtextを取得する
    const answerPart = parts.find((p) => !p.thought && p.text);

    if (answerPart) {
      return answerPart.text;
    }

    // フォールバック：全パートのtextを結合して返す
    const combined = parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join("\n");

    if (combined) return combined;

    Logger.log("Gemini応答の構造: " + JSON.stringify(result).substring(0, 500));
    throw new Error("Gemini APIの応答からテキストを取得できませんでした");
  }

  throw new Error("Gemini APIからの応答が不正です: " + JSON.stringify(result));
}

// ============================================================
// メール送信
// ============================================================

/**
 * HTMLメールを組み立てて送信する
 * @param {string} digestText - Gemini APIが生成したMarkdown形式のダイジェスト
 */
function sendNewsEmail(digestText) {
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const subject = `${CONFIG.EMAIL_SUBJECT_PREFIX}${today}`;
  const htmlBody = buildHtmlEmail(digestText, today);

  for (const recipient of CONFIG.EMAIL_RECIPIENTS) {
    GmailApp.sendEmail(recipient, subject, digestText, {
      htmlBody: htmlBody,
      name: "日刊ニュースダイジェスト",
    });
    Logger.log(`メール送信完了: ${recipient}`);
  }
}

/**
 * MarkdownテキストをHTMLメール形式に変換する
 * @param {string} markdownText - Markdown形式のテキスト
 * @param {string} today - 今日の日付文字列
 * @returns {string} HTML文字列
 */
function buildHtmlEmail(markdownText, today) {
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
      このメールはGoogle Apps ScriptとGemini AIによって自動生成されました。<br>
      情報源はNHK、BBC News Japan、毎日新聞、産経新聞、Al Jazeera、Deutsche Welle、France 24などの報道機関です。<br>
      <span style="color:#d1d5db;">配信停止はスクリプトのトリガーを無効化してください。</span>
    </div>

  </div>
</body>
</html>`;
}

// ============================================================
// ユーティリティ・デバッグ用関数
// ============================================================

/**
 * 手動テスト用：メール送信せずにダイジェストをログに出力する
 * GASエディタから手動で実行して動作確認に使用する
 */
function testDigestOnly() {
  Logger.log("=== テスト実行開始（メール送信なし）===");
  const articles = collectAllArticles();
  Logger.log(`収集記事数: ${articles.length}`);

  if (articles.length === 0) {
    Logger.log(
      "記事が取得できませんでした。RSSフィードのURLを確認してください。",
    );
    return;
  }

  const digest = generateDigestWithGemini(articles);
  Logger.log("=== Gemini生成結果 ===");
  Logger.log(digest);
}

/**
 * RSSフィードテスト用：各フィードから何件取得できるか確認する
 */
function testRssFeeds() {
  Logger.log("=== RSSフィードテスト ===");
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const feed of CONFIG.RSS_FEEDS) {
    try {
      const articles = fetchRssFeed(feed, cutoffTime);
      Logger.log(`✅ ${feed.name}: ${articles.length}件`);
    } catch (error) {
      Logger.log(`❌ ${feed.name}: エラー - ${error.toString()}`);
    }
    Utilities.sleep(500);
  }
}
