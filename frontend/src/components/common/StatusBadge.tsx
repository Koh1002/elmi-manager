import { cn } from "@/lib/utils";

interface Props {
  status: string;
  className?: string;
}

const styles: Record<string, string> = {
  success: "bg-green-100 text-green-700",
  pass: "bg-green-100 text-green-700",
  CONFIRMED: "bg-green-100 text-green-700",
  resolved: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  fail: "bg-red-100 text-red-700",
  DISABLED: "bg-red-100 text-red-700",
  unresolved: "bg-red-100 text-red-700",
  timeout: "bg-amber-100 text-amber-700",
  FORCE_CHANGE_PASSWORD: "bg-amber-100 text-amber-700",
  ignored: "bg-gray-100 text-gray-600",
};

const labels: Record<string, string> = {
  success: "成功",
  pass: "Pass",
  CONFIRMED: "有効",
  resolved: "対応済",
  error: "エラー",
  fail: "Fail",
  DISABLED: "無効",
  unresolved: "未対応",
  timeout: "TMO",
  FORCE_CHANGE_PASSWORD: "初回PW変更待",
  ignored: "無視",
};

export function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        styles[status] ?? "bg-gray-100 text-gray-600",
        className
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
