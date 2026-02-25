"""
elmi-manager バックエンド API エントリーポイント。
"""

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import dashboard, users, logs, errors, tests, settings as settings_router
from app.tasks.daily_report import generate_daily_report

app = FastAPI(
    title="elmi-manager API",
    description="エルみえる管理アプリ バックエンドAPI",
    version="0.1.0",
)

# CORS（ローカル開発時用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター登録
app.include_router(dashboard.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(errors.router, prefix="/api")
app.include_router(tests.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")


@app.get("/api/health")
def health():
    """ヘルスチェック（App Runner 用）。"""
    return {"status": "ok", "environment": settings.ENVIRONMENT}


@app.post("/api/tasks/daily-report")
def trigger_daily_report(
    x_internal_auth: str | None = Header(None),
):
    """
    日次改善レポートを手動またはスケジューラから起動。
    TODO(AWS): EventBridge → Lambda → このエンドポイントへ POST。
    内部認証は X-Internal-Auth ヘッダーで共有シークレットを検証。
    """
    # 本番では内部認証を検証
    if settings.ENVIRONMENT != "local":
        if x_internal_auth != settings.INTERNAL_AUTH_SECRET:
            raise HTTPException(status_code=403, detail="Unauthorized")

    result = generate_daily_report()
    return {"ok": True, "result": result}


# ==========================================================
# TODO(AWS): 以下の項目はAWS環境セットアップ後に対応が必要
# ==========================================================
#
# 1. 認証ミドルウェア
#    - Cognito JWT トークン検証を FastAPI dependency として実装
#    - python-jose で署名・有効期限・issuer を検証
#    - 全 /api/* ルートに認証ガードを適用
#    ファイル: app/services/auth.py (新規作成)
#
# 2. DynamoDB テーブル接続
#    - mock_data.py のインメモリデータを DynamoDB に置き換え
#    - boto3.resource("dynamodb") でテーブル操作
#    - settings.DYNAMODB_ENDPOINT があれば LocalStack 向けに接続
#    ファイル: app/services/dynamodb.py (新規作成)
#
# 3. CloudWatch Logs 連携
#    - エルみえるの Lambda 実行ログを FilterLogEvents API で取得
#    - または Subscription Filter で DynamoDB に自動投入（推奨）
#    ファイル: app/services/cloudwatch.py (新規作成)
#
# 4. Bedrock 実接続
#    - app/services/bedrock.py のモックをコメントアウトし実API呼び出しを有効化
#    - BEDROCK_MODEL_ID を環境変数で指定
#
# 5. SES 実接続
#    - app/services/ses.py のモックをコメントアウトし実送信を有効化
#    - SES_SENDER_EMAIL のメールアドレス/ドメインを SES で検証
#
# 6. S3 設定ファイル管理
#    - 設定ファイルの CRUD + バージョン管理 API を実装
#    ファイル: app/routers/config_files.py, app/services/s3.py (新規作成)
#
# ==========================================================
