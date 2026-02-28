// ============================================================
// Config.gs - 設定ファイル
// ここに自分の設定を入力してください
// ============================================================

/**
 * ユーザー設定
 * 必ずご自身の情報に書き換えてください
 */
const CONFIG = {
  // Gemini APIキー（Google AI Studio: https://aistudio.google.com/ で取得）
  GEMINI_API_KEY: "XXXXX",

  // メール送信先（複数可。カンマ区切りで追加）
  EMAIL_RECIPIENTS: ["XXXXX@mail.com"],

  // メール件名のプレフィックス
  EMAIL_SUBJECT_PREFIX: "【日刊ニュースダイジェスト】",

  // 使用するGeminiモデル
  // ※ gemini-2.5-flashはThinking Modelのため処理時間が長くGASの6分制限に引っかかる
  // ※ ニュース要約にはgemini-2.5-flash-liteで十分な品質が得られ、かつ高速
  GEMINI_MODEL: "gemini-2.5-flash-lite",

  // 1回の実行でRSSから取得する最大記事数
  // ※ 多すぎるとGeminiへの送信データが巨大化してタイムアウトする（8件で失敗実績あり）
  MAX_ARTICLES_PER_FEED: 8,

  // ニュース収集対象のRSSフィードリスト
  // ※ 応答の遅いフィードは実行時間超過の原因になるため除外しています
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
