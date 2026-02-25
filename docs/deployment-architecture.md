# エルみえる管理アプリ（elmi-manager）デプロイ・インフラ設計書

## 1. デプロイ方式の選定

### 1.1 比較検討

3つの選択肢を比較し、**AWS App Runner** を採用する。

| 評価軸 | App Runner | ECS Fargate | Lambda + API GW |
|--------|-----------|-------------|-----------------|
| **月額コスト（5人利用）** | $8-15 | $25-30 | $3-5 |
| **FastAPI互換性** | 完全対応 | 完全対応 | Mangumアダプタ必要 |
| **長時間タスク対応** | 制限なし | 制限なし | API GW 29秒制限 |
| **運用負荷** | 最小 | 中（ALB,TG等） | 低 |
| **ローカル開発との一致** | Docker同一 | Docker同一 | 差異あり |
| **自動スケーリング** | 組込み | 設定必要 | 自動 |
| **auto-pause** | あり（未使用時停止） | なし | 自然にゼロ |

### 1.2 App Runner 採用理由

1. **コスト最適**: auto-pause機能により未使用時は最低$5/月程度。ALB不要で$16/月節約
2. **FastAPI完全互換**: uvicornをそのまま実行。BackgroundTasks、ストリーミング等すべて動作
3. **タイムアウト制限なし**: Bedrockによるバッチ分析（数分かかる可能性）に対応可能
4. **運用簡素**: TLS、ロードバランシング、ヘルスチェック、デプロイがすべて組込み
5. **VPC不要**: 全AWS連携サービスがパブリックエンドポイント。NAT Gateway費用($32/月)回避

---

## 2. 全体アーキテクチャ

```
                         ┌──────────────────────────────────────────┐
                         │             管理者ブラウザ                │
                         └──────────┬───────────┬──────────────────┘
                                    │           │
                              HTTPS │           │ HTTPS
                                    │           │
                    ┌───────────────▼──┐  ┌─────▼──────────────────┐
                    │  CloudFront      │  │  App Runner             │
                    │  (フロントエンド)  │  │  (FastAPI バックエンド)  │
                    │                  │  │                         │
                    │  React SPA       │  │  - REST API             │
                    │  S3 Origin       │  │  - BackgroundTasks      │
                    └──────────────────┘  │  - Bedrock Client       │
                                          └────────┬────────────────┘
                                                   │
                                   IAM Instance Role│
                       ┌───────┬───────┬───────┬───┴───┬───────┬───────┐
                       │       │       │       │       │       │       │
                       ▼       ▼       ▼       ▼       ▼       ▼       ▼
                  ┌────────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────────┐
                  │Cognito ││Cognito││Bedrock││ SES  ││Dynamo││ S3   ││CloudWatch│
                  │(認証)  ││(管理 ││(AI)  ││(Mail)││ DB   ││(設定)││ Logs     │
                  │elmi-   ││対象) ││Claude││      ││(Data)││(File)││(参照)    │
                  │manager ││エルみ ││      ││      ││      ││      ││          │
                  │User    ││える  ││      ││      ││      ││      ││          │
                  │Pool    ││User  ││      ││      ││      ││      ││          │
                  │        ││Pool  ││      ││      ││      ││      ││          │
                  └────────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────────┘

      ┌──────────────────────────────────────────────────────────────────────┐
      │ ログ収集パイプライン                                                  │
      │                                                                      │
      │  CloudWatch Logs              Subscription        DynamoDB           │
      │  (/aws/lambda/elmi-mieru) ──── Filter ──→ Lambda ──→ usage_logs     │
      │                                           (Log                       │
      │                                           Processor)                 │
      └──────────────────────────────────────────────────────────────────────┘

      ┌──────────────────────────────────────────────────────────────────────┐
      │ 日次バッチ                                                           │
      │                                                                      │
      │  EventBridge Rule          Lambda              App Runner            │
      │  cron(0 0 * * ? *)  ──→  (Trigger)  ── POST ─→ /api/tasks/          │
      │  09:00 JST                                     daily-report          │
      │                                                    │                 │
      │                                                    ▼                 │
      │                                              SES → メール送信        │
      └──────────────────────────────────────────────────────────────────────┘

      ┌──────────────────────────────────────────────────────────────────────┐
      │ CI/CD                                                                │
      │                                                                      │
      │  GitHub Actions                                                      │
      │    Push to main                                                      │
      │      ├──→ Build frontend → S3 sync → CloudFront invalidation        │
      │      └──→ Build Docker → ECR push → App Runner auto-deploy          │
      └──────────────────────────────────────────────────────────────────────┘
```

---

## 3. AWS CDK によるインフラ定義

### 3.1 CDK プロジェクト構成

```
infra/
├── bin/
│   └── app.ts                    # CDK アプリエントリーポイント
├── lib/
│   ├── shared-stack.ts           # IAMロール、共通リソース
│   ├── data-stack.ts             # DynamoDB テーブル + S3 バケット
│   ├── auth-stack.ts             # Cognito User Pool（elmi-manager用）
│   ├── backend-stack.ts          # App Runner + ECR
│   ├── frontend-stack.ts         # S3 + CloudFront
│   ├── ingestion-stack.ts        # ログ収集Lambda + Subscription Filter
│   └── scheduler-stack.ts        # EventBridge + 日次トリガーLambda
├── cdk.json
├── package.json
└── tsconfig.json
```

### 3.2 スタック依存関係

```
SharedStack (IAMロール、基本設定)
    │
    ├──→ DataStack (DynamoDB, S3)
    │       │
    ├──→ AuthStack (Cognito)
    │       │
    ├──→ BackendStack (App Runner) ─── depends on DataStack, AuthStack
    │       │
    ├──→ FrontendStack (S3 + CloudFront) ─── depends on BackendStack (API URL)
    │
    ├──→ IngestionStack (ログ収集Lambda) ─── depends on DataStack
    │
    └──→ SchedulerStack (EventBridge + Lambda) ─── depends on BackendStack
```

### 3.3 App Runner 設定概要

```typescript
// 概念コード
const service = new apprunner.Service(this, 'ElmiManagerApi', {
  source: apprunner.Source.fromEcr({
    repository: ecrRepo,
    imageConfiguration: {
      port: 8000,
      environmentVariables: {
        DYNAMODB_TABLE_PREFIX: 'elmi-manager',
        S3_CONFIG_BUCKET: configBucket.bucketName,
        COGNITO_TARGET_POOL_ID: '<エルみえるのPool ID>',
        BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
        SES_SENDER_EMAIL: 'noreply@example.com',
      },
    },
  }),
  cpu: apprunner.Cpu.QUARTER_VCPU,       // 0.25 vCPU
  memory: apprunner.Memory.HALF_GB,       // 0.5 GB
  instanceRole: backendRole,
  autoDeploymentsEnabled: true,           // ECR push時に自動デプロイ
  healthCheck: apprunner.HealthCheck.http({
    path: '/api/health',
  }),
});
```

---

## 4. データ層設計

### 4.1 方式: DynamoDB（オンデマンド）+ S3

**選定理由**:
- データモデルがKey-Value・時系列中心でリレーショナルJOIN不要
- オンデマンド課金で5人利用なら月$1以下
- Aurora Serverless v2の最低$43/月と比較して大幅に低コスト

### 4.2 DynamoDB テーブル設計

#### テーブル1: `elmi-manager-usage-logs`（利用ログ）

| 属性 | 型 | 役割 |
|------|-----|------|
| `PK` | String | `LOG#<YYYY-MM-DD>` |
| `SK` | String | `<timestamp>#<lambda_request_id>` |
| `user_id` | String | Cognito sub |
| `user_email` | String | メールアドレス |
| `natural_language_query` | String | 自然言語リクエスト |
| `generated_sql` | String | 生成されたSQL |
| `sql_execution_result` | String | 実行結果（サマリ） |
| `response_text` | String | AI応答テキスト |
| `status` | String | `success` / `error` / `timeout` |
| `error_message` | String | エラーメッセージ（nullable） |
| `latency_ms` | Number | レスポンスタイム |
| `lambda_request_id` | String | Lambda実行ID |
| `created_at` | String | ISO 8601 |
| `ttl_expire` | Number | TTL（作成から90日後のepoch秒） |

**GSI-1**: `GSI-UserLogs` -- PK: `user_id`, SK: `created_at`
**GSI-2**: `GSI-StatusDate` -- PK: `status`, SK: `created_at`

#### テーブル2: `elmi-manager-test-cases`（テストケース）

| 属性 | 型 | 役割 |
|------|-----|------|
| `PK` | String | `TESTCASE#<test_id>` |
| `SK` | String | `METADATA` |
| `name` | String | テスト名 |
| `category` | String | カテゴリ |
| `input_query` | String | 自然言語リクエスト |
| `expected_behavior` | Map | 合格条件JSON |
| `tags` | List | タグリスト |

#### テーブル3: `elmi-manager-test-runs`（テスト実行結果）

| 属性 | 型 | 役割 |
|------|-----|------|
| `PK` | String | `TESTCASE#<test_id>` |
| `SK` | String | `RUN#<timestamp>#<run_id>` |
| `batch_id` | String | 一括実行グループID |
| `status` | String | `pass` / `fail` / `error` |
| `generated_sql` | String | 生成SQL |
| `latency_ms` | Number | 応答時間 |
| `validation_results` | Map | 各条件のpass/fail |
| `ai_analysis` | String | Bedrock分析結果（nullable） |

**GSI-3**: `GSI-BatchRuns` -- PK: `batch_id`, SK: `test_id`

#### テーブル4: `elmi-manager-error-analysis`（エラー分析）

| 属性 | 型 | 役割 |
|------|-----|------|
| `PK` | String | `ERROR#<YYYY-MM-DD>` |
| `SK` | String | `<timestamp>#<error_id>` |
| `source_log_id` | String | 元ログ参照 |
| `error_type` | String | `sql_syntax` / `timeout` / `redshift_connection` / `bedrock_error` |
| `ai_analysis` | String | Bedrock分析結果 |
| `ai_suggestions` | List | 改善提案リスト |
| `resolution_status` | String | `unresolved` / `resolved` / `ignored` |

#### テーブル5: `elmi-manager-settings`（設定・メタデータ）

| 属性 | 型 | 役割 |
|------|-----|------|
| `PK` | String | `SETTING#<key>` or `CONFIG#<filepath>` |
| `SK` | String | `CURRENT` or `VERSION#v<n>` |
| `value` | String | JSON値 |

### 4.3 S3 バケット設計

**バケット1**: `elmi-manager-frontend-{account_id}`
- React SPAの静的ファイル配信（CloudFront Origin）

**バケット2**: `elmi-manager-config-{account_id}`
- 設定ファイル・プロンプトファイルのバージョン管理

```
configs/
  prompts/sql_generation.json
  config/column_mapping.json
versions/
  prompts/sql_generation.json/
    v1_2026-02-01T10:00:00Z.json
    v2_2026-02-05T14:30:00Z.json
```

---

## 5. セキュリティ設計

### 5.1 認証方式

**elmi-manager専用のCognito User Poolを作成**（エルみえるのUser Poolとは分離）。

- エルみえるのUser Pool = エンドユーザー向け（管理対象）
- elmi-manager User Pool = 管理者向け（本アプリのログイン用）

**認証フロー**:
1. フロントエンド: `@aws-amplify/auth` でCognito認証
2. JWT（Access Token）を `Authorization: Bearer <token>` ヘッダーで送信
3. FastAPI: `python-jose`でJWT検証（署名、有効期限、issuer）
4. `get_current_user` 依存関数でユーザー情報を抽出

**User Pool設定**:
- セルフ登録: 無効（管理者が手動作成）
- パスワードポリシー: 12文字以上、大小英数混在
- MFA: オプション（TOTP）
- Access Token有効期限: 1時間、Refresh Token: 30日

### 5.2 IAMロール

**Role 1: App Runner Instance Role** (`elmi-manager-api-role`)

```
Permissions:
  cognito-idp: ListUsers, AdminCreateUser, AdminDisableUser,
               AdminEnableUser, AdminResetUserPassword, AdminGetUser
    → Resource: エルみえるのCognito User Pool

  bedrock: InvokeModel, InvokeModelWithResponseStream
    → Resource: anthropic.claude-* モデル

  ses: SendEmail, SendRawEmail
    → Resource: 検証済みメールアドレス/ドメイン

  dynamodb: GetItem, PutItem, UpdateItem, DeleteItem, Query, Scan,
            BatchGetItem, BatchWriteItem
    → Resource: elmi-manager-* テーブル + GSI

  s3: GetObject, PutObject, ListBucket, DeleteObject
    → Resource: elmi-manager-config-* バケット

  logs: FilterLogEvents, GetLogEvents, DescribeLogGroups
    → Resource: エルみえるのLambdaログ
```

**Role 2: App Runner ECR Access Role**
- AWS管理ポリシー: `AWSAppRunnerServicePolicyForECRAccess`

**Role 3: Log Processor Lambda Role**
- CloudWatch Logs読み取り + DynamoDB書き込み

**Role 4: Daily Trigger Lambda Role**
- App RunnerへのHTTPリクエスト用

**Role 5: GitHub Actions OIDC Role**
- ECR push + S3 sync + CloudFront invalidation + CDK deploy

### 5.3 VPC方針

**初期段階ではVPCなし**で構築。

- 利用する全AWSサービスがパブリックエンドポイントでアクセス可能
- NAT Gatewayの$32/月が不要
- 将来、Redshift等のVPC内リソースへのアクセスが必要になった場合にVPC Connectorを追加

---

## 6. ログ収集戦略

### 6.1 構造化ログの場合（推奨パス）

```
CloudWatch Logs (/aws/lambda/elmi-mieru)
    │
    │ Subscription Filter（JSONフィルタパターン）
    ▼
Lambda: elmi-manager-log-processor
    │
    │ ログパース → DynamoDB item変換 → BatchWriteItem
    ▼
DynamoDB: elmi-manager-usage-logs
```

- ニアリアルタイム（秒単位の遅延）
- at-least-once配信保証
- CloudWatch API呼び出しコスト不要

### 6.2 非構造化ログの場合（フォールバック）

エルみえるのLambdaがJSON形式でログを出していない場合:

```
CloudWatch Logs
    │
    │ 定期ポーリング（5分間隔）
    ▼
Lambda: elmi-manager-log-poller
    │
    │ FilterLogEvents API → best-effortパース → DynamoDB
    ▼
DynamoDB: elmi-manager-usage-logs (raw_log フィールドにも生ログ保存)
```

**推奨**: まず現行のLambdaログ形式を確認し、構造化ログになっていなければエルみえる側に追加する。

---

## 7. 日次バッチ処理

```
EventBridge Rule: cron(0 0 * * ? *)   ← 00:00 UTC = 09:00 JST
    │
    ▼
Lambda (daily-report-trigger)
    │
    │ POST https://<app-runner-url>/api/tasks/daily-report
    │ Authorization: X-Internal-Auth: <SSM Parameter Store共有シークレット>
    │
    ▼
App Runner (FastAPI)
    │
    ├─ 1. DynamoDB Query: 前日のerror/timeoutログ取得
    ├─ 2. エラー種別ごとに集計
    ├─ 3. 代表的エラー5件を選定
    ├─ 4. 各エラーに対しBedrock (Claude) で改善提案を生成
    ├─ 5. メールHTMLをテンプレートから生成
    └─ 6. SESでメール送信
    │
    ▼
管理者メールボックス
```

**Lambda→App Runnerの方式を採用する理由**:
- FastAPIのコード（DynamoDB/Bedrock/SESクライアント）をそのまま再利用
- 設定画面の「テストメール送信」ボタンから同じエンドポイントを呼べる
- 複数Bedrock呼び出しで数分かかってもタイムアウトなし

---

## 8. CI/CD パイプライン

### GitHub Actions

```
On Push to main:
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Job: test-backend                                       │
│    Python 3.12 + pytest + moto（AWSモック）               │
│                                                          │
│  Job: test-frontend                                      │
│    Node 22 + vitest + type-check                         │
│                                                          │
│  Job: deploy (test-backend, test-frontend 完了後)         │
│    ┌─ OIDC認証 → AWSクレデンシャル取得（キー保存不要）      │
│    ├─ Step 1: npm run build → S3 sync → CF invalidation  │
│    ├─ Step 2: docker build → ECR push → App Runner自動DL │
│    └─ Step 3: npx cdk diff → cdk deploy (変更があれば)    │
│                                                          │
└──────────────────────────────────────────────────────────┘

On Pull Request:
┌──────────────────────────────────────────────────────────┐
│  test-backend + test-frontend + cdk diff（変更プレビュー） │
└──────────────────────────────────────────────────────────┘
```

### 認証: GitHub OIDC（キーレス）

GitHub Actions OIDC providerを使い、IAMロールをAssumeする。長期的なAWSキーの保存は不要。

### 環境戦略

| ブランチ | 環境 | 方針 |
|---------|------|------|
| `main` | Production | マージ時自動デプロイ |
| feature branches | - | PRテスト（moto/vitest）のみ |

5人規模のツールではStaging環境は当面不要。App Runnerのリビジョン履歴で即座にロールバック可能。

---

## 9. ローカル開発環境

### 開発ツール構成

| レイヤー | ツール | 用途 |
|---------|--------|------|
| AWSモック（テスト） | **moto** | pytest内でDynamoDB/Cognito/S3/SESをモック |
| AWSモック（手動開発） | **LocalStack**（オプション） | ローカルでAWSサービスをエミュレート |
| Bedrock | **実AWS** | moto/LocalStack非対応。開発時はAWSアカウントに接続 |
| フロントエンドモック | **MSW** (Mock Service Worker) | API応答をモックしてUI単体開発 |

### docker-compose.yml

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=local
      - AWS_REGION=ap-northeast-1
      - DYNAMODB_ENDPOINT=http://localstack:4566  # Optional
    volumes:
      - ./backend:/app/backend    # uvicorn --reload でホットリロード

  frontend:
    build:
      context: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src   # Vite HMR
    environment:
      - VITE_API_URL=http://localhost:8000

  localstack:   # オプション
    image: localstack/localstack
    ports:
      - "4566:4566"
    environment:
      - SERVICES=dynamodb,s3,ses,cognito
```

---

## 10. コスト見積もり

### 月額コスト（管理者5人、エルみえる1,000リクエスト/日想定）

| サービス | 利用量 | 月額 |
|---------|--------|------|
| App Runner | 0.25 vCPU, 0.5GB, auto-pause (~4h稼働/日) | ~$5-8 |
| DynamoDB (on-demand) | ~30K writes + ~50K reads/月 | ~$0.50 |
| S3 (設定ファイル + フロントエンド) | <1 GB, <10K requests | ~$0.10 |
| CloudFront | <1 GB transfer, <10K requests | ~$0.10 |
| Lambda (ログ処理 + 日次トリガー) | ~30K invocations, 128MB | $0.00 (Free Tier) |
| Cognito (elmi-manager認証) | 5ユーザー | $0.00 (Free Tier) |
| **Bedrock (Claude Sonnet)** | ~10分析/日 × 30日, ~3K tokens/回 | ~$2-5 |
| SES | 30通/月 | $0.00 (Free Tier) |
| EventBridge | 30 invocations/月 | $0.00 |
| ECR | 1イメージ ~500MB | ~$0.05 |
| CloudWatch Logs | <1 GB/月 | ~$0.50 |
| **合計** | | **$8-15/月** |

### コスト注意点

- **最大変動要因はBedrock**: 分析頻度が高まると$20-50/月に上昇の可能性
- **VPC非採用で$32/月のNAT Gateway費を回避**
- **ALB非採用で$16/月を回避**（App Runner組込みLBを利用）
- エルみえるのリクエストが10倍（10,000/日）になってもDynamoDBは~$5/月程度

---

## 11. 既存ドキュメントとの対応表

| 本書のセクション | 関連する既存要件 |
|----------------|----------------|
| App Runner (バックエンド) | system-requirements F1-F6 全機能のAPI実行基盤 |
| Cognito (elmi-manager認証) | system-requirements 3.2 認証・認可 |
| DynamoDB テーブル設計 | system-requirements F2 ログ項目、F3 テストケース定義 |
| S3 (設定ファイル) | system-requirements F6 バージョン管理 |
| Bedrock (Claude) | system-requirements F4 AI改善提案、F5 日次レポート |
| SES + EventBridge | system-requirements F5 日次メール |
| ログ収集パイプライン | system-requirements F2 データソース |
| GitHub Actions CI/CD | tech-stack デプロイ項目 |
