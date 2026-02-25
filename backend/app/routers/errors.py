from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from app.models.schemas import (
    ErrorEntryResponse,
    AnalysisResponse,
    UpdateErrorStatusRequest,
)
from app.services.mock_data import MOCK_ERROR_ENTRIES
from app.services.bedrock import bedrock_service

router = APIRouter(prefix="/errors", tags=["errors"])

JST = timezone(timedelta(hours=9))


@router.get("", response_model=list[ErrorEntryResponse])
def list_errors(period: str = Query("7d")):
    """
    エラーログ一覧。
    TODO(AWS): DynamoDB error_analysis テーブルから取得。
    """
    days = {"today": 1, "7d": 7, "30d": 30}.get(period, 7)
    cutoff = (datetime.now(JST) - timedelta(days=days)).isoformat()
    filtered = [e for e in MOCK_ERROR_ENTRIES if e["timestamp"] >= cutoff]
    return [ErrorEntryResponse(**e) for e in filtered]


@router.post("/{error_id}/analyze", response_model=AnalysisResponse)
def analyze_error(error_id: str):
    """
    AI改善提案を生成。
    TODO(AWS): Bedrock Claude で実分析を実行。
    """
    entry = next((e for e in MOCK_ERROR_ENTRIES if e["error_id"] == error_id), None)
    if not entry:
        return AnalysisResponse(analysis="エラーが見つかりません", suggestions=[])

    result = bedrock_service.analyze_error(
        query=entry["natural_language_query"],
        generated_sql=entry["generated_sql"],
        error_message=entry["error_message"],
    )

    # モックデータも更新
    entry["ai_analysis"] = result["analysis"]
    entry["ai_suggestions"] = result["suggestions"]

    return AnalysisResponse(**result)


@router.put("/{error_id}/status")
def update_error_status(error_id: str, req: UpdateErrorStatusRequest):
    """
    エラーの対応ステータスを更新。
    TODO(AWS): DynamoDB の resolution_status を更新。
    """
    for e in MOCK_ERROR_ENTRIES:
        if e["error_id"] == error_id:
            e["resolution_status"] = req.resolution_status
            break
    return {"ok": True}
