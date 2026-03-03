// ============================================================
// config.js - 設定ファイル
// 値はすべて環境変数（GitHub Secrets）から読み取る
// ============================================================

/**
 * アプリケーション設定
 * 環境変数が未設定の場合はエラーを投げる
 */
export const CONFIG = {
  // Gemini APIキー（GitHub Secret: GEMINI_API_KEY）
  GEMINI_API_KEY: requireEnv("GEMINI_API_KEY"),

  // 使用するGeminiモデル
  // gemini-2.5-flash-lite は高速かつニュース要約に十分な品質
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",

  // メール送信元アカウント（GitHub Secret: GMAIL_USER）
  GMAIL_USER: requireEnv("GMAIL_USER"),

  // Gmailアプリパスワード（GitHub Secret: GMAIL_APP_PASSWORD）
  GMAIL_APP_PASSWORD: requireEnv("GMAIL_APP_PASSWORD"),

  // メール送信先（カンマ区切り、GitHub Secret: EMAIL_RECIPIENTS）
  EMAIL_RECIPIENTS: requireEnv("EMAIL_RECIPIENTS")
    .split(",")
    .map((addr) => addr.trim())
    .filter(Boolean),

  // メール件名のプレフィックス
  EMAIL_SUBJECT_PREFIX: "【日刊ニュースダイジェスト】",

  // 1フィードあたり最大取得記事数
  MAX_ARTICLES_PER_FEED: 8,

  // ニュース収集対象のRSSフィードリスト
  RSS_FEEDS: [
    // ---- 国内メディア ----
    {
      name: "NHK（政治）",
      url: "https://www3.nhk.or.jp/rss/news/cat4.xml",
      type: "国内",
    },
    {
      name: "NHK（国際）",
      url: "https://www3.nhk.or.jp/rss/news/cat6.xml",
      type: "国際",
    },
    {
      name: "NHK（経済）",
      url: "https://www3.nhk.or.jp/rss/news/cat5.xml",
      type: "国内",
    },
    {
      name: "毎日新聞",
      url: "https://mainichi.jp/rss/etc/mainichi-flash.rss",
      type: "国内",
    },
    // ---- 海外メディア（日本語）----
    {
      name: "BBC News Japan",
      url: "https://feeds.bbci.co.uk/japanese/rss.xml",
      type: "国際",
    },
    // ---- 海外メディア（英語）----
    {
      name: "Al Jazeera English",
      url: "https://www.aljazeera.com/xml/rss/all.xml",
      type: "国際",
      maxArticles: 16,
    },
    {
      name: "Deutsche Welle（国際）",
      url: "https://rss.dw.com/rdf/rss-en-world",
      type: "国際",
    },
    {
      name: "France 24 English",
      url: "https://www.france24.com/en/rss",
      type: "国際",
    },
    {
      name: "BBC News World",
      url: "https://feeds.bbci.co.uk/news/world/rss.xml",
      type: "国際",
    },
  ],
};

/**
 * 必須環境変数を取得する。未設定の場合はエラーを投げる。
 * @param {string} name - 環境変数名
 * @returns {string} 環境変数の値
 */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `必須の環境変数 "${name}" が設定されていません。` +
        `ローカル実行時は .env ファイルを、GitHub ActionsではSecretsを設定してください。`,
    );
  }
  return value;
}
