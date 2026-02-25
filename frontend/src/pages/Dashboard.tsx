import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/common/Card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useDashboard } from "@/api/hooks";
import { cn, formatDateTime } from "@/lib/utils";

const periods = ["today", "7d", "30d"] as const;
const periodLabels: Record<string, string> = {
  today: "今日",
  "7d": "過去7日",
  "30d": "過去30日",
};

export function Dashboard() {
  const [period, setPeriod] = useState("7d");
  const { data, isLoading } = useDashboard(period);
  const navigate = useNavigate();

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors",
                period === p
                  ? "bg-white font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="総リクエスト数"
          value={data.total_requests.toLocaleString()}
          change={data.total_requests_change}
        />
        <SummaryCard
          label="成功率"
          value={`${data.success_rate.toFixed(1)}%`}
          change={data.success_rate_change}
        />
        <SummaryCard
          label="平均応答"
          value={`${(data.avg_latency_ms / 1000).toFixed(1)}秒`}
          change={data.avg_latency_change}
          invertColor
        />
        <SummaryCard
          label="アクティブユーザー"
          value={`${data.active_users}人`}
          change={data.active_users_change}
        />
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">日別リクエスト数推移</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.daily_stats}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="success" name="成功" fill="#16a34a" stackId="a" />
            <Bar dataKey="error" name="エラー" fill="#dc2626" stackId="a" />
            <Bar dataKey="timeout" name="TMO" fill="#d97706" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">最新エラー</h2>
            <button
              onClick={() => navigate("/errors")}
              className="text-sm text-primary hover:underline"
            >
              すべて見る →
            </button>
          </div>
          {data.recent_errors.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              エラーはありません
            </p>
          ) : (
            <div className="space-y-3">
              {data.recent_errors.slice(0, 5).map((err) => (
                <div
                  key={err.log_id}
                  className="flex items-start gap-3 rounded-md p-2 hover:bg-muted cursor-pointer"
                  onClick={() => navigate(`/logs/${err.log_id}`)}
                >
                  <StatusBadge status={err.status} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {err.natural_language_query}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(err.timestamp)} ·{" "}
                      {err.user_email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">テスト実行サマリー</h2>
          {/* TODO: テスト管理実装後にリアルデータに差し替え */}
          <p className="py-8 text-center text-sm text-muted-foreground">
            テスト管理画面でテストケースを登録してください
          </p>
          <button
            onClick={() => navigate("/tests")}
            className="w-full rounded-md bg-muted py-2 text-sm font-medium hover:bg-muted/80"
          >
            テスト管理画面へ →
          </button>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  change,
  invertColor = false,
}: {
  label: string;
  value: string;
  change: number;
  invertColor?: boolean;
}) {
  const isUp = change > 0;
  const isZero = change === 0;
  const color = isZero
    ? "text-muted-foreground"
    : invertColor
      ? isUp
        ? "text-error"
        : "text-success"
      : isUp
        ? "text-success"
        : "text-error";
  const Icon = isZero ? Minus : isUp ? TrendingUp : TrendingDown;

  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <div className={cn("mt-1 flex items-center gap-1 text-xs", color)}>
        <Icon size={14} />
        {isZero ? "変動なし" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
