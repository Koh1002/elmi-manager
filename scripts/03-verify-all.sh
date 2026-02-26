#!/bin/bash
# =============================================================
# elmi-manager 全リソース動作確認スクリプト
# 作成者: shinoda
# =============================================================

set -uo pipefail

export AWS_REGION="ap-northeast-1"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export PROJECT_NAME="elmi-manager"
export OWNER="shinoda"
export DYNAMODB_PREFIX="${PROJECT_NAME}-${OWNER}"
export ECR_REPO="${PROJECT_NAME}-${OWNER}"
export APP_RUNNER_SERVICE="${PROJECT_NAME}-${OWNER}-production"
export DAILY_REPORT_LAMBDA="${PROJECT_NAME}-${OWNER}-daily-report"
export S3_BUCKET="${PROJECT_NAME}-${OWNER}-config-${AWS_ACCOUNT_ID}"
export SES_SENDER_EMAIL="shinodak@lxio.co.jp"

PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"
  if [ $? -eq 0 ] && [ -n "$result" ] && [ "$result" != "None" ]; then
    echo "  ✓ ${label}: ${result}"
    PASS=$((PASS + 1))
  else
    echo "  ✗ ${label}: FAILED"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "=========================================="
echo "  elmi-manager 全リソース確認"
echo "=========================================="
echo ""

echo "--- 1. DynamoDB Tables ---"
for table in usage-logs error-analysis test-cases test-runs settings; do
  RESULT=$(aws dynamodb describe-table --table-name ${DYNAMODB_PREFIX}-${table} --query 'Table.TableStatus' --output text 2>/dev/null || echo "")
  check "${DYNAMODB_PREFIX}-${table}" "${RESULT}"
done

echo ""
echo "--- 2. Cognito ---"
# manager pool を検索
POOLS=$(aws cognito-idp list-user-pools --max-results 60 --query "UserPools[?Name=='${PROJECT_NAME}-${OWNER}-auth'].Id" --output text 2>/dev/null || echo "")
check "Manager Pool" "${POOLS}"

echo ""
echo "--- 3. S3 ---"
S3_RESULT=$(aws s3api head-bucket --bucket ${S3_BUCKET} 2>/dev/null && echo "OK" || echo "")
check "Bucket ${S3_BUCKET}" "${S3_RESULT}"

echo ""
echo "--- 4. SES ---"
SES_RESULT=$(aws ses get-identity-verification-attributes --identities ${SES_SENDER_EMAIL} --query "VerificationAttributes.\"${SES_SENDER_EMAIL}\".VerificationStatus" --output text 2>/dev/null || echo "")
check "SES ${SES_SENDER_EMAIL}" "${SES_RESULT}"

echo ""
echo "--- 5. ECR ---"
ECR_RESULT=$(aws ecr describe-repositories --repository-names ${ECR_REPO} --query 'repositories[0].repositoryUri' --output text 2>/dev/null || echo "")
check "ECR ${ECR_REPO}" "${ECR_RESULT}"

echo ""
echo "--- 6. App Runner ---"
AR_RESULT=$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}'].{Status:Status,URL:ServiceUrl}" --output text 2>/dev/null || echo "")
check "App Runner ${APP_RUNNER_SERVICE}" "${AR_RESULT}"

# ヘルスチェック
APP_URL=$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}'].ServiceUrl" --output text 2>/dev/null || echo "")
if [ -n "${APP_URL}" ] && [ "${APP_URL}" != "None" ]; then
  echo ""
  echo "--- 6a. API Health Check ---"
  HEALTH=$(curl -s "https://${APP_URL}/api/health" 2>/dev/null || echo "")
  check "GET /api/health" "${HEALTH}"
fi

echo ""
echo "--- 7. Lambda ---"
LAMBDA_RESULT=$(aws lambda get-function --function-name ${DAILY_REPORT_LAMBDA} --query 'Configuration.State' --output text 2>/dev/null || echo "")
check "Lambda ${DAILY_REPORT_LAMBDA}" "${LAMBDA_RESULT}"

echo ""
echo "--- 8. EventBridge ---"
EB_RESULT=$(aws events describe-rule --name ${PROJECT_NAME}-${OWNER}-daily-report-schedule --query 'State' --output text 2>/dev/null || echo "")
check "EventBridge rule" "${EB_RESULT}"

echo ""
echo "--- 9. IAM Roles ---"
for role in ${PROJECT_NAME}-${OWNER}-instance-role ${PROJECT_NAME}-${OWNER}-ecr-access-role ${DAILY_REPORT_LAMBDA}-role; do
  IAM_RESULT=$(aws iam get-role --role-name ${role} --query 'Role.RoleName' --output text 2>/dev/null || echo "")
  check "Role ${role}" "${IAM_RESULT}"
done

echo ""
echo "=========================================="
echo "  結果: ✓ ${PASS} passed / ✗ ${FAIL} failed"
echo "=========================================="
echo ""
