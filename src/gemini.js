// ============================================================
// gemini.js - Gemini APIによるニュース要約モジュール
// GASの Code.gs から generateDigestWithGemini を移植
// ============================================================

import fetch from "node-fetch";
import { CONFIG } from "./config.js";

/**
 * 収集した記事をGemini APIに送って整形されたダイジェストを生成する
 * @param {Array<Object>} articles - 記事配列 { source, type, title, description, link }
 * @returns {Promise<string>} ダイジェスト本文（Markdown形式）
 */
export async function generateDigestWithGemini(articles) {
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
    timeZone: "Asia/Yangon",
  });

  const prompt = `あなたはニュースリサーチ専門のAIです。

以下の記事リストを分析し、${today}の「日本の政治および国際情勢」に関する最も重要なニュース約15件を選定・整理してください。

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
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  };

  console.log(`🤖 Gemini API呼び出し中（モデル: ${CONFIG.GEMINI_MODEL}）...`);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini APIエラー (${response.status}): ${errorBody}`);
  }

  const result = await response.json();

  if (result.candidates?.[0]?.content) {
    const parts = result.candidates[0].content.parts || [];

    // Thinking Modelはpartsに思考パート(thought:true)と回答パートが混在する
    // thought:trueでないパートのtextを取得する
    const answerPart = parts.find((p) => !p.thought && p.text);
    if (answerPart) return answerPart.text;

    // フォールバック：全回答パートを結合
    const combined = parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join("\n");
    if (combined) return combined;
  }

  throw new Error(
    "Gemini APIからの応答が不正です: " +
      JSON.stringify(result).substring(0, 500),
  );
}
