import { useState } from "react";
import { FlaskConical, Plus, Play, ChevronRight, X } from "lucide-react";
import { Card } from "@/components/common/Card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useTestCases, useTestRuns, useCreateTestCase, useRunAllTests } from "@/api/hooks";
import { formatDate, formatLatency } from "@/lib/utils";
import type { TestCase } from "@/types";

export function TestManagement() {
  const { data: tests, isLoading } = useTestCases();
  const runAll = useRunAllTests();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical size={24} className="text-primary" />
          <h1 className="text-2xl font-bold">テスト管理</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Plus size={16} />
            テストケース追加
          </button>
          <button
            onClick={() => runAll.mutate()}
            disabled={runAll.isPending}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Play size={16} />
            {runAll.isPending ? "実行中..." : "全実行"}
          </button>
        </div>
      </div>

      <Card>
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
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">テスト名</th>
                  <th className="pb-3 font-medium">カテゴリ</th>
                  <th className="pb-3 font-medium">最終結果</th>
                  <th className="pb-3 font-medium">最終実行</th>
                  <th className="pb-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {(tests ?? []).map((tc) => (
                  <tr
                    key={tc.test_id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                    onClick={() =>
                      setSelectedTest(
                        selectedTest === tc.test_id ? null : tc.test_id
                      )
                    }
                  >
                    <td className="py-3 font-mono text-xs text-muted-foreground">
                      {tc.test_id}
                    </td>
                    <td className="py-3 font-medium">{tc.name}</td>
                    <td className="py-3 text-muted-foreground">
                      {tc.category}
                    </td>
                    <td className="py-3">
                      {tc.last_result ? (
                        <StatusBadge status={tc.last_result} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          未実行
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {tc.last_run_at ? formatDate(tc.last_run_at) : "-"}
                    </td>
                    <td className="py-3">
                      <ChevronRight
                        size={16}
                        className="text-muted-foreground"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(tests ?? []).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                テストケースを追加してください
              </p>
            )}
          </div>
        )}
      </Card>

      {selectedTest && <TestRunHistory testId={selectedTest} />}
      {showCreate && <CreateTestModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function TestRunHistory({ testId }: { testId: string }) {
  const { data: runs, isLoading } = useTestRuns(testId);

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">
        {testId} - 実行履歴
      </h2>
      {(runs ?? []).length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          実行履歴はありません
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 font-medium">Run</th>
                <th className="pb-3 font-medium">実行日時</th>
                <th className="pb-3 font-medium">結果</th>
                <th className="pb-3 font-medium">応答時間</th>
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).map((run, idx) => (
                <tr
                  key={run.run_id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-3 font-mono text-xs">
                    Run {(runs ?? []).length - idx}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {formatDate(run.created_at)}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {formatLatency(run.latency_ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CreateTestModal({ onClose }: { onClose: () => void }) {
  const createTest = useCreateTestCase();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("SQL生成");
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState("");
  const [maxLatency, setMaxLatency] = useState("30000");
  const [sqlKeywords, setSqlKeywords] = useState("");

  const handleCreate = () => {
    createTest.mutate(
      {
        name,
        category,
        input_query: query,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        expected_behavior: {
          should_not_timeout: true,
          max_latency_ms: Number(maxLatency),
          sql_should_contain: sqlKeywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          result_should_not_be_empty: true,
        },
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">テストケース追加</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <Field label="テスト名 *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="サミット月次売上集計"
            />
          </Field>
          <Field label="カテゴリ *">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none"
            >
              <option>SQL生成</option>
              <option>パフォーマンス</option>
              <option>データ抽出</option>
              <option>分析示唆</option>
            </select>
          </Field>
          <Field label="自然言語リクエスト *">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="サミットの2024年12月の売上を教えて"
            />
          </Field>
          <Field label="タグ（カンマ区切り）">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="summit, monthly, sales"
            />
          </Field>
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-semibold">合格条件</p>
            <Field label="最大許容応答時間 (ms)">
              <input
                type="number"
                value={maxLatency}
                onChange={(e) => setMaxLatency(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="SQLに含むべきキーワード（カンマ区切り）">
              <input
                value={sqlKeywords}
                onChange={(e) => setSqlKeywords(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="SUM, sales, 202412"
              />
            </Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            キャンセル
          </button>
          <button
            onClick={handleCreate}
            disabled={!name || !query || createTest.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {createTest.isPending ? "作成中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
