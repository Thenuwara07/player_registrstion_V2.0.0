import { apiRequest } from "./client";

export type ActivityLog = {
  id: number;
  createdAt: string; // ISO date-time, e.g. 2026-10-01T19:56:45.000Z
  userId: number | null;
  role: string; // player | admin | guest
  description: string;
  user: { firstName: string; lastName: string; email: string } | null;
};

export type ActivityLogFilters = {
  from?: string; // ISO date-time
  to?: string; // ISO date-time
  user?: string; // name / email search, or a user id
  role?: string;
  page?: number;
  pageSize?: number;
};

export type ActivityLogsResponse = {
  success: boolean;
  data: ActivityLog[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
};

// Admin only: activity logs, newest first
export const getActivityLogs = async (
  filters: ActivityLogFilters = {}
): Promise<ActivityLogsResponse> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });

  const json = await apiRequest(`/admin/logs?${params}`, { errorMessage: "Failed to load logs" });
  if (json.success === false) {
    throw new Error(json.message || "Failed to load logs");
  }
  return json as ActivityLogsResponse;
};
