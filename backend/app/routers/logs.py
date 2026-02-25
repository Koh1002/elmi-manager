from fastapi import APIRouter, Query

from app.models.schemas import LogListResponse, UsageLogResponse
from app.services.mock_data import MOCK_LOGS

router = APIRouter(prefix="/logs", tags=["logs"])

PAGE_SIZE = 20


@router.get("", response_model=LogListResponse)
def list_logs(
    page: int = Query(1, ge=1),
    status: str | None = None,
    user_id: str | None = None,
    search: str | None = None,
):
    """
    利用ログ一覧。フィルタ・ページネーション対応。
    TODO(AWS): DynamoDB usage_logs テーブルから取得する実装に差し替え。
    """
    filtered = MOCK_LOGS

    if status:
        filtered = [l for l in filtered if l["status"] == status]
    if user_id:
        filtered = [l for l in filtered if l["user_id"] == user_id]
    if search:
        q = search.lower()
        filtered = [
            l
            for l in filtered
            if q in l["natural_language_query"].lower()
        ]

    total = len(filtered)
    start = (page - 1) * PAGE_SIZE
    items = [UsageLogResponse(**l) for l in filtered[start : start + PAGE_SIZE]]

    return LogListResponse(items=items, total=total)


@router.get("/{log_id}", response_model=UsageLogResponse)
def get_log(log_id: str):
    """
    ログ詳細。
    TODO(AWS): DynamoDB から単一レコード取得。
    """
    for log in MOCK_LOGS:
        if log["log_id"] == log_id:
            return UsageLogResponse(**log)
    return UsageLogResponse(
        log_id=log_id,
        timestamp="",
        user_id="",
        user_email="",
        natural_language_query="見つかりません",
        generated_sql="",
        sql_execution_result="",
        response_text="",
        status="error",
        latency_ms=0,
        lambda_request_id="",
    )
