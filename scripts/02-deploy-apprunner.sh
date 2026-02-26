#!/bin/bash
# =============================================================
# elmi-manager App Runner デプロイ + Lambda/EventBridge セットアップ
# 作成者: shinoda
#
# 前提: 01-setup-aws-resources.sh を実行済み
# 使い方: CloudShell で実行
# =============================================================

set -euo pipefail

# =============================================================
# 変数定義（01 で作成した値を埋めてください）
# =============================================================
export AWS_REGION="ap-northeast-1"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export PROJECT_NAME="elmi-manager"
export ENVIRONMENT="production"
export OWNER="shinoda"

# ★ 01 の出力でメモした値を設定 ★
export COGNITO_MANAGER_POOL_ID=""   # ← 要入力: ap-northeast-1_XXXXXXXXX
export COGNITO_MANAGER_CLIENT_ID="" # ← 要入力: xxxxxxxxxxxxxxxxxxxxxxxxxx

# === エルみえる側 ===
export ELMI_TARGET_POOL_ID="ap-northeast-1_tZHC04UVE"
export ELMI_API_ENDPOINT="PLACEHOLDER_API_GATEWAY_URL"  # ← 要変更

# === その他 ===
export SES_SENDER_EMAIL="shinodak@lxio.co.jp"
export BEDROCK_MODEL_ID="anthropic.claude-3-sonnet-20240229-v1:0"
export DYNAMODB_PREFIX="${PROJECT_NAME}-${OWNER}"
export S3_BUCKET="${PROJECT_NAME}-${OWNER}-config-${AWS_ACCOUNT_ID}"
export ECR_REPO="${PROJECT_NAME}-${OWNER}"
export ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
export APP_RUNNER_SERVICE="${PROJECT_NAME}-${OWNER}-${ENVIRONMENT}"
export DAILY_REPORT_LAMBDA="${PROJECT_NAME}-${OWNER}-daily-report"

# 内部認証シークレット生成
export INTERNAL_AUTH_SECRET=$(openssl rand -hex 32)

# バリデーション
if [ -z "${COGNITO_MANAGER_POOL_ID}" ] || [ -z "${COGNITO_MANAGER_CLIENT_ID}" ]; then
  echo "エラー: COGNITO_MANAGER_POOL_ID と COGNITO_MANAGER_CLIENT_ID を設定してください"
  echo "01-setup-aws-resources.sh の出力を確認してください"
  exit 1
fi


# =============================================================
# Step 8: App Runner サービス作成
# =============================================================
echo "=========================================="
echo "  Step 8: App Runner サービス作成"
echo "=========================================="

INSTANCE_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT_NAME}-${OWNER}-instance-role"
ECR_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT_NAME}-${OWNER}-ecr-access-role"

# ECR にイメージが存在するか確認
echo "Checking ECR image..."
aws ecr describe-images \
  --repository-name ${ECR_REPO} \
  --image-ids imageTag=latest \
  --query 'imageDetails[0].imagePushedAt' \
  --output text 2>/dev/null || {
    echo "エラー: ECR に latest イメージがありません"
    echo "先に Docker イメージを push してください:"
    echo "  docker build -t ${ECR_REPO}:latest -f docker/Dockerfile ."
    echo "  docker tag ${ECR_REPO}:latest ${ECR_URI}:latest"
    echo "  docker push ${ECR_URI}:latest"
    exit 1
  }

echo "Creating App Runner service..."
aws apprunner create-service \
  --service-name ${APP_RUNNER_SERVICE} \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "'"${ECR_URI}:latest"'",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8000",
        "RuntimeEnvironmentVariables": {
          "ENVIRONMENT": "'"${ENVIRONMENT}"'",
          "AWS_REGION": "'"${AWS_REGION}"'",
          "COGNITO_TARGET_POOL_ID": "'"${ELMI_TARGET_POOL_ID}"'",
          "COGNITO_MANAGER_POOL_ID": "'"${COGNITO_MANAGER_POOL_ID}"'",
          "COGNITO_MANAGER_CLIENT_ID": "'"${COGNITO_MANAGER_CLIENT_ID}"'",
          "DYNAMODB_TABLE_PREFIX": "'"${DYNAMODB_PREFIX}"'",
          "S3_CONFIG_BUCKET": "'"${S3_BUCKET}"'",
          "BEDROCK_MODEL_ID": "'"${BEDROCK_MODEL_ID}"'",
          "SES_SENDER_EMAIL": "'"${SES_SENDER_EMAIL}"'",
          "ELMI_API_ENDPOINT": "'"${ELMI_API_ENDPOINT}"'",
          "INTERNAL_AUTH_SECRET": "'"${INTERNAL_AUTH_SECRET}"'"
        }
      }
    },
    "AutoDeploymentsEnabled": false,
    "AuthenticationConfiguration": {
      "AccessRoleArn": "'"${ECR_ROLE_ARN}"'"
    }
  }' \
  --instance-configuration '{
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB",
    "InstanceRoleArn": "'"${INSTANCE_ROLE_ARN}"'"
  }' \
  --health-check-configuration '{
    "Protocol": "HTTP",
    "Path": "/api/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }' \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER}

echo ""
echo "App Runner サービス作成中... (3-5分かかります)"
echo "以下のコマンドで状態確認:"
echo "  aws apprunner list-services --query \"ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}']\" --output table"
echo ""
echo "RUNNING になったら次のステップに進んでください。"
echo ""

# URL 取得を試みる（まだ RUNNING でない可能性あり）
sleep 10
export APP_URL=$(aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}'].ServiceUrl" \
  --output text 2>/dev/null || echo "")

if [ -n "${APP_URL}" ] && [ "${APP_URL}" != "None" ]; then
  echo "App URL: https://${APP_URL}"
else
  echo "URL はサービスが RUNNING になったら確認できます"
fi

echo ""
echo "✓ Step 8 完了: App Runner 作成開始"
echo ""


# =============================================================
# Step 9: EventBridge + Lambda（日次レポート）
# =============================================================
echo "=========================================="
echo "  Step 9: Lambda + EventBridge セットアップ"
echo "=========================================="

# 9-1. Lambda 実行ロール
echo "Creating Lambda execution role..."
cat > /tmp/lambda-trust.json << 'TRUST'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
TRUST

aws iam create-role \
  --role-name ${DAILY_REPORT_LAMBDA}-role \
  --assume-role-policy-document file:///tmp/lambda-trust.json \
  --output text --query 'Role.Arn' 2>/dev/null || echo "(既に存在)"

aws iam attach-role-policy \
  --role-name ${DAILY_REPORT_LAMBDA}-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

echo "✓ Lambda role created"

# 9-2. Lambda 関数作成
echo "Creating Lambda function..."
mkdir -p /tmp/lambda-daily-report
cat > /tmp/lambda-daily-report/lambda_function.py << 'LAMBDA'
import json
import os
import urllib.request

def lambda_handler(event, context):
    """EventBridge から起動され、App Runner の日次レポートAPIを叩く。"""
    app_url = os.environ["APP_URL"]
    auth_secret = os.environ["INTERNAL_AUTH_SECRET"]

    url = f"https://{app_url}/api/tasks/daily-report"
    headers = {
        "Content-Type": "application/json",
        "X-Internal-Auth": auth_secret,
    }

    req = urllib.request.Request(url, data=b"{}", headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read())

    print(f"Daily report result: {body}")
    return {"statusCode": 200, "body": json.dumps(body)}
LAMBDA

cd /tmp/lambda-daily-report && zip -j /tmp/daily-report.zip lambda_function.py && cd -

LAMBDA_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${DAILY_REPORT_LAMBDA}-role"

# ロールの伝播を待つ
echo "Waiting for IAM role propagation..."
sleep 10

# APP_URL が空の場合はプレースホルダー
LAMBDA_APP_URL="${APP_URL:-PLACEHOLDER_WILL_UPDATE_LATER}"

aws lambda create-function \
  --function-name ${DAILY_REPORT_LAMBDA} \
  --runtime python3.12 \
  --handler lambda_function.lambda_handler \
  --role ${LAMBDA_ROLE_ARN} \
  --zip-file fileb:///tmp/daily-report.zip \
  --timeout 90 \
  --environment "Variables={APP_URL=${LAMBDA_APP_URL},INTERNAL_AUTH_SECRET=${INTERNAL_AUTH_SECRET}}" \
  --tags Project=${PROJECT_NAME},Owner=${OWNER} \
  --output text --query 'FunctionArn' 2>/dev/null || echo "(既に存在)"

echo "✓ Lambda function created"

# 9-3. EventBridge ルール
echo "Creating EventBridge schedule..."
aws events put-rule \
  --name ${PROJECT_NAME}-${OWNER}-daily-report-schedule \
  --schedule-expression "cron(0 0 * * ? *)" \
  --state ENABLED \
  --description "elmi-manager daily improvement report (JST 09:00)" \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER}

LAMBDA_ARN="arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:${DAILY_REPORT_LAMBDA}"

aws events put-targets \
  --rule ${PROJECT_NAME}-${OWNER}-daily-report-schedule \
  --targets "Id=daily-report,Arn=${LAMBDA_ARN}"

aws lambda add-permission \
  --function-name ${DAILY_REPORT_LAMBDA} \
  --statement-id eventbridge-daily-report \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${AWS_REGION}:${AWS_ACCOUNT_ID}:rule/${PROJECT_NAME}-${OWNER}-daily-report-schedule" 2>/dev/null || echo "(permission 既に存在)"

echo "✓ Step 9 完了: Lambda + EventBridge (毎日 JST 09:00)"
echo ""


# =============================================================
# 最終サマリー
# =============================================================
echo ""
echo "=========================================="
echo "  全セットアップ完了"
echo "=========================================="
echo ""
echo "=== 作成済みリソース一覧 ==="
echo "  IAM Roles:"
echo "    - ${PROJECT_NAME}-${OWNER}-instance-role"
echo "    - ${PROJECT_NAME}-${OWNER}-ecr-access-role"
echo "    - ${DAILY_REPORT_LAMBDA}-role"
echo ""
echo "  DynamoDB Tables:"
aws dynamodb list-tables \
  --query "TableNames[?starts_with(@, '${DYNAMODB_PREFIX}')]" \
  --output text | tr '\t' '\n' | sed 's/^/    - /'
echo ""
echo "  Cognito:"
echo "    - Pool: ${COGNITO_MANAGER_POOL_ID}"
echo "    - Client: ${COGNITO_MANAGER_CLIENT_ID}"
echo ""
echo "  S3: ${S3_BUCKET}"
echo "  ECR: ${ECR_URI}"
echo "  App Runner: ${APP_RUNNER_SERVICE}"
echo "  Lambda: ${DAILY_REPORT_LAMBDA}"
echo "  EventBridge: ${PROJECT_NAME}-${OWNER}-daily-report-schedule"
echo ""
echo "=== 環境変数メモ ==="
echo "  COGNITO_MANAGER_POOL_ID=${COGNITO_MANAGER_POOL_ID}"
echo "  COGNITO_MANAGER_CLIENT_ID=${COGNITO_MANAGER_CLIENT_ID}"
echo "  INTERNAL_AUTH_SECRET=${INTERNAL_AUTH_SECRET}"
echo "  ECR_URI=${ECR_URI}"
if [ -n "${APP_URL}" ] && [ "${APP_URL}" != "None" ]; then
  echo "  APP_URL=${APP_URL}"
fi
echo ""
echo "=== 残タスク ==="
echo "  [ ] SES の検証メール内リンクをクリック"
echo "  [ ] Bedrock モデルアクセスをコンソールで有効化"
if [ "${ELMI_API_ENDPOINT}" = "PLACEHOLDER_API_GATEWAY_URL" ]; then
  echo "  [ ] ELMI_API_ENDPOINT を設定（DynamoDB settings テーブル & App Runner 環境変数）"
fi
echo "  [ ] App Runner が RUNNING になったらヘルスチェック:"
echo "      curl https://<APP_URL>/api/health"
echo ""
