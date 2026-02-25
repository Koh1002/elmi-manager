"""
Amazon SES メール送信サービス。
TODO(AWS): SES でメールアドレス/ドメインを検証後に有効化。
"""

from app.config import settings


class SESService:
    def __init__(self) -> None:
        self._client = None

    @property
    def client(self):
        if self._client is None:
            if settings.ENVIRONMENT == "local":
                return None
            # TODO(AWS): 実接続時に有効化
            # import boto3
            # self._client = boto3.client("ses", region_name=settings.AWS_REGION)
        return self._client

    def send_email(self, to: str, subject: str, body_html: str) -> None:
        """メール送信。"""
        if self.client is None:
            # ローカル開発: ログ出力のみ
            print(f"[SES Mock] To: {to}, Subject: {subject}")
            print(f"[SES Mock] Body length: {len(body_html)} chars")
            return

        # TODO(AWS): 実SES送信
        # self.client.send_email(
        #     Source=settings.SES_SENDER_EMAIL,
        #     Destination={"ToAddresses": [to]},
        #     Message={
        #         "Subject": {"Data": subject, "Charset": "UTF-8"},
        #         "Body": {"Html": {"Data": body_html, "Charset": "UTF-8"}},
        #     },
        # )
        raise NotImplementedError("SES not configured")


ses_service = SESService()
