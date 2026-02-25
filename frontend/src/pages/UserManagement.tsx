import { useState } from "react";
import { Users, Plus, MoreVertical, RotateCcw } from "lucide-react";
import { Card } from "@/components/common/Card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useUsers, useCreateUser, useToggleUser, useResetPassword } from "@/api/hooks";
import { formatDate } from "@/lib/utils";

export function UserManagement() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const toggleUser = useToggleUser();
  const resetPassword = useResetPassword();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = (users ?? []).filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={24} className="text-primary" />
          <h1 className="text-2xl font-bold">ユーザー管理</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus size={16} />
          ユーザーを追加
        </button>
      </div>

      <Card>
        <div className="mb-4">
          <input
            type="text"
            placeholder="メールアドレスで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 font-medium">メールアドレス</th>
                  <th className="pb-3 font-medium">ステータス</th>
                  <th className="pb-3 font-medium">作成日</th>
                  <th className="pb-3 font-medium">最終ログイン</th>
                  <th className="pb-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.user_id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="py-3">{user.email}</td>
                    <td className="py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {user.last_login ? formatDate(user.last_login) : "-"}
                    </td>
                    <td className="py-3">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenMenu(openMenu === user.user_id ? null : user.user_id)
                          }
                          className="rounded p-1 hover:bg-muted"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenu === user.user_id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenu(null)}
                            />
                            <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-white py-1 shadow-lg">
                              <button
                                onClick={() => {
                                  resetPassword.mutate(user.user_id);
                                  setOpenMenu(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                              >
                                <RotateCcw size={14} />
                                パスワードリセット
                              </button>
                              <button
                                onClick={() => {
                                  toggleUser.mutate({
                                    user_id: user.user_id,
                                    enabled: user.status === "DISABLED",
                                  });
                                  setOpenMenu(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                              >
                                {user.status === "DISABLED"
                                  ? "アカウント有効化"
                                  : "アカウント無効化"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                ユーザーが見つかりません
              </p>
            )}
          </div>
        )}
      </Card>

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(email, password) => {
            createUser.mutate(
              { email, temporary_password: password },
              { onSuccess: () => setShowCreateModal(false) }
            );
          }}
          isPending={createUser.isPending}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  onClose,
  onCreate,
  isPending,
}: {
  onClose: () => void;
  onCreate: (email: string, password: string) => void;
  isPending: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">ユーザーを追加</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              メールアドレス *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              仮パスワード *
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="12文字以上、大小英数混在"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            初回ログイン時にパスワード変更が要求されます
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            キャンセル
          </button>
          <button
            onClick={() => onCreate(email, password)}
            disabled={!email || !password || isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "作成中..." : "ユーザー作成"}
          </button>
        </div>
      </div>
    </div>
  );
}
