"""
日次改善提案レポート生成タスク。
EventBridge → Lambda → POST /api/tasks/daily-report で起動される。
TODO(AWS): DynamoDB から実ログ取得、Bedrock で実分析、SES で実送信。
"""

from datetime import datetime, timedelta, timezone

from app.services.bedrock import bedrock_service
from app.services.ses import ses_service
from app.services.mock_data import MOCK_ERROR_ENTRIES, MOCK_SETTINGS

JST = timezone(timedelta(hours=9))


def generate_daily_report() -> str:
    """日次レポートを生成してメール送信する。成功時はレポートサマリーを返す。"""

    yesterday = (datetime.now(JST) - timedelta(days=1)).strftime("%Y-%m-%d")

    # TODO(AWS): DynamoDB からyesterdayのエラーログを取得
    errors = [
        e
        for e in MOCK_ERROR_ENTRIES
        if e["timestamp"][:10] == yesterday
    ]

    if not errors:
        return f"No errors found for {yesterday}"

    # 代表的なエラー（最大5件）に対してAI分析
    analyses = []
    for err in errors[:5]:
        result = bedrock_service.analyze_error(
            query=err["natural_language_query"],
            generated_sql=err["generated_sql"],
            error_message=err["error_message"],
        )
        analyses.append({"error": err, "analysis": result})

    # メール本文生成
    error_count = len(errors)
    timeout_count = sum(1 for e in errors if e["error_type"] == "timeout")
    sql_count = sum(1 for e in errors if e["error_type"] == "sql_syntax")

    html_parts = [
        f"<h2>[elmi-manager] 日次改善レポート - {yesterday}</h2>",
        f"<h3>サマリー</h3>",
        f"<ul>",
        f"<li>エラー件数: {error_count}</li>",
        f"<li>タイムアウト: {timeout_count}件</li>",
        f"<li>SQL構文エラー: {sql_count}件</li>",
        f"</ul>",
        f"<h3>改善提案</h3>",
    ]

    for i, item in enumerate(analyses, 1):
        err = item["error"]
        analysis = item["analysis"]
        html_parts.append(
            f"<div style='margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px;'>"
            f"<p><strong>[{i}] {err['error_type']}</strong> - "
            f"「{err['natural_language_query']}」</p>"
            f"<pre style='background:#1e293b;color:#4ade80;padding:8px;border-radius:4px;'>"
            f"{analysis['analysis']}</pre>"
            f"<p><strong>提案:</strong></p><ul>"
        )
        for s in analysis["suggestions"]:
            html_parts.append(f"<li>{s}</li>")
        html_parts.append("</ul></div>")

    body_html = "\n".join(html_parts)
    subject = f"[elmi-manager] 日次改善レポート - {yesterday}"

    recipient = MOCK_SETTINGS.get("email_recipient", "")
    if recipient:
        ses_service.send_email(to=recipient, subject=subject, body_html=body_html)

    return f"Report sent for {yesterday}: {error_count} errors, {len(analyses)} analyzed"
