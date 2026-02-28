// ============================================================
// testRss.js - RSS取得の疎通確認スクリプト
// 実行: npm run test:rss
// ============================================================

import { readFileSync } from "fs";

function loadDotEnvIfExists() {
  try {
    const envContent = readFileSync(new URL("../.env", import.meta.url), "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env がない場合は無視
  }
}

// config.js は必須環境変数を検証するため、RSSテストに不要な値はダミーで補完する
function ensureRequiredEnvForConfig() {
  if (!process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = "dummy";
  if (!process.env.GMAIL_USER) process.env.GMAIL_USER = "dummy@example.com";
  if (!process.env.GMAIL_APP_PASSWORD) process.env.GMAIL_APP_PASSWORD = "dummy";
  if (!process.env.EMAIL_RECIPIENTS) {
    process.env.EMAIL_RECIPIENTS = "dummy@example.com";
  }
}

async function main() {
  loadDotEnvIfExists();
  ensureRequiredEnvForConfig();

  const { collectAllArticles } = await import("./rss.js");

  console.log("📡 RSS疎通テストを開始します...");
  const articles = await collectAllArticles();

  console.log(`\n📊 合計取得件数: ${articles.length}件`);
  if (articles.length > 0) {
    console.log("\n📝 先頭5件:");
    for (const article of articles.slice(0, 5)) {
      console.log(`- [${article.source}] ${article.title}`);
      console.log(`  ${article.link}`);
    }
  }
}

main().catch((error) => {
  console.error("❌ RSS疎通テストでエラー:", error.message);
  process.exit(1);
});
