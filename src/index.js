// ============================================================
// index.js - メインエントリーポイント
// GASの sendDailyNewsDigest に相当する処理
// npm start または node src/index.js で実行する
// ============================================================

// ローカル実行時は .env ファイルを自動読み込み
// GitHub Actions では環境変数として渡されるため不要
import { readFileSync } from "fs";
import { existsSync } from "fs";

function parseEnvLines(content) {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // "value" / 'value' のような引用符を除去
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // すでに設定済みの環境変数は上書きしない（CI側を優先）
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadLocalEnvFiles() {
  const envFiles = ["../.env.local", "../.env"];
  let loaded = [];

  for (const relPath of envFiles) {
    const fullPath = new URL(relPath, import.meta.url);
    if (!existsSync(fullPath)) continue;
    const envContent = readFileSync(fullPath, "utf-8");
    parseEnvLines(envContent);
    loaded.push(relPath.replace("../", ""));
  }

  if (loaded.length > 0) {
    console.log(`📄 環境変数ファイルを読み込みました: ${loaded.join(", ")}`);
  }
}

/**
 * ニュースダイジェストを生成してメール送信するメイン処理
 */
async function sendDailyNewsDigest() {
  // 先にローカル環境変数を読み込んでから、依存モジュールを動的importする
  // （static importだと config.js の必須チェックが先に走るため）
  loadLocalEnvFiles();
  const { collectAllArticles } = await import("./rss.js");
  const { generateDigestWithGemini } = await import("./gemini.js");
  const { sendNewsEmail } = await import("./mailer.js");

  console.log(
    "🚀 ニュースダイジェスト生成開始:",
    new Date().toLocaleString("ja-JP", { timeZone: "Asia/Yangon" }),
  );

  try {
    // 1. 全RSSフィードから記事を収集
    console.log("\n📡 RSSフィードから記事を収集中...");
    const allArticles = await collectAllArticles();
    console.log(`\n📊 収集した記事数: ${allArticles.length}件`);

    if (allArticles.length === 0) {
      console.error("⚠️ 記事が0件のため処理を中止します");
      process.exit(1);
    }

    // 2. Gemini APIでニュース整理・要約
    console.log("\n🤖 Gemini APIでダイジェストを生成中...");
    const digest = await generateDigestWithGemini(allArticles);
    console.log("✅ ダイジェスト生成完了");

    // 3. HTMLメールを作成して送信
    console.log("\n📧 メールを送信中...");
    await sendNewsEmail(digest);

    console.log("\n🎉 ニュースダイジェスト送信完了！");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error.message);
    console.error(error.stack);
    process.exit(1); // GitHub Actionsでジョブを失敗扱いにする
  }
}

// 実行
sendDailyNewsDigest();
