import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Send, CheckCircle, AlertCircle } from "lucide-react";
import { Card } from "@/components/common/Card";
import { useSettings, useSaveSettings, useSendTestEmail } from "@/api/hooks";
import type { AppSettings } from "@/types";

export function Settings() {
  const { data: settings, isLoading } = useSettings();
  const saveSettings = useSaveSettings();
  const sendTestEmail = useSendTestEmail();
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (isLoading || !form) {
    return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
  }

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  };

  const handleSave = () => {
    if (!form) return;
    saveSettings.mutate(form, { onSuccess: () => setSaved(true) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon size={24} className="text-primary" />
        <h1 className="text-2xl font-bold">設定</h1>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">メール通知</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">日次改善レポートを送信:</label>
            <button
              onClick={() => update("email_enabled", !form.email_enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.email_enabled ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  form.email_enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <Field label="送信先メールアドレス">
            <input
              type="email"
              value={form.email_recipient}
              onChange={(e) => update("email_recipient", e.target.value)}
              className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </Field>

          <Field label="送信時刻">
            <div className="flex items-center gap-2">
              <select
                value={form.email_send_time}
                onChange={(e) => update("email_send_time", e.target.value)}
                className="rounded-md border border-border px-3 py-2 text-sm outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const t = `${String(i).padStart(2, "0")}:00`;
                  return (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  );
                })}
              </select>
              <span className="text-sm text-muted-foreground">JST</span>
            </div>
          </Field>

          <button
            onClick={() => sendTestEmail.mutate()}
            disabled={sendTestEmail.isPending}
            className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            <Send size={14} />
            {sendTestEmail.isPending ? "送信中..." : "テストメールを送信"}
          </button>
          {sendTestEmail.isSuccess && (
            <p className="flex items-center gap-1 text-sm text-success">
              <CheckCircle size={14} />
              テストメールを送信しました
            </p>
          )}
          {sendTestEmail.isError && (
            <p className="flex items-center gap-1 text-sm text-error">
              <AlertCircle size={14} />
              送信に失敗しました
            </p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">AWS接続</h2>
        <div className="space-y-4">
          <Field label="Cognito ユーザープール ID（エルみえる）">
            <input
              type="text"
              value={form.cognito_user_pool_id}
              onChange={(e) => update("cognito_user_pool_id", e.target.value)}
              placeholder="ap-northeast-1_XXXXXXXXX"
              className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm font-mono outline-none focus:border-primary"
            />
            {/* TODO(AWS): 接続テストボタンで実Cognito APIを叩いて疎通確認 */}
          </Field>

          <Field label="リージョン">
            <select
              value={form.aws_region}
              onChange={(e) => update("aws_region", e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm outline-none"
            >
              <option value="ap-northeast-1">ap-northeast-1 (東京)</option>
              <option value="us-east-1">us-east-1 (バージニア)</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">エルみえるAPI</h2>
        <Field label="エンドポイントURL">
          <input
            type="url"
            value={form.elmi_api_endpoint}
            onChange={(e) => update("elmi_api_endpoint", e.target.value)}
            placeholder="https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod"
            className="w-full rounded-md border border-border px-3 py-2 text-sm font-mono outline-none focus:border-primary"
          />
          {/* TODO(AWS): テスト実行時にこのURLへリクエストを投入 */}
        </Field>
      </Card>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saveSettings.isPending}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {saveSettings.isPending ? "保存中..." : "保存"}
        </button>
        {saved && (
          <p className="flex items-center gap-1 text-sm text-success">
            <CheckCircle size={14} />
            保存しました
          </p>
        )}
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
