from fastapi import APIRouter

from app.models.schemas import AppSettingsResponse, AppSettingsRequest
from app.services.mock_data import MOCK_SETTINGS
from app.services.ses import ses_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=AppSettingsResponse)
def get_settings():
    """
    アプリ設定を取得。
    TODO(AWS): DynamoDB settings テーブルから取得。
    """
    return AppSettingsResponse(**MOCK_SETTINGS)


@router.put("")
def save_settings(req: AppSettingsRequest):
    """
    アプリ設定を保存。
    TODO(AWS): DynamoDB settings テーブルに PutItem。
    追加で EventBridge ルールの cron 式も更新する。
    """
    MOCK_SETTINGS.update(req.model_dump())
    return {"ok": True}


@router.post("/test-email")
def send_test_email():
    """
    テストメールを送信。
    TODO(AWS): SES で実メール送信。
    """
    ses_service.send_email(
        to=MOCK_SETTINGS["email_recipient"],
        subject="[elmi-manager] テストメール",
        body_html="<p>これはテストメールです。設定が正しく動作しています。</p>",
    )
    return {"ok": True}
