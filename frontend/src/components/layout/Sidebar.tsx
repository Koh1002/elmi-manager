import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  AlertTriangle,
  FlaskConical,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "ダッシュボード" },
  { to: "/users", icon: Users, label: "ユーザー管理" },
  { to: "/logs", icon: FileText, label: "利用ログ" },
  { to: "/errors", icon: AlertTriangle, label: "エラー分析" },
  { to: "/tests", icon: FlaskConical, label: "テスト管理" },
  { to: "/settings", icon: Settings, label: "設定" },
];

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 rounded-md bg-sidebar p-2 text-sidebar-foreground md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-full w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
          <div className="h-7 w-7 rounded-md bg-primary text-center text-sm font-bold leading-7 text-white">
            E
          </div>
          <span className="text-sm font-semibold">elmi-manager</span>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-3 text-xs text-sidebar-foreground/50">
          {/* TODO(AWS): 実Cognito認証後はここにログインユーザー表示 */}
          admin@lxio.co.jp
        </div>
      </aside>
    </>
  );
}
