"""
Cognito ユーザー管理サービス。
TODO(AWS): COGNITO_TARGET_POOL_ID を設定後、実APIに切り替え。
"""

import uuid

from app.config import settings
from app.services.mock_data import MOCK_USERS


class CognitoService:
    def __init__(self) -> None:
        # TODO(AWS): 実接続時に有効化
        # import boto3
        # self.client = boto3.client("cognito-idp", region_name=settings.AWS_REGION)
        self.pool_id = settings.COGNITO_TARGET_POOL_ID

    def list_users(self) -> list[dict]:
        """ユーザー一覧を取得。"""
        if not self.pool_id:
            return MOCK_USERS

        # TODO(AWS): 実装
        # response = self.client.list_users(UserPoolId=self.pool_id, Limit=60)
        # return [self._format_user(u) for u in response["Users"]]
        return MOCK_USERS

    def create_user(self, email: str, temporary_password: str) -> dict:
        """新規ユーザーを作成。"""
        if not self.pool_id:
            new_user = {
                "user_id": f"u-{uuid.uuid4().hex[:6]}",
                "email": email,
                "status": "FORCE_CHANGE_PASSWORD",
                "created_at": "2026-02-25T00:00:00+09:00",
                "last_login": None,
            }
            MOCK_USERS.append(new_user)
            return new_user

        # TODO(AWS): 実装
        # self.client.admin_create_user(
        #     UserPoolId=self.pool_id,
        #     Username=email,
        #     TemporaryPassword=temporary_password,
        #     UserAttributes=[{"Name": "email", "Value": email}],
        #     MessageAction="SUPPRESS",
        # )
        raise NotImplementedError("Cognito not configured")

    def toggle_user(self, user_id: str, enabled: bool) -> None:
        """ユーザーの有効/無効を切り替え。"""
        if not self.pool_id:
            for u in MOCK_USERS:
                if u["user_id"] == user_id:
                    u["status"] = "CONFIRMED" if enabled else "DISABLED"
            return

        # TODO(AWS): 実装
        # method = self.client.admin_enable_user if enabled else self.client.admin_disable_user
        # method(UserPoolId=self.pool_id, Username=user_id)
        raise NotImplementedError("Cognito not configured")

    def reset_password(self, user_id: str) -> None:
        """パスワードリセット。"""
        if not self.pool_id:
            return  # mock: 何もしない

        # TODO(AWS): 実装
        # self.client.admin_reset_user_password(
        #     UserPoolId=self.pool_id, Username=user_id
        # )
        raise NotImplementedError("Cognito not configured")


cognito_service = CognitoService()
