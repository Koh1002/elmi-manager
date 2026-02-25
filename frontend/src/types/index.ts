export interface User {
  user_id: string;
  email: string;
  status: "CONFIRMED" | "FORCE_CHANGE_PASSWORD" | "DISABLED";
  created_at: string;
  last_login: string | null;
}

export interface UsageLog {
  log_id: string;
  timestamp: string;
  user_id: string;
  user_email: string;
  natural_language_query: string;
  generated_sql: string;
  sql_execution_result: string;
  response_text: string;
  status: "success" | "error" | "timeout";
  error_message: string | null;
  latency_ms: number;
  lambda_request_id: string;
}

export interface DashboardSummary {
  total_requests: number;
  success_rate: number;
  avg_latency_ms: number;
  active_users: number;
  total_requests_change: number;
  success_rate_change: number;
  avg_latency_change: number;
  active_users_change: number;
  daily_stats: DailyStat[];
  recent_errors: UsageLog[];
}

export interface DailyStat {
  date: string;
  success: number;
  error: number;
  timeout: number;
}

export interface TestCase {
  test_id: string;
  name: string;
  category: string;
  input_query: string;
  expected_behavior: {
    should_not_timeout: boolean;
    max_latency_ms: number;
    sql_should_contain: string[];
    result_should_not_be_empty: boolean;
  };
  tags: string[];
  last_result: "pass" | "fail" | null;
  last_run_at: string | null;
}

export interface TestRun {
  run_id: string;
  test_id: string;
  batch_id: string;
  status: "pass" | "fail" | "error";
  generated_sql: string;
  latency_ms: number;
  validation_results: Record<string, boolean>;
  ai_analysis: string | null;
  created_at: string;
}

export interface ErrorEntry {
  error_id: string;
  timestamp: string;
  error_type: string;
  natural_language_query: string;
  generated_sql: string;
  error_message: string;
  ai_analysis: string | null;
  ai_suggestions: string[];
  resolution_status: "unresolved" | "resolved" | "ignored";
  source_log_id: string;
}

export interface AppSettings {
  email_enabled: boolean;
  email_recipient: string;
  email_send_time: string;
  cognito_user_pool_id: string;
  aws_region: string;
  elmi_api_endpoint: string;
}
