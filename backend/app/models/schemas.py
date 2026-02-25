"""Pydantic schemas for API request/response models."""

from pydantic import BaseModel


# --- Users ---
class CreateUserRequest(BaseModel):
    email: str
    temporary_password: str


class UserResponse(BaseModel):
    user_id: str
    email: str
    status: str
    created_at: str
    last_login: str | None = None


class ToggleUserRequest(BaseModel):
    enabled: bool


# --- Logs ---
class UsageLogResponse(BaseModel):
    log_id: str
    timestamp: str
    user_id: str
    user_email: str
    natural_language_query: str
    generated_sql: str
    sql_execution_result: str
    response_text: str
    status: str  # success | error | timeout
    error_message: str | None = None
    latency_ms: int
    lambda_request_id: str


class LogListResponse(BaseModel):
    items: list[UsageLogResponse]
    total: int


# --- Dashboard ---
class DailyStatResponse(BaseModel):
    date: str
    success: int
    error: int
    timeout: int


class DashboardResponse(BaseModel):
    total_requests: int
    success_rate: float
    avg_latency_ms: float
    active_users: int
    total_requests_change: float
    success_rate_change: float
    avg_latency_change: float
    active_users_change: float
    daily_stats: list[DailyStatResponse]
    recent_errors: list[UsageLogResponse]


# --- Errors ---
class ErrorEntryResponse(BaseModel):
    error_id: str
    timestamp: str
    error_type: str
    natural_language_query: str
    generated_sql: str
    error_message: str
    ai_analysis: str | None = None
    ai_suggestions: list[str] = []
    resolution_status: str  # unresolved | resolved | ignored
    source_log_id: str


class AnalysisResponse(BaseModel):
    analysis: str
    suggestions: list[str]


class UpdateErrorStatusRequest(BaseModel):
    resolution_status: str


# --- Tests ---
class ExpectedBehavior(BaseModel):
    should_not_timeout: bool = True
    max_latency_ms: int = 30000
    sql_should_contain: list[str] = []
    result_should_not_be_empty: bool = True


class CreateTestCaseRequest(BaseModel):
    name: str
    category: str
    input_query: str
    expected_behavior: ExpectedBehavior
    tags: list[str] = []


class TestCaseResponse(BaseModel):
    test_id: str
    name: str
    category: str
    input_query: str
    expected_behavior: ExpectedBehavior
    tags: list[str]
    last_result: str | None = None
    last_run_at: str | None = None


class TestRunResponse(BaseModel):
    run_id: str
    test_id: str
    batch_id: str
    status: str  # pass | fail | error
    generated_sql: str
    latency_ms: int
    validation_results: dict[str, bool]
    ai_analysis: str | None = None
    created_at: str


class RunAllResponse(BaseModel):
    batch_id: str


# --- Settings ---
class AppSettingsResponse(BaseModel):
    email_enabled: bool
    email_recipient: str
    email_send_time: str
    cognito_user_pool_id: str
    aws_region: str
    elmi_api_endpoint: str


class AppSettingsRequest(BaseModel):
    email_enabled: bool
    email_recipient: str
    email_send_time: str
    cognito_user_pool_id: str
    aws_region: str
    elmi_api_endpoint: str
