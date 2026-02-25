"""
開発用モックデータ。
AWS連携前のフロントエンド開発・デモ用。
TODO(AWS): 各サービス実装後にこのファイルは不要になる。
"""

import uuid
from datetime import datetime, timedelta, timezone

JST = timezone(timedelta(hours=9))
_now = datetime.now(JST)


def _ts(days_ago: int, hour: int = 14, minute: int = 32) -> str:
    dt = _now - timedelta(days=days_ago)
    return dt.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()


# --- Users ---
MOCK_USERS = [
    {
        "user_id": "u-001",
        "email": "tanaka@example.com",
        "status": "CONFIRMED",
        "created_at": _ts(60),
        "last_login": _ts(0, 10, 15),
    },
    {
        "user_id": "u-002",
        "email": "suzuki@example.com",
        "status": "CONFIRMED",
        "created_at": _ts(45),
        "last_login": _ts(1, 16, 40),
    },
    {
        "user_id": "u-003",
        "email": "sato@example.com",
        "status": "DISABLED",
        "created_at": _ts(30),
        "last_login": _ts(15, 9, 0),
    },
    {
        "user_id": "u-004",
        "email": "yamada@example.com",
        "status": "CONFIRMED",
        "created_at": _ts(10),
        "last_login": _ts(0, 13, 50),
    },
    {
        "user_id": "u-005",
        "email": "shinodak@lxio.co.jp",
        "status": "CONFIRMED",
        "created_at": _ts(90),
        "last_login": _ts(0, 14, 32),
    },
]

# --- Usage Logs ---
_log_templates = [
    {
        "query": "サミットの2024年12月の売上を教えて",
        "sql": "SELECT store_name, SUM(sales_amount) FROM sales_data WHERE brand = 'summit' AND sales_month = '202412' GROUP BY store_name ORDER BY SUM(sales_amount) DESC;",
        "result": "store_name | total_sales\n荻窪店 | ¥12,345,678\n成城店 | ¥11,234,567\n...",
        "response": "サミットの2024年12月の月次売上は全店合計で¥xxx,xxx,xxxでした。荻窪店が最も高く¥12,345,678、次いで成城店の¥11,234,567となっています。",
        "status": "success",
        "latency": 1823,
    },
    {
        "query": "トモズの過去3年間の月次売上推移を出して",
        "sql": "SELECT month, SUM(sales) FROM sales_data WHERE brand='tomods' GROUP BY month ORDER BY month;",
        "result": "",
        "response": "",
        "status": "timeout",
        "latency": 30000,
        "error": "Lambda execution timed out after 30000ms",
    },
    {
        "query": "カテゴリ別粗利を教えて",
        "sql": "SELECT category, SUM(gross_profit) FROM sales_data GROUP BY category;",
        "result": "",
        "response": "",
        "status": "error",
        "latency": 520,
        "error": "Column 'gross_profit' does not exist in table 'sales_data'",
    },
    {
        "query": "先月の売上TOP10店舗を出して",
        "sql": "SELECT store_name, SUM(sales_amount) AS total FROM sales_data WHERE sales_month = '202501' GROUP BY store_name ORDER BY total DESC LIMIT 10;",
        "result": "store_name | total\n渋谷店 | ¥15,678,900\n新宿店 | ¥14,567,800\n...",
        "response": "2025年1月の売上TOP10店舗は以下の通りです。渋谷店が¥15,678,900で首位...",
        "status": "success",
        "latency": 2340,
    },
    {
        "query": "サミット全店の在庫回転率を計算して",
        "sql": "SELECT store_name, SUM(sales_amount) / AVG(inventory_value) AS turnover FROM sales_data JOIN inventory ON ... GROUP BY store_name;",
        "result": "",
        "response": "",
        "status": "error",
        "latency": 890,
        "error": "relation 'inventory' does not exist",
    },
    {
        "query": "前年同月比で売上が下がった店舗を一覧にして",
        "sql": "WITH cur AS (...), prev AS (...) SELECT ... WHERE cur.total < prev.total;",
        "result": "store_name | current | previous | change\n目黒店 | ¥8,900,000 | ¥9,500,000 | -6.3%",
        "response": "前年同月比で売上が下がった店舗は3店舗あります。目黒店が-6.3%で最も大きな減少...",
        "status": "success",
        "latency": 3120,
    },
]

MOCK_LOGS = []
_user_cycle = [MOCK_USERS[0], MOCK_USERS[1], MOCK_USERS[3], MOCK_USERS[4]]
for day in range(30):
    for idx, tmpl in enumerate(_log_templates):
        user = _user_cycle[(day + idx) % len(_user_cycle)]
        log_id = f"log-{day:03d}-{idx:02d}"
        MOCK_LOGS.append(
            {
                "log_id": log_id,
                "timestamp": _ts(day, 10 + idx, idx * 7),
                "user_id": user["user_id"],
                "user_email": user["email"],
                "natural_language_query": tmpl["query"],
                "generated_sql": tmpl["sql"],
                "sql_execution_result": tmpl["result"],
                "response_text": tmpl["response"],
                "status": tmpl["status"],
                "error_message": tmpl.get("error"),
                "latency_ms": tmpl["latency"],
                "lambda_request_id": str(uuid.uuid4())[:8],
            }
        )

MOCK_LOGS.sort(key=lambda x: x["timestamp"], reverse=True)

# --- Errors ---
MOCK_ERRORS = [
    log
    for log in MOCK_LOGS
    if log["status"] in ("error", "timeout")
]
MOCK_ERROR_ENTRIES = []
for err_log in MOCK_ERRORS[:20]:
    error_type = "timeout" if err_log["status"] == "timeout" else "sql_syntax"
    if "does not exist" in (err_log.get("error_message") or ""):
        error_type = "sql_syntax"
    if "relation" in (err_log.get("error_message") or ""):
        error_type = "sql_syntax"

    MOCK_ERROR_ENTRIES.append(
        {
            "error_id": f"err-{err_log['log_id']}",
            "timestamp": err_log["timestamp"],
            "error_type": error_type,
            "natural_language_query": err_log["natural_language_query"],
            "generated_sql": err_log["generated_sql"],
            "error_message": err_log.get("error_message", ""),
            "ai_analysis": None,
            "ai_suggestions": [],
            "resolution_status": "unresolved",
            "source_log_id": err_log["log_id"],
        }
    )

# --- Test Cases ---
MOCK_TEST_CASES = [
    {
        "test_id": "TC-001",
        "name": "サミット月次売上集計",
        "category": "SQL生成",
        "input_query": "サミットの2024年12月の売上を教えて",
        "expected_behavior": {
            "should_not_timeout": True,
            "max_latency_ms": 30000,
            "sql_should_contain": ["SUM", "sales", "202412"],
            "result_should_not_be_empty": True,
        },
        "tags": ["summit", "monthly", "sales"],
        "last_result": "pass",
        "last_run_at": _ts(0),
    },
    {
        "test_id": "TC-002",
        "name": "トモズ3年推移",
        "category": "パフォーマンス",
        "input_query": "トモズの過去3年間の月次売上推移を出して",
        "expected_behavior": {
            "should_not_timeout": True,
            "max_latency_ms": 30000,
            "sql_should_contain": ["month", "tomods"],
            "result_should_not_be_empty": True,
        },
        "tags": ["tomods", "trend"],
        "last_result": "fail",
        "last_run_at": _ts(0),
    },
    {
        "test_id": "TC-003",
        "name": "カテゴリ別粗利",
        "category": "SQL生成",
        "input_query": "カテゴリ別粗利を教えて",
        "expected_behavior": {
            "should_not_timeout": True,
            "max_latency_ms": 30000,
            "sql_should_contain": ["category"],
            "result_should_not_be_empty": True,
        },
        "tags": ["category", "profit"],
        "last_result": "fail",
        "last_run_at": _ts(0),
    },
    {
        "test_id": "TC-004",
        "name": "店舗別売上TOP10",
        "category": "データ抽出",
        "input_query": "先月の売上TOP10店舗を出して",
        "expected_behavior": {
            "should_not_timeout": True,
            "max_latency_ms": 30000,
            "sql_should_contain": ["LIMIT", "ORDER BY"],
            "result_should_not_be_empty": True,
        },
        "tags": ["ranking", "store"],
        "last_result": "pass",
        "last_run_at": _ts(1),
    },
    {
        "test_id": "TC-005",
        "name": "前年同月比較",
        "category": "SQL生成",
        "input_query": "前年同月比で売上が下がった店舗を一覧にして",
        "expected_behavior": {
            "should_not_timeout": True,
            "max_latency_ms": 30000,
            "sql_should_contain": ["WITH"],
            "result_should_not_be_empty": True,
        },
        "tags": ["yoy", "comparison"],
        "last_result": "pass",
        "last_run_at": _ts(1),
    },
]

MOCK_TEST_RUNS: dict[str, list[dict]] = {
    "TC-001": [
        {"run_id": "r1", "test_id": "TC-001", "batch_id": "b1", "status": "pass", "generated_sql": "SELECT ...", "latency_ms": 1800, "validation_results": {"timeout": True, "sql_keywords": True, "not_empty": True}, "ai_analysis": None, "created_at": _ts(0)},
        {"run_id": "r2", "test_id": "TC-001", "batch_id": "b0", "status": "pass", "generated_sql": "SELECT ...", "latency_ms": 1900, "validation_results": {"timeout": True, "sql_keywords": True, "not_empty": True}, "ai_analysis": None, "created_at": _ts(5)},
    ],
    "TC-002": [
        {"run_id": "r3", "test_id": "TC-002", "batch_id": "b1", "status": "fail", "generated_sql": "SELECT month, SUM(sales) FROM sales_data WHERE brand='tomods' GROUP BY month ORDER BY month;", "latency_ms": 30000, "validation_results": {"timeout": False, "sql_keywords": True, "not_empty": False}, "ai_analysis": None, "created_at": _ts(0)},
        {"run_id": "r4", "test_id": "TC-002", "batch_id": "b0", "status": "pass", "generated_sql": "SELECT month, SUM(sales) FROM sales_data WHERE brand='tomods' AND date >= '2022-01' GROUP BY month ORDER BY month;", "latency_ms": 18200, "validation_results": {"timeout": True, "sql_keywords": True, "not_empty": True}, "ai_analysis": None, "created_at": _ts(10)},
    ],
}

# --- Settings ---
MOCK_SETTINGS = {
    "email_enabled": True,
    "email_recipient": "shinodak@lxio.co.jp",
    "email_send_time": "09:00",
    "cognito_user_pool_id": "",
    "aws_region": "ap-northeast-1",
    "elmi_api_endpoint": "",
}
