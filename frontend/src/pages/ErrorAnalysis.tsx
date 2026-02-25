import { useState } from "react";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import { Card } from "@/components/common/Card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useErrors, useRequestAnalysis, useUpdateErrorStatus } from "@/api/hooks";
import { formatDateTime } from "@/lib/utils";
import type { ErrorEntry } from "@/types";

export function ErrorAnalysis() {
  const [period, setPeriod] = useState("7d");
  const { data: errors, isLoading } = useErrors(period);
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);
  const requestAnalysis = useRequestAnalysis();
  const updateStatus = useUpdateErrorStatus();

  const errorsByType = (errors ?? []).reduce(
    (acc, e) => {
      acc[e.error_type] = (acc[e.error_type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const typeLabels: Record<string, string> = {
    sql_syntax: "SQLエラー",
    timeout: "タイムアウト",
    redshift_connection: "接続エラー",
    bedrock_error: "Bedrockエラー",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AlertTriangle size={24} className="text-error" />
        <h1 className="text-2xl font-bold">エラー分析</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <Card className="text-center">
          <p className="text-sm text-muted-foreground">全エラー</p>
          <p className="text-2xl font-bold">{(errors ?? []).length}件</p>
        </Card>
        {Object.entries(errorsByType).map(([type, count]) => (
          <Card key={type} className="text-center">
            <p className="text-sm text-muted-foreground">
              {typeLabels[type] ?? type}
            </p>
            <p className="text-2xl font-bold">{count}件</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none"
          >
            <option value="today">今日</option>
            <option value="7d">過去7日</option>
            <option value="30d">過去30日</option>
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 font-medium">日時</th>
                  <th className="pb-3 font-medium">種別</th>
                  <th className="pb-3 font-medium">リクエスト</th>
                  <th className="pb-3 font-medium">AI分析</th>
                  <th className="pb-3 font-medium">状態</th>
                </tr>
              </thead>
              <tbody>
                {(errors ?? []).map((err) => (
                  <tr
                    key={err.error_id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="py-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(err.timestamp)}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      {typeLabels[err.error_type] ?? err.error_type}
                    </td>
                    <td className="py-3 max-w-xs truncate">
                      {err.natural_language_query}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => setSelectedError(err)}
                        className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        <Sparkles size={12} />
                        表示
                      </button>
                    </td>
                    <td className="py-3">
                      <StatusBadge status={err.resolution_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(errors ?? []).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                エラーはありません
              </p>
            )}
          </div>
        )}
      </Card>

      {selectedError && (
        <AnalysisModal
          error={selectedError}
          onClose={() => setSelectedError(null)}
          onRequestAnalysis={() =>
            requestAnalysis.mutate(selectedError.error_id)
          }
          onUpdateStatus={(status) =>
            updateStatus.mutate({
              error_id: selectedError.error_id,
              status,
            })
          }
          isAnalyzing={requestAnalysis.isPending}
        />
      )}
    </div>
  );
}

function AnalysisModal({
  error,
  onClose,
  onRequestAnalysis,
  onUpdateStatus,
  isAnalyzing,
}: {
  error: ErrorEntry;
  onClose: () => void;
  onRequestAnalysis: () => void;
  onUpdateStatus: (status: string) => void;
  isAnalyzing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI改善提案</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">対象リクエスト</p>
            <p className="mt-1 text-sm font-medium">
              「{error.natural_language_query}」
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">エラー内容</p>
            <pre className="mt-1 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error.error_message}
            </pre>
          </div>

          {error.generated_sql && (
            <div>
              <p className="text-xs text-muted-foreground">生成されたSQL</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-slate-900 p-3 text-sm text-green-400">
                {error.generated_sql}
              </pre>
            </div>
          )}

          {error.ai_analysis ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                AI分析結果
              </p>
              <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                <div className="whitespace-pre-wrap text-sm">
                  {error.ai_analysis}
                </div>
                {error.ai_suggestions.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-semibold">改善提案:</p>
                    <ul className="list-inside list-disc space-y-1 text-sm">
                      {error.ai_suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={onRequestAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Sparkles size={16} />
              {isAnalyzing ? "分析中..." : "AI分析を依頼"}
            </button>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">ステータス:</span>
            <select
              value={error.resolution_status}
              onChange={(e) => onUpdateStatus(e.target.value)}
              className="rounded-md border border-border px-2 py-1 text-sm outline-none"
            >
              <option value="unresolved">未対応</option>
              <option value="resolved">対応済</option>
              <option value="ignored">無視</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
