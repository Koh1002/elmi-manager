# elmi-manager AWS セットアップ手順書

> 全ステップ AWS CLI ベースで実行可能。
> 変数は冒頭で一括定義し、以降コピペで進められる構成。

---

## 0. 事前準備

### 0-1. 前提条件

- AWS CLI v2 がインストール済み（`aws --version` で確認）
- 適切な IAM 権限を持つプロファイルが設定済み
- Docker がインストール済み（ECR push 用）

### 0-2. 共通変数を設定

**ここを自社環境に合わせて書き換えてから、以降の手順を実行する。**

```bash
# === 基本設定 ===
export AWS_REGION="ap-northeast-1"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export PROJECT_NAME="elmi-manager"
export ENVIRONMENT="production"  # staging | production

# === エルみえる側の既存リソース ===
# エルみえる（管理対象）のCognito User Pool ID
export ELMI_TARGET_POOL_ID="ap-northeast-1_XXXXXXXXX"  # ← 要変更

# エルみえるの API Gateway エンドポイント
export ELMI_API_ENDPOINT="https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod"  # ← 要変更

# === メール設定 ===
export SES_SENDER_EMAIL="noreply@yourdomain.com"       # ← 要変更
export REPORT_RECIPIENT_EMAIL="admin@yourdomain.com"    # ← 要変更

# === Bedrock ===
export BEDROCK_MODEL_ID="anthropic.claude-3-sonnet-20240229-v1:0"

# === 作成者識別 ===
export OWNER="shinoda"

# === 自動生成される名前（OWNER が含まれる） ===
export ECR_REPO="${PROJECT_NAME}-${OWNER}"
export APP_RUNNER_SERVICE="${PROJECT_NAME}-${OWNER}-${ENVIRONMENT}"
export DYNAMODB_PREFIX="${PROJECT_NAME}-${OWNER}"
export S3_BUCKET="${PROJECT_NAME}-${OWNER}-config-${AWS_ACCOUNT_ID}"
export COGNITO_MANAGER_POOL="${PROJECT_NAME}-${OWNER}-auth"
export DAILY_REPORT_LAMBDA="${PROJECT_NAME}-${OWNER}-daily-report"
```

### 0-3. 変数の確認

```bash
echo "=== 設定確認 ==="
echo "AWS Account: ${AWS_ACCOUNT_ID}"
echo "Region:      ${AWS_REGION}"
echo "Owner:       ${OWNER}"
echo "Target Pool: ${ELMI_TARGET_POOL_ID}"
echo "Sender:      ${SES_SENDER_EMAIL}"
echo ""
echo "=== リソース名 ==="
echo "IAM Role:    ${PROJECT_NAME}-${OWNER}-instance-role"
echo "DynamoDB:    ${DYNAMODB_PREFIX}-*"
echo "S3 Bucket:   ${S3_BUCKET}"
echo "ECR Repo:    ${ECR_REPO}"
echo "App Runner:  ${APP_RUNNER_SERVICE}"
echo "Lambda:      ${DAILY_REPORT_LAMBDA}"
echo "Cognito:     ${COGNITO_MANAGER_POOL}"
```

---

## 1. IAM ロール作成

App Runner のサービスが使う IAM ロール。Cognito / DynamoDB / Bedrock / SES / S3 へのアクセスを許可。

### 1-1. App Runner インスタンスロール（タスク実行用）

```bash
# 信頼ポリシー
cat > /tmp/apprunner-trust.json << 'TRUST'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "tasks.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
TRUST

# ロール作成
aws iam create-role \
  --role-name ${PROJECT_NAME}-${OWNER}-instance-role \
  --assume-role-policy-document file:///tmp/apprunner-trust.json \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER}

# アクセスポリシー
cat > /tmp/apprunner-policy.json << POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CognitoAdmin",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminDeleteUser",
        "cognito-idp:AdminDisableUser",
        "cognito-idp:AdminEnableUser",
        "cognito-idp:AdminResetUserPassword",
        "cognito-idp:AdminGetUser",
        "cognito-idp:ListUsers"
      ],
      "Resource": "arn:aws:cognito-idp:${AWS_REGION}:${AWS_ACCOUNT_ID}:userpool/${ELMI_TARGET_POOL_ID}"
    },
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:${AWS_REGION}:${AWS_ACCOUNT_ID}:table/${DYNAMODB_PREFIX}-*"
    },
    {
      "Sid": "Bedrock",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:${AWS_REGION}::foundation-model/${BEDROCK_MODEL_ID}"
    },
    {
      "Sid": "SES",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ses:FromAddress": "${SES_SENDER_EMAIL}"
        }
      }
    },
    {
      "Sid": "S3Config",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::${S3_BUCKET}",
        "arn:aws:s3:::${S3_BUCKET}/*"
      ]
    }
  ]
}
POLICY

aws iam put-role-policy \
  --role-name ${PROJECT_NAME}-${OWNER}-instance-role \
  --policy-name ${PROJECT_NAME}-${OWNER}-access \
  --policy-document file:///tmp/apprunner-policy.json
```

### 1-2. App Runner ECR アクセスロール

```bash
cat > /tmp/apprunner-ecr-trust.json << 'TRUST'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "build.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
TRUST

aws iam create-role \
  --role-name ${PROJECT_NAME}-${OWNER}-ecr-access-role \
  --assume-role-policy-document file:///tmp/apprunner-ecr-trust.json

aws iam attach-role-policy \
  --role-name ${PROJECT_NAME}-${OWNER}-ecr-access-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
```

---

## 2. DynamoDB テーブル作成

4つのテーブルを作成する。

### 2-1. usage_logs（利用ログ）

```bash
aws dynamodb create-table \
  --table-name ${DYNAMODB_PREFIX}-usage-logs \
  --attribute-definitions \
    AttributeName=log_id,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
    AttributeName=user_id,AttributeType=S \
    AttributeName=status,AttributeType=S \
  --key-schema \
    AttributeName=log_id,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "timestamp-index",
        "KeySchema": [{"AttributeName":"timestamp","KeyType":"HASH"}],
        "Projection": {"ProjectionType":"ALL"}
      },
      {
        "IndexName": "user-index",
        "KeySchema": [
          {"AttributeName":"user_id","KeyType":"HASH"},
          {"AttributeName":"timestamp","KeyType":"RANGE"}
        ],
        "Projection": {"ProjectionType":"ALL"}
      },
      {
        "IndexName": "status-index",
        "KeySchema": [
          {"AttributeName":"status","KeyType":"HASH"},
          {"AttributeName":"timestamp","KeyType":"RANGE"}
        ],
        "Projection": {"ProjectionType":"ALL"}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER}

echo "Waiting for usage-logs table..."
aws dynamodb wait table-exists --table-name ${DYNAMODB_PREFIX}-usage-logs
```

### 2-2. error_analysis（エラー分析）

```bash
aws dynamodb create-table \
  --table-name ${DYNAMODB_PREFIX}-error-analysis \
  --attribute-definitions \
    AttributeName=error_id,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
    AttributeName=resolution_status,AttributeType=S \
  --key-schema \
    AttributeName=error_id,KeyType=HASH \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "timestamp-index",
        "KeySchema": [{"AttributeName":"timestamp","KeyType":"HASH"}],
        "Projection": {"ProjectionType":"ALL"}
      },
      {
        "IndexName": "status-index",
        "KeySchema": [
          {"AttributeName":"resolution_status","KeyType":"HASH"},
          {"AttributeName":"timestamp","KeyType":"RANGE"}
        ],
        "Projection": {"ProjectionType":"ALL"}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER}

aws dynamodb wait table-exists --table-name ${DYNAMODB_PREFIX}-error-analysis
```

### 2-3. test_cases + test_runs（テスト管理）

```bash
# テストケース
aws dynamodb create-table \
  --table-name ${DYNAMODB_PREFIX}-test-cases \
  --attribute-definitions \
    AttributeName=test_id,AttributeType=S \
  --key-schema \
    AttributeName=test_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER}

aws dynamodb wait table-exists --table-name ${DYNAMODB_PREFIX}-test-cases

# テスト実行履歴
aws dynamodb create-table \
  --table-name ${DYNAMODB_PREFIX}-test-runs \
  --attribute-definitions \
    AttributeName=test_id,AttributeType=S \
    AttributeName=created_at,AttributeType=S \
    AttributeName=batch_id,AttributeType=S \
  --key-schema \
    AttributeName=test_id,KeyType=HASH \
    AttributeName=created_at,KeyType=RANGE \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "batch-index",
        "KeySchema": [
          {"AttributeName":"batch_id","KeyType":"HASH"},
          {"AttributeName":"created_at","KeyType":"RANGE"}
        ],
        "Projection": {"ProjectionType":"ALL"}
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER}

aws dynamodb wait table-exists --table-name ${DYNAMODB_PREFIX}-test-runs
```

### 2-4. settings（アプリ設定）

```bash
aws dynamodb create-table \
  --table-name ${DYNAMODB_PREFIX}-settings \
  --attribute-definitions \
    AttributeName=setting_key,AttributeType=S \
  --key-schema \
    AttributeName=setting_key,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER}

aws dynamodb wait table-exists --table-name ${DYNAMODB_PREFIX}-settings

# 初期設定を投入
aws dynamodb put-item \
  --table-name ${DYNAMODB_PREFIX}-settings \
  --item '{
    "setting_key": {"S": "app_config"},
    "email_enabled": {"BOOL": true},
    "email_recipient": {"S": "'"${REPORT_RECIPIENT_EMAIL}"'"},
    "email_send_time": {"S": "09:00"},
    "cognito_user_pool_id": {"S": "'"${ELMI_TARGET_POOL_ID}"'"},
    "aws_region": {"S": "'"${AWS_REGION}"'"},
    "elmi_api_endpoint": {"S": "'"${ELMI_API_ENDPOINT}"'"}
  }'
```

### 2-5. テーブル作成の確認

```bash
echo "=== DynamoDB Tables ==="
aws dynamodb list-tables --query "TableNames[?starts_with(@, '${DYNAMODB_PREFIX}')]" --output table
```

---

## 3. Cognito ユーザープール作成（elmi-manager 管理者認証用）

エルみえるの User Pool とは別に、**elmi-manager 自体のログイン認証用**の User Pool を作成。

```bash
# User Pool 作成
POOL_RESULT=$(aws cognito-idp create-user-pool \
  --pool-name ${COGNITO_MANAGER_POOL} \
  --auto-verified-attributes email \
  --username-attributes email \
  --password-policy '{
    "MinimumLength": 12,
    "RequireUppercase": true,
    "RequireLowercase": true,
    "RequireNumbers": true,
    "RequireSymbols": false,
    "TemporaryPasswordValidityDays": 7
  }' \
  --schema '[
    {"Name":"email","Required":true,"Mutable":true}
  ]' \
  --mfa-configuration OFF \
  --user-pool-tags Project=${PROJECT_NAME},Owner=${OWNER} \
  --query 'UserPool.Id' \
  --output text)

export COGNITO_MANAGER_POOL_ID="${POOL_RESULT}"
echo "Manager User Pool ID: ${COGNITO_MANAGER_POOL_ID}"

# App Client 作成（SRP 認証フロー）
CLIENT_RESULT=$(aws cognito-idp create-user-pool-client \
  --user-pool-id ${COGNITO_MANAGER_POOL_ID} \
  --client-name ${PROJECT_NAME}-${OWNER}-web \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --prevent-user-existence-errors ENABLED \
  --access-token-validity 1 \
  --id-token-validity 1 \
  --refresh-token-validity 30 \
  --token-validity-units '{
    "AccessToken": "hours",
    "IdToken": "hours",
    "RefreshToken": "days"
  }' \
  --query 'UserPoolClient.ClientId' \
  --output text)

export COGNITO_MANAGER_CLIENT_ID="${CLIENT_RESULT}"
echo "Manager Client ID: ${COGNITO_MANAGER_CLIENT_ID}"

# 初期管理者ユーザー作成
aws cognito-idp admin-create-user \
  --user-pool-id ${COGNITO_MANAGER_POOL_ID} \
  --username ${REPORT_RECIPIENT_EMAIL} \
  --user-attributes Name=email,Value=${REPORT_RECIPIENT_EMAIL} Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS

echo ""
echo "=== Cognito Setup Complete ==="
echo "Pool ID:   ${COGNITO_MANAGER_POOL_ID}"
echo "Client ID: ${COGNITO_MANAGER_CLIENT_ID}"
echo "Initial user: ${REPORT_RECIPIENT_EMAIL} (仮PW: TempPass123!)"
```

---

## 4. S3 バケット作成（設定ファイル管理用）

```bash
aws s3api create-bucket \
  --bucket ${S3_BUCKET} \
  --region ${AWS_REGION} \
  --create-bucket-configuration LocationConstraint=${AWS_REGION}

# バージョニング有効化（設定ファイルの変更履歴を保持）
aws s3api put-bucket-versioning \
  --bucket ${S3_BUCKET} \
  --versioning-configuration Status=Enabled

# パブリックアクセスブロック
aws s3api put-public-access-block \
  --bucket ${S3_BUCKET} \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# タグ付け
aws s3api put-bucket-tagging \
  --bucket ${S3_BUCKET} \
  --tagging "TagSet=[{Key=Project,Value=${PROJECT_NAME}},{Key=Owner,Value=${OWNER}}]"

echo "S3 Bucket: ${S3_BUCKET}"
```

---

## 5. SES セットアップ（メール送信）

### 5-1. メールアドレス検証

```bash
# 送信元メールアドレスを検証
aws ses verify-email-identity \
  --email-address ${SES_SENDER_EMAIL} \
  --region ${AWS_REGION}

echo "検証メールが ${SES_SENDER_EMAIL} に送信されました。"
echo "メール内のリンクをクリックして検証を完了してください。"
```

### 5-2. 検証状態の確認

```bash
# 検証メール内のリンクをクリック後に実行
aws ses get-identity-verification-attributes \
  --identities ${SES_SENDER_EMAIL} \
  --region ${AWS_REGION} \
  --query "VerificationAttributes.\"${SES_SENDER_EMAIL}\".VerificationStatus" \
  --output text
# "Success" が表示されればOK
```

### 5-3. SES サンドボックス解除（本番運用時）

```bash
# 本番で任意のアドレスに送信する場合、サンドボックス解除が必要。
# コンソールから申請するか、以下で確認:
aws ses get-account \
  --region ${AWS_REGION} \
  --query 'EnforcementStatus' \
  --output text 2>/dev/null || echo "ses v1: use console to check sandbox status"

# サンドボックス中は受信者もverifyが必要:
aws ses verify-email-identity \
  --email-address ${REPORT_RECIPIENT_EMAIL} \
  --region ${AWS_REGION}
```

---

## 6. Bedrock モデルアクセス有効化

```bash
# Bedrock のモデルアクセスはコンソールでの有効化が必要。
# CLI では現在のステータスを確認可能:
aws bedrock get-foundation-model \
  --model-identifier ${BEDROCK_MODEL_ID} \
  --region ${AWS_REGION} \
  --query 'modelDetails.{name:modelName,status:modelLifecycle.status}' \
  --output table

echo ""
echo "=== Bedrock 手動設定が必要 ==="
echo "1. AWS Console → Amazon Bedrock → Model access"
echo "2. 'Manage model access' をクリック"
echo "3. Anthropic > Claude 3 Sonnet にチェック"
echo "4. 'Save changes'"
echo ""
echo "確認コマンド:"
echo "  aws bedrock list-foundation-models --region ${AWS_REGION} --by-provider Anthropic --query 'modelSummaries[].modelId'"
```

---

## 7. ECR リポジトリ作成 & Docker イメージ push

### 7-1. ECR リポジトリ作成

```bash
aws ecr create-repository \
  --repository-name ${ECR_REPO} \
  --region ${AWS_REGION} \
  --image-scanning-configuration scanOnPush=true \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER}

export ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
echo "ECR URI: ${ECR_URI}"
```

### 7-2. Docker イメージをビルド & push

```bash
# ECR にログイン
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# フロントエンドをビルドしてバックエンドに同梱
cd frontend && npm ci && npm run build && cd ..
mkdir -p backend/static
cp -r frontend/dist/* backend/static/

# Docker イメージビルド
docker build -t ${ECR_REPO}:latest -f docker/Dockerfile .

# タグ付け & push
docker tag ${ECR_REPO}:latest ${ECR_URI}:latest
docker push ${ECR_URI}:latest

echo "Image pushed: ${ECR_URI}:latest"
```

---

## 8. App Runner サービス作成

### 8-1. サービス作成

```bash
INSTANCE_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT_NAME}-${OWNER}-instance-role"
ECR_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT_NAME}-${OWNER}-ecr-access-role"

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
          "INTERNAL_AUTH_SECRET": "'"$(openssl rand -hex 32)"'"
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

echo "App Runner サービス作成中... (数分かかります)"
```

### 8-2. デプロイ完了待ち & URL取得

```bash
# サービスの状態を確認（RUNNING になるまで待つ）
aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}'].{Status:Status,URL:ServiceUrl}" \
  --output table

# URL取得
export APP_URL=$(aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}'].ServiceUrl" \
  --output text)
echo "App URL: https://${APP_URL}"

# ヘルスチェック
curl -s "https://${APP_URL}/api/health" | python3 -m json.tool
```

---

## 9. EventBridge + Lambda（日次レポートスケジューラ）

### 9-1. Lambda 実行ロール

```bash
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
  --assume-role-policy-document file:///tmp/lambda-trust.json

aws iam attach-role-policy \
  --role-name ${DAILY_REPORT_LAMBDA}-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 9-2. Lambda 関数作成

```bash
# Lambda コードを作成
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

# ZIP 化
cd /tmp/lambda-daily-report && zip -j /tmp/daily-report.zip lambda_function.py && cd -

# INTERNAL_AUTH_SECRET を取得（App Runner作成時に生成した値）
# 既にメモしていない場合は以下で確認:
INTERNAL_SECRET=$(aws apprunner describe-service \
  --service-arn $(aws apprunner list-services \
    --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}'].ServiceArn" \
    --output text) \
  --query "Service.SourceConfiguration.ImageRepository.ImageConfiguration.RuntimeEnvironmentVariables.INTERNAL_AUTH_SECRET" \
  --output text 2>/dev/null || echo "MANUAL_INPUT_REQUIRED")

LAMBDA_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${DAILY_REPORT_LAMBDA}-role"

# 10秒待ってロールの伝播を待つ
sleep 10

aws lambda create-function \
  --function-name ${DAILY_REPORT_LAMBDA} \
  --runtime python3.12 \
  --handler lambda_function.lambda_handler \
  --role ${LAMBDA_ROLE_ARN} \
  --zip-file fileb:///tmp/daily-report.zip \
  --timeout 90 \
  --environment "Variables={APP_URL=${APP_URL},INTERNAL_AUTH_SECRET=${INTERNAL_SECRET}}" \
  --tags Project=${PROJECT_NAME}
```

### 9-3. EventBridge ルール（毎日 JST 09:00 = UTC 00:00）

```bash
aws events put-rule \
  --name ${PROJECT_NAME}-${OWNER}-daily-report-schedule \
  --schedule-expression "cron(0 0 * * ? *)" \
  --state ENABLED \
  --description "elmi-manager daily improvement report (JST 09:00)" \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER}

# Lambda を EventBridge のターゲットに設定
LAMBDA_ARN="arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:${DAILY_REPORT_LAMBDA}"

aws events put-targets \
  --rule ${PROJECT_NAME}-${OWNER}-daily-report-schedule \
  --targets "Id=daily-report,Arn=${LAMBDA_ARN}"

# EventBridge が Lambda を呼べるように権限付与
aws lambda add-permission \
  --function-name ${DAILY_REPORT_LAMBDA} \
  --statement-id eventbridge-daily-report \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${AWS_REGION}:${AWS_ACCOUNT_ID}:rule/${PROJECT_NAME}-${OWNER}-daily-report-schedule"

echo "Daily report scheduled: JST 09:00 (UTC 00:00)"
```

---

## 10. 動作確認

### 10-1. 全サービスの状態確認

```bash
echo "=== 1. DynamoDB Tables ==="
aws dynamodb list-tables \
  --query "TableNames[?starts_with(@, '${DYNAMODB_PREFIX}')]" \
  --output table

echo ""
echo "=== 2. Cognito User Pools ==="
aws cognito-idp describe-user-pool \
  --user-pool-id ${COGNITO_MANAGER_POOL_ID} \
  --query "UserPool.{Name:Name,Id:Id,Status:Status}" \
  --output table 2>/dev/null || echo "Pool ID not set"

echo ""
echo "=== 3. S3 Bucket ==="
aws s3api head-bucket --bucket ${S3_BUCKET} 2>/dev/null && echo "OK: ${S3_BUCKET}" || echo "MISSING"

echo ""
echo "=== 4. SES Verification ==="
aws ses get-identity-verification-attributes \
  --identities ${SES_SENDER_EMAIL} \
  --query "VerificationAttributes.*.VerificationStatus" \
  --output text

echo ""
echo "=== 5. ECR Repository ==="
aws ecr describe-repositories \
  --repository-names ${ECR_REPO} \
  --query "repositories[0].repositoryUri" \
  --output text 2>/dev/null || echo "NOT CREATED"

echo ""
echo "=== 6. App Runner ==="
aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}'].{Status:Status,URL:ServiceUrl}" \
  --output table

echo ""
echo "=== 7. Lambda ==="
aws lambda get-function \
  --function-name ${DAILY_REPORT_LAMBDA} \
  --query "Configuration.{State:State,Runtime:Runtime}" \
  --output table 2>/dev/null || echo "NOT CREATED"

echo ""
echo "=== 8. EventBridge Rule ==="
aws events describe-rule \
  --name ${PROJECT_NAME}-${OWNER}-daily-report-schedule \
  --query "{State:State,Schedule:ScheduleExpression}" \
  --output table 2>/dev/null || echo "NOT CREATED"
```

### 10-2. API エンドポイントテスト

```bash
BASE="https://${APP_URL}"

echo "--- Health ---"
curl -s "${BASE}/api/health" | python3 -m json.tool

echo "--- Dashboard ---"
curl -s "${BASE}/api/dashboard?period=7d" | python3 -m json.tool | head -10

echo "--- Users ---"
curl -s "${BASE}/api/users" | python3 -m json.tool | head -5

echo "--- Settings ---"
curl -s "${BASE}/api/settings" | python3 -m json.tool
```

### 10-3. 日次レポートの手動テスト

```bash
# Lambda を直接起動して動作確認
aws lambda invoke \
  --function-name ${DAILY_REPORT_LAMBDA} \
  --payload '{}' \
  /tmp/lambda-output.json

cat /tmp/lambda-output.json | python3 -m json.tool
```

---

## 11. デプロイ更新手順（日常運用）

コード変更後の再デプロイ:

```bash
# 1. フロントエンドビルド
cd frontend && npm ci && npm run build && cd ..
cp -r frontend/dist/* backend/static/

# 2. Docker ビルド & push
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

docker build -t ${ECR_REPO}:latest -f docker/Dockerfile .
docker tag ${ECR_REPO}:latest ${ECR_URI}:latest
docker push ${ECR_URI}:latest

# 3. App Runner 更新デプロイ
SERVICE_ARN=$(aws apprunner list-services \
  --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}'].ServiceArn" \
  --output text)

aws apprunner start-deployment --service-arn ${SERVICE_ARN}

echo "Deployment started. Check status:"
echo "  aws apprunner describe-service --service-arn ${SERVICE_ARN} --query 'Service.Status'"
```

---

## 12. リソース削除（環境破棄時）

```bash
echo "!!! 以下のコマンドはすべてのリソースを削除します !!!"
echo "実行する場合はコメントアウトを外してください"

# --- App Runner ---
# SERVICE_ARN=$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}'].ServiceArn" --output text)
# aws apprunner delete-service --service-arn ${SERVICE_ARN}

# --- Lambda & EventBridge ---
# aws events remove-targets --rule ${PROJECT_NAME}-${OWNER}-daily-report-schedule --ids daily-report
# aws events delete-rule --name ${PROJECT_NAME}-${OWNER}-daily-report-schedule
# aws lambda delete-function --function-name ${DAILY_REPORT_LAMBDA}

# --- DynamoDB ---
# for table in usage-logs error-analysis test-cases test-runs settings; do
#   aws dynamodb delete-table --table-name ${DYNAMODB_PREFIX}-${table}
# done

# --- Cognito ---
# aws cognito-idp delete-user-pool --user-pool-id ${COGNITO_MANAGER_POOL_ID}

# --- S3 ---
# aws s3 rb s3://${S3_BUCKET} --force

# --- ECR ---
# aws ecr delete-repository --repository-name ${ECR_REPO} --force

# --- IAM ---
# aws iam delete-role-policy --role-name ${PROJECT_NAME}-${OWNER}-instance-role --policy-name ${PROJECT_NAME}-${OWNER}-access
# aws iam delete-role --role-name ${PROJECT_NAME}-${OWNER}-instance-role
# aws iam detach-role-policy --role-name ${PROJECT_NAME}-${OWNER}-ecr-access-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
# aws iam delete-role --role-name ${PROJECT_NAME}-${OWNER}-ecr-access-role
# aws iam detach-role-policy --role-name ${DAILY_REPORT_LAMBDA}-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
# aws iam delete-role --role-name ${DAILY_REPORT_LAMBDA}-role
```

---

## クイックリファレンス: TODO(AWS) → 対応ステップ対照表

| TODO(AWS) の場所 | 対応セクション | 必要なAWSリソース |
|---|---|---|
| `services/cognito.py` - 実API呼び出し | §1 IAMロール, §3 Cognito | Cognito User Pool |
| `services/bedrock.py` - InvokeModel | §1 IAMロール, §6 Bedrock | Bedrock model access |
| `services/ses.py` - 実メール送信 | §1 IAMロール, §5 SES | SES verified identity |
| `routers/*.py` - DynamoDB 切替 | §2 DynamoDB | DynamoDB tables |
| `main.py` - JWT認証ミドルウェア | §3 Cognito | Cognito Pool + Client |
| `main.py` - EventBridge連携 | §9 EventBridge+Lambda | Lambda + EB rule |
| `api/client.ts` - Authorization header | §3 Cognito | Client ID |
| `App.tsx` - ログイン画面/認証ガード | §3 Cognito | Pool ID + Client ID |
| `config.py` - 環境変数 | §8 App Runner | All above |
| `docker-compose.yml` - AWS設定 | §0-2 変数 | All above |
