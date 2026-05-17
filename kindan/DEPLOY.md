# 禁断の原稿用紙 - デプロイ手順（15分でリリース）

## 前提
- Node.js 18以上インストール済み
- GitHubアカウントあり
- Cloudflareアカウントあり
- Stripeアカウントあり（テスト→本番切り替え可）

---

## STEP 1: ローカル動作確認（3分）

```powershell
# このフォルダに入る
cd kindan-genkouyoushi

# パッケージインストール
npm install

# .env.localを作る（まずテストキーで）
Copy-Item .env.local.example .env.local

# .env.localをメモ帳で開いてStripeのテストキーを貼る
notepad .env.local

# 開発サーバー起動
npm run dev
# → http://localhost:3000 で動作確認
```

---

## STEP 2: Stripeキーを取得（2分）

1. https://dashboard.stripe.com/test/apikeys を開く
2. 「公開可能キー」→ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY に貼る
3. 「シークレットキー」→ STRIPE_SECRET_KEY に貼る
4. .env.local を保存

---

## STEP 3: GitHubにプッシュ（2分）

```powershell
git init
git add .
git commit -m "initial commit"
# GitHubで新しいリポジトリを作成してから：
git remote add origin https://github.com/YOUR_NAME/kindan-genkouyoushi.git
git push -u origin main
```

---

## STEP 4: Cloudflare Pagesにデプロイ（3分）

1. https://pages.cloudflare.com/ を開く
2. 「Create a project」→「Connect to Git」→ GitHubのリポジトリを選択
3. Build settings:
   - Framework preset: **Next.js**
   - Build command: `npm run build`
   - Build output directory: `.next`
4. 「Save and Deploy」をクリック
5. デプロイ完了後、URLが発行される（例: https://kindan.pages.dev）

---

## STEP 5: 環境変数をCloudflareにセット（2分）

Cloudflare Dashboard → Pages → kindan → Settings → Environment Variables:

```
STRIPE_SECRET_KEY          = sk_live_xxxxx  （本番）または sk_test_xxxxx（テスト）
STRIPE_WEBHOOK_SECRET      = whsec_xxxxx    （STEP 6で取得）
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_xxxxx
NEXT_PUBLIC_APP_URL        = https://kindan.pages.dev  ← 実際のURL
```

→ 「Save」後、「Deployments」から「Retry deployment」

---

## STEP 6: StripeのWebhookを設定（2分）

1. https://dashboard.stripe.com/webhooks を開く
2. 「Add endpoint」
3. Endpoint URL: `https://kindan.pages.dev/api/webhook`
4. Events: `checkout.session.completed` を選択
5. 「Add endpoint」→「Signing secret」をコピー
6. Cloudflareの環境変数 STRIPE_WEBHOOK_SECRET に貼る
7. 再デプロイ

---

## 完了！

- アプリURL: https://kindan.pages.dev
- Stripeダッシュボードで決済確認: https://dashboard.stripe.com
- 本番切り替え: .env.localとCloudflareのキーをsk_test→sk_liveに変更

## トラブルシューティング

**ビルドエラーが出る場合:**
```powershell
npm run build
# エラーを確認してください
```

**Webhookが届かない場合:**
- Stripe CLIでローカルテスト:
```powershell
stripe listen --forward-to localhost:3000/api/webhook
```
