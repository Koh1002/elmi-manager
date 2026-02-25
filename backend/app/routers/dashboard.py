from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from app.models.schemas import DashboardResponse, DailyStatResponse, UsageLogResponse
from app.services.mock_data import MOCK_LOGS

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

JST = timezone(timedelta(hours=9))


def _period_days(period: str) -> int:
    return {"today": 1, "7d": 7, "30d": 30}.get(period, 7)


@router.get("", response_model=DashboardResponse)
def get_dashboard(period: str = Query("7d")):
    """
    ダッシュボードサマリーを返す。
    TODO(AWS): DynamoDB usage_logs テーブルから集計する実装に差し替え。
    """
    days = _period_days(period)
    cutoff = datetime.now(JST) - timedelta(days=days)
    cutoff_iso = cutoff.isoformat()

    logs_in_period = [l for l in MOCK_LOGS if l["timestamp"] >= cutoff_iso]
    total = len(logs_in_period)
    success = sum(1 for l in logs_in_period if l["status"] == "success")
    errors = [l for l in logs_in_period if l["status"] != "success"]
    users = set(l["user_id"] for l in logs_in_period)
    avg_lat = (
        sum(l["latency_ms"] for l in logs_in_period) / total if total else 0
    )

    # 日別集計
    daily: dict[str, dict[str, int]] = {}
    for log in logs_in_period:
        d = log["timestamp"][:10]
        if d not in daily:
            daily[d] = {"success": 0, "error": 0, "timeout": 0}
        st = log["status"]
        if st in daily[d]:
            daily[d][st] += 1

    daily_stats = [
        DailyStatResponse(date=d, **counts)
        for d, counts in sorted(daily.items())
    ]

    recent_errors = [UsageLogResponse(**e) for e in errors[:5]]

    return DashboardResponse(
        total_requests=total,
        success_rate=(success / total * 100) if total else 0,
        avg_latency_ms=avg_lat,
        active_users=len(users),
        total_requests_change=12.3,
        success_rate_change=-1.2,
        avg_latency_change=5.1,
        active_users_change=0,
        daily_stats=daily_stats,
        recent_errors=recent_errors,
    )
