import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/common/Card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useLogDetail } from "@/api/hooks";
import { formatDateTime, formatLatency } from "@/lib/utils";

export function LogDetail() {
  const { logId } = useParams<{ logId: string }>();
  const navigate = useNavigate();
  const { data: log, isLoading } = useLogDetail(logId ?? "");

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
  }

  if (!log) {
    return <p className="text-muted-foreground">ログが見つかりません</p>;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} />
        戻る
      </button>

      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">リクエスト詳細</h1>
        <span className="text-sm text-muted-foreground">
          {formatDateTime(log.timestamp)}
        </span>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">ユーザー</p>
            <p className="mt-1 text-sm font-medium">{log.user_email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ステータス</p>
            <div className="mt-1">
              <StatusBadge status={log.status} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">応答時間</p>
            <p className="mt-1 text-sm font-medium">
              {formatLatency(log.latency_ms)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lambda Request ID</p>
            <p className="mt-1 truncate text-xs font-mono text-muted-foreground">
              {log.lambda_request_id}
            </p>
          </div>
        </div>
      </Card>

      <Section title="自然言語リクエスト">
        <p className="text-sm">{log.natural_language_query}</p>
      </Section>

      <Section title="生成されたSQL">
        <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 text-sm text-green-400">
          <code>{log.generated_sql || "(SQLなし)"}</code>
        </pre>
      </Section>

      {log.error_message && (
        <Section title="エラーメッセージ">
          <pre className="overflow-x-auto rounded-md bg-red-50 p-4 text-sm text-red-700">
            {log.error_message}
          </pre>
        </Section>
      )}

      <Section title="SQL実行結果">
        <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
          {log.sql_execution_result || "(結果なし)"}
        </pre>
      </Section>

      <Section title="分析示唆（AI応答）">
        <div className="whitespace-pre-wrap text-sm">
          {log.response_text || "(応答なし)"}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        {title}
      </h2>
      {children}
    </Card>
  );
}
