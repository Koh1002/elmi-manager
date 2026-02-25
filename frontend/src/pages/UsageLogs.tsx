import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/common/Card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useLogs } from "@/api/hooks";
import { formatDateTime, formatLatency } from "@/lib/utils";

export function UsageLogs() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const { data, isLoading } = useLogs({ page, status: status || undefined, search: search || undefined });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText size={24} className="text-primary" />
        <h1 className="text-2xl font-bold">利用ログ</h1>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none"
          >
            <option value="">すべてのステータス</option>
            <option value="success">成功</option>
            <option value="error">エラー</option>
            <option value="timeout">タイムアウト</option>
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="リクエスト内容で検索..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
              className="w-64 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => { setSearch(searchInput); setPage(1); }}
              className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
            >
              検索
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 font-medium">日時</th>
                    <th className="pb-3 font-medium">ユーザー</th>
                    <th className="pb-3 font-medium">リクエスト内容</th>
                    <th className="pb-3 font-medium">ステータス</th>
                    <th className="pb-3 font-medium">応答時間</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((log) => (
                    <tr
                      key={log.log_id}
                      onClick={() => navigate(`/logs/${log.log_id}`)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                    >
                      <td className="py-3 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="py-3 whitespace-nowrap">{log.user_email}</td>
                      <td className="py-3 max-w-xs truncate">
                        {log.natural_language_query}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="py-3 whitespace-nowrap text-muted-foreground">
                        {formatLatency(log.latency_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data?.items ?? []).length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  ログが見つかりません
                </p>
              )}
            </div>

            {data && data.total > 0 && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {data.total}件中 {(page - 1) * 20 + 1}-{Math.min(page * 20, data.total)}件を表示
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="rounded p-1 hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="px-2 py-1">{page}</span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page * 20 >= data.total}
                    className="rounded p-1 hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
