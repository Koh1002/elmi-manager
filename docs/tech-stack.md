# elmi-manager 技術スタック & プロジェクト構成

## 技術スタック

### フロントエンド
| 技術 | バージョン | 用途 |
|------|-----------|------|
| React | 19.x | UIフレームワーク |
| TypeScript | 5.x | 型安全性 |
| Vite | 6.x | ビルドツール |
| Tailwind CSS | 4.x | スタイリング |
| shadcn/ui | latest | UIコンポーネント |
| Recharts | 2.x | チャート描画 |
| TanStack Table | 8.x | テーブル |
| TanStack Query | 5.x | サーバーステート管理 |
| React Router | 7.x | ルーティング |
| Monaco Editor | latest | コードエディタ |
| Lucide React | latest | アイコン |

### バックエンド
| 技術 | バージョン | 用途 |
|------|-----------|------|
| Python | 3.12 | バックエンド言語 |
| FastAPI | 0.115.x | APIフレームワーク |
| Pydantic | 2.x | データバリデーション |
| Boto3 | latest | AWS SDK |
| python-jose | latest | JWT検証（Cognito認証） |
| uvicorn | latest | ASGIサーバー |

### インフラ（AWS CDK）
| 技術 | バージョン | 用途 |
|------|-----------|------|
| AWS CDK | 2.x | IaC（TypeScript） |
| Docker | - | バックエンドコンテナビルド |

### AWS サービス構成
| サービス | 用途 | 備考 |
|----------|------|------|
| AWS App Runner | バックエンドAPI実行基盤 | 0.25 vCPU / 0.5 GB, auto-pause |
| Amazon S3 + CloudFront | フロントエンド配信 | React SPA |
| Amazon Cognito | 認証（elmi-manager用 + エルみえる管理対象） | 専用User Pool分離 |
| Amazon DynamoDB | データストア | オンデマンド課金、5テーブル |
| Amazon S3 | 設定ファイル保存 | バージョン管理 |
| Amazon Bedrock | AI改善提案生成 | Claude Sonnet |
| Amazon SES | 日次メール送信 | |
| Amazon EventBridge | 日次スケジュール | cron 09:00 JST |
| Amazon ECR | Dockerイメージ保存 | App Runner自動デプロイ |
| CloudWatch Logs | エルみえるログ取得 | Subscription Filter |

### テスト・開発ツール
| 技術 | 用途 |
|------|------|
| pytest + moto | バックエンドテスト（AWSサービスモック） |
| Vitest + MSW | フロントエンドテスト（APIモック） |
| Docker Compose | ローカル開発環境 |
| LocalStack (オプション) | ローカルAWSエミュレーション |

---

## ディレクトリ構成

```
elmi-manager/
├── docs/                          # 設計ドキュメント
│   ├── system-requirements.md
│   ├── ux-design.md
│   └── tech-stack.md
│
├── frontend/                      # フロントエンド (React + Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/            # 共通コンポーネント
│   │   │   ├── ui/                # shadcn/ui コンポーネント
│   │   │   ├── layout/            # レイアウト (Sidebar, Header)
│   │   │   └── common/            # 共通パーツ (StatusBadge, etc.)
│   │   │
│   │   ├── pages/                 # ページコンポーネント
│   │   │   ├── Dashboard.tsx
│   │   │   ├── UserManagement.tsx
│   │   │   ├── UsageLogs.tsx
│   │   │   ├── LogDetail.tsx
│   │   │   ├── ErrorAnalysis.tsx
│   │   │   ├── TestManagement.tsx
│   │   │   ├── TestCaseEdit.tsx
│   │   │   ├── TestRunHistory.tsx
│   │   │   ├── ConfigFiles.tsx
│   │   │   ├── ConfigFileEdit.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Login.tsx
│   │   │
│   │   ├── hooks/                 # カスタムフック
│   │   ├── lib/                   # ユーティリティ
│   │   ├── types/                 # TypeScript型定義
│   │   ├── api/                   # API クライアント
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── backend/                       # バックエンド (FastAPI)
│   ├── app/
│   │   ├── main.py                # FastAPIエントリーポイント
│   │   ├── config.py              # 設定管理
│   │   ├── routers/               # APIルーター
│   │   │   ├── users.py           # ユーザー管理API
│   │   │   ├── logs.py            # 利用ログAPI
│   │   │   ├── errors.py          # エラー分析API
│   │   │   ├── tests.py           # テスト管理API
│   │   │   ├── config_files.py    # 設定ファイル管理API
│   │   │   └── settings.py        # 設定API
│   │   │
│   │   ├── models/                # データモデル
│   │   │   ├── database.py        # DB接続
│   │   │   ├── log.py
│   │   │   ├── test_case.py
│   │   │   ├── test_run.py
│   │   │   └── config_version.py
│   │   │
│   │   ├── services/              # ビジネスロジック
│   │   │   ├── cognito.py         # Cognito操作
│   │   │   ├── cloudwatch.py      # ログ取得
│   │   │   ├── bedrock.py         # AI分析
│   │   │   ├── ses.py             # メール送信
│   │   │   └── elmi_client.py     # エルみえるAPI呼び出し
│   │   │
│   │   └── tasks/                 # バックグラウンドタスク
│   │       └── daily_report.py    # 日次レポート生成
│   │
│   ├── requirements.txt
│   └── pyproject.toml
│
├── infra/                         # AWS CDK (TypeScript)
│   ├── bin/
│   │   └── app.ts                 # CDKアプリ エントリーポイント
│   ├── lib/
│   │   ├── shared-stack.ts        # IAMロール、共通リソース
│   │   ├── data-stack.ts          # DynamoDB + S3
│   │   ├── auth-stack.ts          # Cognito User Pool
│   │   ├── backend-stack.ts       # App Runner + ECR
│   │   ├── frontend-stack.ts      # S3 + CloudFront
│   │   ├── ingestion-stack.ts     # ログ収集Lambda
│   │   └── scheduler-stack.ts     # EventBridge + 日次Lambda
│   ├── cdk.json
│   ├── package.json
│   └── tsconfig.json
│
├── docker/
│   └── Dockerfile                 # バックエンドコンテナイメージ
│
├── .github/
│   └── workflows/
│       ├── ci.yml                 # PR: テスト + cdk diff
│       └── deploy.yml             # main: テスト + デプロイ
│
├── docker-compose.yml             # ローカル開発環境
├── .gitignore
└── README.md
```

---

## 開発環境セットアップ

### ローカル開発（Docker Compose推奨）

```bash
# 一発起動（フロントエンド + バックエンド + LocalStack）
docker compose up

# フロントエンド: http://localhost:5173
# バックエンド:   http://localhost:8000
# API仕様確認:    http://localhost:8000/docs  (Swagger UI)
```

### 個別起動

```bash
# フロントエンド
cd frontend
npm install
npm run dev          # http://localhost:5173

# バックエンド
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload  # http://localhost:8000
```

### テスト実行

```bash
# バックエンド（pytest + moto）
cd backend
pytest

# フロントエンド（vitest）
cd frontend
npm test
```

### CDK デプロイ

```bash
cd infra
npm install
npx cdk diff          # 変更プレビュー
npx cdk deploy --all  # 全スタックデプロイ
```
