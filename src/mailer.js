// ============================================================
// mailer.js - メール送信モジュール
// GASの GmailApp.sendEmail を Nodemailer + Gmail SMTP で置き換え
// ============================================================

import nodemailer from "nodemailer";
import { CONFIG } from "./config.js";
import { buildHtmlEmail } from "./htmlBuilder.js";

/**
 * ダイジェストをHTMLメールとして送信する
 * @param {string} digestText - Gemini APIが生成したMarkdown形式のダイジェスト
 * @returns {Promise<void>}
 */
export async function sendNewsEmail(digestText) {
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Yangon",
  });

  const subject = `${CONFIG.EMAIL_SUBJECT_PREFIX}${today}`;
  const htmlBody = buildHtmlEmail(digestText, today);

  // Gmail SMTPトランスポートを設定
  // ※Gmailの「アプリパスワード」を使用（Googleアカウントの2段階認証が必要）
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: CONFIG.GMAIL_USER,
      pass: CONFIG.GMAIL_APP_PASSWORD,
    },
  });

  for (const recipient of CONFIG.EMAIL_RECIPIENTS) {
    await transporter.sendMail({
      from: `"日刊ニュースダイジェスト" <${CONFIG.GMAIL_USER}>`,
      to: recipient,
      subject: subject,
      text: digestText, // プレーンテキスト版（フォールバック）
      html: htmlBody, // HTML版
    });
    console.log(`📧 メール送信完了: ${recipient}`);
  }
}
