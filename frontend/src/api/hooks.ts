import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  DashboardSummary,
  User,
  UsageLog,
  TestCase,
  TestRun,
  ErrorEntry,
  AppSettings,
} from "@/types";

// Dashboard
export function useDashboard(period: string) {
  return useQuery({
    queryKey: ["dashboard", period],
    queryFn: () => api.get<DashboardSummary>(`/dashboard?period=${period}`),
    refetchInterval: 60_000,
  });
}

// Users
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; temporary_password: string }) =>
      api.post<User>("/users", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useToggleUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { user_id: string; enabled: boolean }) =>
      api.put<void>(`/users/${data.user_id}/status`, {
        enabled: data.enabled,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<void>(`/users/${userId}/reset-password`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

// Logs
export function useLogs(params: {
  page: number;
  status?: string;
  user_id?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  if (params.status) query.set("status", params.status);
  if (params.user_id) query.set("user_id", params.user_id);
  if (params.search) query.set("search", params.search);
  return useQuery({
    queryKey: ["logs", params],
    queryFn: () =>
      api.get<{ items: UsageLog[]; total: number }>(`/logs?${query}`),
  });
}

export function useLogDetail(logId: string) {
  return useQuery({
    queryKey: ["logs", logId],
    queryFn: () => api.get<UsageLog>(`/logs/${logId}`),
    enabled: !!logId,
  });
}

// Errors
export function useErrors(period: string) {
  return useQuery({
    queryKey: ["errors", period],
    queryFn: () => api.get<ErrorEntry[]>(`/errors?period=${period}`),
  });
}

export function useRequestAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (errorId: string) =>
      api.post<{ analysis: string; suggestions: string[] }>(
        `/errors/${errorId}/analyze`,
        {}
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["errors"] }),
  });
}

export function useUpdateErrorStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { error_id: string; status: string }) =>
      api.put<void>(`/errors/${data.error_id}/status`, {
        resolution_status: data.status,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["errors"] }),
  });
}

// Tests
export function useTestCases() {
  return useQuery({
    queryKey: ["tests"],
    queryFn: () => api.get<TestCase[]>("/tests"),
  });
}

export function useTestRuns(testId: string) {
  return useQuery({
    queryKey: ["tests", testId, "runs"],
    queryFn: () => api.get<TestRun[]>(`/tests/${testId}/runs`),
    enabled: !!testId,
  });
}

export function useCreateTestCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<TestCase, "test_id" | "last_result" | "last_run_at">) =>
      api.post<TestCase>("/tests", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tests"] }),
  });
}

export function useRunAllTests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ batch_id: string }>("/tests/run-all", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tests"] }),
  });
}

// Settings
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<AppSettings>("/settings"),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppSettings) => api.put<void>("/settings", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: () => api.post<void>("/settings/test-email", {}),
  });
}
