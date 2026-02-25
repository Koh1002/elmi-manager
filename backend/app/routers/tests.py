import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from app.models.schemas import (
    CreateTestCaseRequest,
    TestCaseResponse,
    TestRunResponse,
    RunAllResponse,
)
from app.services.mock_data import MOCK_TEST_CASES, MOCK_TEST_RUNS

router = APIRouter(prefix="/tests", tags=["tests"])

JST = timezone(timedelta(hours=9))


@router.get("", response_model=list[TestCaseResponse])
def list_test_cases():
    """
    テストケース一覧。
    TODO(AWS): DynamoDB test_cases テーブルから取得。
    """
    return [TestCaseResponse(**tc) for tc in MOCK_TEST_CASES]


@router.post("", response_model=TestCaseResponse)
def create_test_case(req: CreateTestCaseRequest):
    """
    テストケースを新規登録。
    TODO(AWS): DynamoDB に PutItem。
    """
    test_id = f"TC-{len(MOCK_TEST_CASES) + 1:03d}"
    tc = {
        "test_id": test_id,
        "name": req.name,
        "category": req.category,
        "input_query": req.input_query,
        "expected_behavior": req.expected_behavior.model_dump(),
        "tags": req.tags,
        "last_result": None,
        "last_run_at": None,
    }
    MOCK_TEST_CASES.append(tc)
    return TestCaseResponse(**tc)


@router.get("/{test_id}/runs", response_model=list[TestRunResponse])
def list_test_runs(test_id: str):
    """
    テスト実行履歴。
    TODO(AWS): DynamoDB test_runs テーブルから Query。
    """
    runs = MOCK_TEST_RUNS.get(test_id, [])
    return [TestRunResponse(**r) for r in runs]


@router.post("/run-all", response_model=RunAllResponse)
def run_all_tests():
    """
    全テストケースを一括実行。
    TODO(AWS): BackgroundTasks でエルみえるAPIに順次リクエストを投入し、
    結果を DynamoDB test_runs テーブルに記録する。
    現状はモック: 各テストのlast_resultを維持したまま batch_id だけ返す。
    """
    batch_id = f"batch-{uuid.uuid4().hex[:8]}"
    now = datetime.now(JST).isoformat()

    for tc in MOCK_TEST_CASES:
        tc["last_run_at"] = now

    return RunAllResponse(batch_id=batch_id)
