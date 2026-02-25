import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { UserManagement } from "@/pages/UserManagement";
import { UsageLogs } from "@/pages/UsageLogs";
import { LogDetail } from "@/pages/LogDetail";
import { ErrorAnalysis } from "@/pages/ErrorAnalysis";
import { TestManagement } from "@/pages/TestManagement";
import { Settings } from "@/pages/Settings";

// TODO(AWS): Cognito認証ガード追加
// ログイン画面 + ProtectedRoute wrapper を実装し、
// 未認証ユーザーを /login にリダイレクトする

export default function App() {
  return (
    <Routes>
      {/* TODO(AWS): <Route path="/login" element={<Login />} /> */}
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="logs" element={<UsageLogs />} />
        <Route path="logs/:logId" element={<LogDetail />} />
        <Route path="errors" element={<ErrorAnalysis />} />
        <Route path="tests" element={<TestManagement />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
