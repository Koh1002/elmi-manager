#!/bin/bash
# =============================================================
# elmi-manager AWS セットアップスクリプト (CloudShell 用)
# 作成者: shinoda
#
# 使い方:
#   1. AWS CloudShell を開く
#   2. このスクリプトの内容をコピペして実行
#   3. 各ステップが順番に実行される
#   4. 途中でエラーが出たら Ctrl+C で中断し、原因を修正して再実行
#
# 注意: 各セクションは独立して再実行可能な設計になっています。
#       途中から再開したい場合は「=== Step X ===" の箇所から実行してください。
# =============================================================

set -euo pipefail

# =============================================================
# Step 0: 変数定義
# =============================================================
echo ""
echo "=========================================="
echo "  Step 0: 変数設定"
echo "=========================================="

export AWS_REGION="ap-northeast-1"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export PROJECT_NAME="elmi-manager"
export ENVIRONMENT="production"
export OWNER="shinoda"

# === エルみえる側の既存リソース ===
export ELMI_TARGET_POOL_ID="ap-northeast-1_tZHC04UVE"
export ELMI_API_ENDPOINT="PLACEHOLDER_API_GATEWAY_URL"  # ← 要変更: エルみえるのAPI Gateway URL

# === メール設定 ===
export SES_SENDER_EMAIL="shinodak@lxio.co.jp"
export REPORT_RECIPIENT_EMAIL="shinodak@lxio.co.jp"

# === Bedrock ===
export BEDROCK_MODEL_ID="anthropic.claude-3-sonnet-20240229-v1:0"

# === 自動生成される名前（OWNER が含まれる） ===
export ECR_REPO="${PROJECT_NAME}-${OWNER}"
export APP_RUNNER_SERVICE="${PROJECT_NAME}-${OWNER}-${ENVIRONMENT}"
export DYNAMODB_PREFIX="${PROJECT_NAME}-${OWNER}"
export S3_BUCKET="${PROJECT_NAME}-${OWNER}-config-${AWS_ACCOUNT_ID}"
export COGNITO_MANAGER_POOL="${PROJECT_NAME}-${OWNER}-auth"
export DAILY_REPORT_LAMBDA="${PROJECT_NAME}-${OWNER}-daily-report"

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
echo ""

# API Gateway URL のチェック
if [ "${ELMI_API_ENDPOINT}" = "PLACEHOLDER_API_GATEWAY_URL" ]; then
  echo "⚠ ELMI_API_ENDPOINT が未設定です。後で設定を更新してください。"
  echo ""
fi

echo "✓ Step 0 完了: 変数設定"
echo ""


# =============================================================
# Step 1: IAM ロール作成
# =============================================================
echo "=========================================="
echo "  Step 1: IAM ロール作成"
echo "=========================================="

# 1-1. App Runner インスタンスロール
echo "Creating App Runner instance role..."
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

aws iam create-role \
  --role-name ${PROJECT_NAME}-${OWNER}-instance-role \
  --assume-role-policy-document file:///tmp/apprunner-trust.json \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER} \
  --output text --query 'Role.Arn' || echo "(既に存在する場合はスキップ)"

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
      "Resource": [
        "arn:aws:dynamodb:${AWS_REGION}:${AWS_ACCOUNT_ID}:table/${DYNAMODB_PREFIX}-*",
        "arn:aws:dynamodb:${AWS_REGION}:${AWS_ACCOUNT_ID}:table/${DYNAMODB_PREFIX}-*/index/*"
      ]
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

echo "✓ Instance role created"

# 1-2. App Runner ECR アクセスロール
echo "Creating ECR access role..."
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
  --assume-role-policy-document file:///tmp/apprunner-ecr-trust.json \
  --output text --query 'Role.Arn' || echo "(既に存在する場合はスキップ)"

aws iam attach-role-policy \
  --role-name ${PROJECT_NAME}-${OWNER}-ecr-access-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess

echo "✓ Step 1 完了: IAM ロール作成"
echo ""


# =============================================================
# Step 2: DynamoDB テーブル作成
# =============================================================
echo "=========================================="
echo "  Step 2: DynamoDB テーブル作成 (5テーブル)"
echo "=========================================="

# 2-1. usage-logs
echo "Creating ${DYNAMODB_PREFIX}-usage-logs..."
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
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER} \
  --output text --query 'TableDescription.TableName' 2>/dev/null || echo "(既に存在)"

# 2-2. error-analysis
echo "Creating ${DYNAMODB_PREFIX}-error-analysis..."
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
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER} \
  --output text --query 'TableDescription.TableName' 2>/dev/null || echo "(既に存在)"

# 2-3. test-cases
echo "Creating ${DYNAMODB_PREFIX}-test-cases..."
aws dynamodb create-table \
  --table-name ${DYNAMODB_PREFIX}-test-cases \
  --attribute-definitions \
    AttributeName=test_id,AttributeType=S \
  --key-schema \
    AttributeName=test_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER} \
  --output text --query 'TableDescription.TableName' 2>/dev/null || echo "(既に存在)"

# 2-4. test-runs
echo "Creating ${DYNAMODB_PREFIX}-test-runs..."
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
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER} \
  --output text --query 'TableDescription.TableName' 2>/dev/null || echo "(既に存在)"

# 2-5. settings
echo "Creating ${DYNAMODB_PREFIX}-settings..."
aws dynamodb create-table \
  --table-name ${DYNAMODB_PREFIX}-settings \
  --attribute-definitions \
    AttributeName=setting_key,AttributeType=S \
  --key-schema \
    AttributeName=setting_key,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER} \
  --output text --query 'TableDescription.TableName' 2>/dev/null || echo "(既に存在)"

# テーブルがACTIVEになるのを待つ
echo "Waiting for tables to become active..."
for table in usage-logs error-analysis test-cases test-runs settings; do
  aws dynamodb wait table-exists --table-name ${DYNAMODB_PREFIX}-${table}
  echo "  ✓ ${DYNAMODB_PREFIX}-${table} ACTIVE"
done

# 初期設定を投入
echo "Inserting initial settings..."
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

echo "✓ Step 2 完了: DynamoDB テーブル作成"
echo ""


# =============================================================
# Step 3: Cognito ユーザープール (elmi-manager 管理者認証用)
# =============================================================
echo "=========================================="
echo "  Step 3: Cognito ユーザープール作成"
echo "=========================================="

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
echo "✓ Manager User Pool ID: ${COGNITO_MANAGER_POOL_ID}"

# App Client 作成
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
echo "✓ Manager Client ID: ${COGNITO_MANAGER_CLIENT_ID}"

# 初期管理者ユーザー作成
aws cognito-idp admin-create-user \
  --user-pool-id ${COGNITO_MANAGER_POOL_ID} \
  --username ${REPORT_RECIPIENT_EMAIL} \
  --user-attributes Name=email,Value=${REPORT_RECIPIENT_EMAIL} Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS \
  --output text --query 'User.Username'

echo "✓ Initial admin user: ${REPORT_RECIPIENT_EMAIL} (仮PW: TempPass123!)"
echo ""
echo "★ 重要: 以下の値をメモしてください ★"
echo "  COGNITO_MANAGER_POOL_ID=${COGNITO_MANAGER_POOL_ID}"
echo "  COGNITO_MANAGER_CLIENT_ID=${COGNITO_MANAGER_CLIENT_ID}"
echo ""
echo "✓ Step 3 完了: Cognito ユーザープール作成"
echo ""


# =============================================================
# Step 4: S3 バケット作成
# =============================================================
echo "=========================================="
echo "  Step 4: S3 バケット作成"
echo "=========================================="

aws s3api create-bucket \
  --bucket ${S3_BUCKET} \
  --region ${AWS_REGION} \
  --create-bucket-configuration LocationConstraint=${AWS_REGION} \
  --output text 2>/dev/null || echo "(既に存在)"

aws s3api put-bucket-versioning \
  --bucket ${S3_BUCKET} \
  --versioning-configuration Status=Enabled

aws s3api put-public-access-block \
  --bucket ${S3_BUCKET} \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-tagging \
  --bucket ${S3_BUCKET} \
  --tagging "TagSet=[{Key=Project,Value=${PROJECT_NAME}},{Key=Owner,Value=${OWNER}}]"

echo "✓ Step 4 完了: S3 Bucket ${S3_BUCKET}"
echo ""


# =============================================================
# Step 5: SES セットアップ
# =============================================================
echo "=========================================="
echo "  Step 5: SES メール検証"
echo "=========================================="

aws ses verify-email-identity \
  --email-address ${SES_SENDER_EMAIL} \
  --region ${AWS_REGION}

echo "検証メールが ${SES_SENDER_EMAIL} に送信されました。"
echo "★ メール内のリンクをクリックして検証を完了してください ★"
echo ""

# サンドボックス中は受信者もverify
if [ "${SES_SENDER_EMAIL}" != "${REPORT_RECIPIENT_EMAIL}" ]; then
  aws ses verify-email-identity \
    --email-address ${REPORT_RECIPIENT_EMAIL} \
    --region ${AWS_REGION}
  echo "受信者メール ${REPORT_RECIPIENT_EMAIL} にも検証メールを送信しました。"
fi

echo "✓ Step 5 完了: SES セットアップ"
echo ""


# =============================================================
# Step 6: Bedrock モデルアクセス確認
# =============================================================
echo "=========================================="
echo "  Step 6: Bedrock モデルアクセス確認"
echo "=========================================="

echo "Bedrock のモデルアクセスはコンソールでの有効化が必要です:"
echo ""
echo "  1. AWS Console → Amazon Bedrock → Model access"
echo "  2. 'Manage model access' をクリック"
echo "  3. Anthropic > Claude 3 Sonnet にチェック"
echo "  4. 'Save changes'"
echo ""
echo "現在のステータス確認:"
aws bedrock get-foundation-model \
  --model-identifier ${BEDROCK_MODEL_ID} \
  --region ${AWS_REGION} \
  --query 'modelDetails.{name:modelName,status:modelLifecycle.status}' \
  --output table 2>/dev/null || echo "  (Bedrock API へのアクセス権限を確認してください)"

echo ""
echo "✓ Step 6 完了: Bedrock 確認（コンソールでの有効化をお忘れなく）"
echo ""


# =============================================================
# Step 7: ECR リポジトリ作成
# =============================================================
echo "=========================================="
echo "  Step 7: ECR リポジトリ作成"
echo "=========================================="

aws ecr create-repository \
  --repository-name ${ECR_REPO} \
  --region ${AWS_REGION} \
  --image-scanning-configuration scanOnPush=true \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Owner,Value=${OWNER} \
  --output text --query 'repository.repositoryUri' 2>/dev/null || echo "(既に存在)"

export ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
echo "✓ Step 7 完了: ECR URI = ${ECR_URI}"
echo ""


# =============================================================
# 完了サマリー
# =============================================================
echo ""
echo "=========================================="
echo "  セットアップ完了サマリー"
echo "=========================================="
echo ""
echo "=== 作成されたリソース ==="

echo ""
echo "--- DynamoDB ---"
aws dynamodb list-tables \
  --query "TableNames[?starts_with(@, '${DYNAMODB_PREFIX}')]" \
  --output table

echo ""
echo "--- Cognito ---"
echo "  Manager Pool ID:   ${COGNITO_MANAGER_POOL_ID}"
echo "  Manager Client ID: ${COGNITO_MANAGER_CLIENT_ID}"
echo "  Target Pool ID:    ${ELMI_TARGET_POOL_ID}"

echo ""
echo "--- S3 ---"
aws s3api head-bucket --bucket ${S3_BUCKET} 2>/dev/null && echo "  ✓ ${S3_BUCKET}" || echo "  ✗ MISSING"

echo ""
echo "--- ECR ---"
echo "  ${ECR_URI}"

echo ""
echo "--- SES ---"
aws ses get-identity-verification-attributes \
  --identities ${SES_SENDER_EMAIL} \
  --query "VerificationAttributes.\"${SES_SENDER_EMAIL}\".VerificationStatus" \
  --output text 2>/dev/null || echo "  検証未完了"

echo ""
echo "=========================================="
echo "  次のステップ"
echo "=========================================="
echo ""
echo "1. SES の検証メール内リンクをクリック"
echo "2. Bedrock モデルアクセスをコンソールで有効化"
echo "3. Docker イメージをビルドして ECR に push:"
echo "   aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI%%/*}"
echo "   docker build -t ${ECR_REPO}:latest -f docker/Dockerfile ."
echo "   docker tag ${ECR_REPO}:latest ${ECR_URI}:latest"
echo "   docker push ${ECR_URI}:latest"
echo ""
echo "4. App Runner サービスを作成 (Step 8 スクリプトを実行)"
echo ""
echo "★ 以下の値をメモしておいてください（App Runner 作成時に必要）★"
echo "  export COGNITO_MANAGER_POOL_ID=${COGNITO_MANAGER_POOL_ID}"
echo "  export COGNITO_MANAGER_CLIENT_ID=${COGNITO_MANAGER_CLIENT_ID}"
echo "  export ECR_URI=${ECR_URI}"
echo ""
