// ============================================================
// rss.js - RSSフィード収集モジュール
// GASの Code.gs から collectAllArticles / fetchRssFeed / parseRssXml を移植
// ============================================================

import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import { CONFIG } from "./config.js";

/**
 * 全RSSフィードを巡回して記事を収集する
 * ※GitHub Actionsには6分制限がないため、タイムアウト制御は不要
 * @returns {Promise<Array<Object>>} 記事オブジェクトの配列
 */
export async function collectAllArticles() {
  // 直近24時間のみ対象とする
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const allArticles = [];

  for (const feed of CONFIG.RSS_FEEDS) {
    try {
      const articles = await fetchRssFeed(feed, cutoffTime);
      allArticles.push(...articles);
      console.log(`✅ ${feed.name}: ${articles.length}件取得`);
    } catch (error) {
      // 1フィードの失敗で全体を止めない
      console.error(`❌ ${feed.name} の取得に失敗: ${error.message}`);
    }
  }

  return allArticles;
}

/**
 * 単一のRSSフィードを取得・パースして記事配列を返す
 * @param {Object} feed - フィード設定オブジェクト { name, url, type }
 * @param {Date} cutoffTime - これより古い記事は除外する基準日時
 * @returns {Promise<Array<Object>>} 記事オブジェクトの配列
 */
async function fetchRssFeed(feed, cutoffTime) {
  const controller = new AbortController();
  // 1フィードあたり最大30秒で打ち切る
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let response;
  try {
    response = await fetch(feed.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DailyNewsDigest/1.0)",
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`HTTPエラー: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();
  return parseRssXml(xmlText, feed, cutoffTime);
}

/**
 * RSS/AtomのXMLをパースして記事配列を返す
 * @param {string} xmlText - XML文字列
 * @param {Object} feed - フィード設定
 * @param {Date} cutoffTime - 除外基準日時
 * @returns {Promise<Array<Object>>} 記事配列
 */
async function parseRssXml(xmlText, feed, cutoffTime) {
  const articles = [];

  let parsed;
  try {
    parsed = await parseStringPromise(xmlText, {
      explicitArray: false, // 子要素が1件でも配列にしない
      trim: true,
    });
  } catch (err) {
    throw new Error(`XMLパースエラー: ${err.message}`);
  }

  // RSS 2.0
  if (parsed.rss) {
    const items = toArray(parsed.rss?.channel?.item);
    for (const item of items.slice(0, CONFIG.MAX_ARTICLES_PER_FEED)) {
      const article = extractRssItem(item, feed, cutoffTime, "rss2");
      if (article) articles.push(article);
    }
  }
  // Atom
  else if (parsed.feed) {
    const items = toArray(parsed.feed?.entry);
    for (const item of items.slice(0, CONFIG.MAX_ARTICLES_PER_FEED)) {
      const article = extractRssItem(item, feed, cutoffTime, "atom");
      if (article) articles.push(article);
    }
  }
  // RDF/RSS 1.0
  else {
    // xml2jsは名前空間をキーに含めるため "rdf:RDF" → "rdf$RDF" などになる場合がある
    // ルートキーを動的に探す
    const rootKey = Object.keys(parsed).find(
      (k) => k.includes("RDF") || k.includes("rdf"),
    );
    if (rootKey) {
      const items = toArray(parsed[rootKey]?.item);
      for (const item of items.slice(0, CONFIG.MAX_ARTICLES_PER_FEED)) {
        const article = extractRssItem(item, feed, cutoffTime, "rdf");
        if (article) articles.push(article);
      }
    }
  }

  return articles;
}

/**
 * パース済みの1アイテムからArticleオブジェクトを生成する
 * @param {Object} item - xml2jsでパースされた要素
 * @param {Object} feed - フィード設定
 * @param {Date} cutoffTime - 除外基準日時
 * @param {"rss2"|"atom"|"rdf"} format - フィード形式
 * @returns {Object|null} 記事オブジェクト、または除外時はnull
 */
function extractRssItem(item, feed, cutoffTime, format) {
  let title, link, description, pubDateStr;

  if (format === "atom") {
    title = getText(item.title);
    // Atomのlinkはhref属性を持つオブジェクトの場合がある
    link =
      item.link?.["$"]?.href ||
      (Array.isArray(item.link)
        ? item.link[0]?.["$"]?.href
        : getText(item.link));
    description = getText(item.summary) || getText(item.content);
    pubDateStr = item.published || item.updated;
  } else {
    title = getText(item.title);
    link = getText(item.link) || getText(item.guid);
    description = getText(item.description) || getText(item.summary);
    pubDateStr = item.pubDate || item["dc:date"] || item.updated;
  }

  if (!title || !link) return null;

  // 日時チェック（取得できない場合は直近24時間内とみなす）
  if (pubDateStr) {
    const pubDate = new Date(pubDateStr);
    if (!isNaN(pubDate.getTime()) && pubDate < cutoffTime) return null;
  }

  // HTMLタグを除去し300文字に制限（送信トークン削減）
  const cleanDescription = stripHtml(description || "").substring(0, 300);

  return {
    source: feed.name,
    type: feed.type,
    title: title.trim(),
    link: link.trim(),
    description: cleanDescription.trim(),
    publishedAt: pubDateStr || "不明",
  };
}

/**
 * xml2jsの値からテキストを取得する
 * 文字列・オブジェクト・undefinedに対応
 * @param {any} value - xml2jsのフィールド値
 * @returns {string}
 */
function getText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    // { "_": "テキスト", "$": { ... } } のようなケース
    return value._ || value["#text"] || "";
  }
  return String(value);
}

/**
 * 値を必ず配列として返す（xml2js の explicitArray:false 対策）
 * @param {any} value
 * @returns {Array}
 */
function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
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
