# 📰 日刊ニュースダイジェスト 自動配信システム

日本の政治・国際情勢のニュースダイジェストを毎朝7時にGmailで自動配信するシステムです。

| 項目 | 内容 |
|------|------|
| 実行環境 | GitHub Actions（無料・時間制限なし） |
| AI要約 | Gemini API (`gemini-2.5-flash-lite`) |
| メール送信 | Nodemailer + Gmail SMTP |
| スケジュール | 毎日MMT 07:00（手動実行も可） |

---

## 📁 ファイル構成

```
daily-news/
├── .github/
│   └── workflows/
│       └── daily-news.yml   # GitHub Actionsワークフロー
├── src/
│   ├── index.js             # メインエントリーポイント
│   ├── config.js            # 設定（環境変数から読み取り）
│   ├── rss.js               # RSSフィード収集
│   ├── gemini.js            # Gemini API呼び出し
│   ├── mailer.js            # Gmail SMTP送信
│   └── htmlBuilder.js       # HTMLメール生成
├── dist/                    # GAS版（参照用・使用しない）
│   ├── Code.gs
│   └── Config.gs
├── .env.example             # ローカル開発用設定テンプレート
└── package.json
```

---

## 🚀 セットアップ手順（GitHub Actions版）

### Step 1: Gemini APIキーを取得する

1. [Google AI Studio](https://aistudio.google.com/) にアクセス
2. **「Get API key」** → **「Create API key」** をクリック
3. 表示されたAPIキーをコピーして保存

---

### Step 2: Gmailアプリパスワードを発行する

> [!IMPORTANT]
> Gmailの「アプリパスワード」は、Googleアカウントで **2段階認証を有効にした後** でないと発行できません。

1. [Googleアカウントのセキュリティ設定](https://myaccount.google.com/security) を開く
2. **「2段階認証プロセス」** を有効化（まだの場合）
3. [アプリパスワード](https://myaccount.google.com/apppasswords) ページを開く
4. アプリ名に `daily-news` など任意の名前を入力 → **「作成」**
5. 表示された **16文字のパスワード**（`xxxx xxxx xxxx xxxx`形式）を保存

---

### Step 3: このリポジトリをGitHubにpushする

```bash
git init   # 既にinitされている場合は不要
git add .
git commit -m "Initial commit: GitHub Actions版 日刊ニュースダイジェスト"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

---

### Step 4: GitHub Secretsに設定値を登録する

GitHubリポジトリの **Settings → Secrets and variables → Actions → New repository secret** から以下を登録：

| Secret名 | 値の例 | 説明 |
|----------|--------|------|
| `GEMINI_API_KEY` | `AIzaSy...` | Step 1で取得したGemini APIキー |
| `GMAIL_USER` | `you@gmail.com` | 送信元Gmailアドレス |
| `GMAIL_APP_PASSWORD` | `xxxx xxxx xxxx xxxx` | Step 2で発行したアプリパスワード |
| `EMAIL_RECIPIENTS` | `a@gmail.com,b@example.com` | 送信先（複数はカンマ区切り） |

> [!NOTE]
> `GEMINI_MODEL` は省略可能です。省略時は `gemini-2.5-flash-lite` が使われます。

---

### Step 5: 手動実行でテストする

1. GitHubリポジトリの **「Actions」** タブを開く
2. 左側のワークフロー一覧から **「Daily News Digest」** を選択
3. **「Run workflow」** ボタンをクリック → **「Run workflow」** で実行
4. ジョブが緑色（✅）になり、メールが届けば完了 🎉

---

## 💻 ローカル実行（開発・テスト用）

```bash
# 1. 依存パッケージをインストール
npm install

# 2. .env.example をコピーして設定を記入
cp .env.example .env
# .env を開いて各値を入力

# 3. 実行
npm start
```

---

## ⏰ スケジュール変更

`.github/workflows/daily-news.yml` の `cron` 値を変更：

```yaml
# MMT = UTC + 6時間30分　例：MMT 07:00 → UTC 00:30
- cron: "30 0 * * *"
```

[crontab.guru](https://crontab.guru/) でcron式を確認できます。

---

## ⚙️ カスタマイズ

### RSSフィードを追加・削除する

`src/config.js` の `RSS_FEEDS` 配列を編集：

```javascript
{ name: "フィード名", url: "https://example.com/rss.xml", type: "国内" },
```

### 送信先を追加する

GitHub Secretsの `EMAIL_RECIPIENTS` をカンマ区切りで更新：

```
a@gmail.com,b@example.com,c@company.com
```

---

## 💰 無料枠について

| サービス | 無料枠 | 本システムでの消費量目安 |
|---------|--------|----------------------|
| GitHub Actions | 2,000分/月（パブリックは無制限） | 約5〜10分/回 |
| Gemini API | 1,500リクエスト/日 | 1リクエスト/回 |
| Gmail SMTP | 500通/日 | 1〜3通/回 |

すべて**無料枠で十分に運用可能**です。

---

## 🔧 トラブルシューティング

| 症状 | 原因と対処法 |
|------|------------|
| Actions実行失敗「env not set」 | GitHub Secretsの登録漏れ → Step 4を再確認 |
| `Gemini APIエラー 400` | APIキーが間違っている → Secretsのキーを再確認 |
| `Gemini APIエラー 429` | 無料枠の上限到達 → 翌日にリセットされる |
| `Invalid login` メールエラー | アプリパスワードが間違っている → Step 2を再実行 |
| RSSが0件 | フィードのURLが変更された → 別のURLに差し替える |

---

## 📦 使用技術

- [GitHub Actions](https://docs.github.com/ja/actions) - スケジュール実行環境
- [Gemini API](https://ai.google.dev/) - ニュース整理・要約AI
- [Nodemailer](https://nodemailer.com/) - Gmail SMTP経由でのメール送信
- [xml2js](https://www.npmjs.com/package/xml2js) - RSS/AtomフィードのXMLパース

---

## 📁 GAS版について

`dist/` フォルダにはGoogle Apps Script版のソースが残っています。  
GASの6分実行制限の問題があるため、現在は**GitHub Actions版を推奨**します。
