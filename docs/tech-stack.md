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
| SQLAlchemy | 2.x | ORM（ローカルDB用） |
| SQLite | - | ローカルデータストア（テストケース・ログ永続化） |

### AWS連携（Phase 2以降で段階的に接続）
| サービス | 用途 |
|----------|------|
| Amazon Cognito | ユーザー管理API |
| CloudWatch Logs | ログ取得 |
| Amazon Bedrock | AI改善提案生成 |
| Amazon SES | 日次メール送信 |
| Amazon EventBridge | 日次スケジュール |
| Amazon S3 | 設定ファイル保存 |

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
├── .gitignore
└── README.md
```

---

## 開発環境セットアップ（将来用メモ）

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

# API仕様確認
# http://localhost:8000/docs  (Swagger UI)
```
