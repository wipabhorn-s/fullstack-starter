import { apiFetch } from "@/lib/api/api-fetch";
import { Paginated, UserResponse, UserStatus } from "@/lib/api/api.type";

function toQueryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export const AdminApi = {
  findUsers(
    token: string,
    params: { search?: string; page?: number; limit?: number } = {},
  ) {
    return apiFetch<Paginated<UserResponse>>(
      `/admin/users${toQueryString(params)}`,
      { token, cache: "no-store" },
    );
  },

  updateUserStatus(userId: string, status: UserStatus, token: string) {
    return apiFetch<UserResponse>(
      `/admin/users/${encodeURIComponent(userId)}/status`,
      { method: "PATCH", body: { status }, token },
    );
  },
};
