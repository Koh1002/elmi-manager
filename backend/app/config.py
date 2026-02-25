from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """アプリケーション設定。環境変数または .env ファイルから読み込み。"""

    ENVIRONMENT: str = "local"  # local | staging | production

    # AWS共通
    AWS_REGION: str = "ap-northeast-1"

    # TODO(AWS): App Runner デプロイ後に実値を環境変数で設定
    # DynamoDB
    DYNAMODB_TABLE_PREFIX: str = "elmi-manager"
    DYNAMODB_ENDPOINT: str | None = None  # LocalStack用: http://localhost:4566

    # S3
    S3_CONFIG_BUCKET: str = "elmi-manager-config"
    S3_ENDPOINT: str | None = None  # LocalStack用

    # Cognito（管理対象のエルみえるUser Pool）
    COGNITO_TARGET_POOL_ID: str = ""

    # Cognito（elmi-manager自身の認証用）
    COGNITO_MANAGER_POOL_ID: str = ""
    COGNITO_MANAGER_CLIENT_ID: str = ""

    # Bedrock
    BEDROCK_MODEL_ID: str = "anthropic.claude-3-sonnet-20240229-v1:0"

    # SES
    SES_SENDER_EMAIL: str = "noreply@example.com"

    # エルみえるAPI
    ELMI_API_ENDPOINT: str = ""

    # 日次レポート内部認証
    INTERNAL_AUTH_SECRET: str = "dev-secret-change-in-production"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
