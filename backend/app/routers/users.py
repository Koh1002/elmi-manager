from fastapi import APIRouter

from app.models.schemas import (
    CreateUserRequest,
    UserResponse,
    ToggleUserRequest,
)
from app.services.cognito import cognito_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
def list_users():
    """
    ユーザー一覧を取得。
    TODO(AWS): Cognito AdminListUsers API に接続。
    """
    return cognito_service.list_users()


@router.post("", response_model=UserResponse)
def create_user(req: CreateUserRequest):
    """
    新規ユーザーを作成。
    TODO(AWS): Cognito AdminCreateUser API に接続。
    """
    return cognito_service.create_user(req.email, req.temporary_password)


@router.put("/{user_id}/status")
def toggle_user_status(user_id: str, req: ToggleUserRequest):
    """
    ユーザーの有効/無効を切り替え。
    TODO(AWS): Cognito AdminEnableUser / AdminDisableUser API に接続。
    """
    cognito_service.toggle_user(user_id, req.enabled)
    return {"ok": True}


@router.post("/{user_id}/reset-password")
def reset_password(user_id: str):
    """
    パスワードリセット。
    TODO(AWS): Cognito AdminResetUserPassword API に接続。
    """
    cognito_service.reset_password(user_id)
    return {"ok": True}
