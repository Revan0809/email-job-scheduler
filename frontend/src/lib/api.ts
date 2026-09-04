import { EmailRecord, ScheduleBatchResponse, User } from "@/types";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error ?? message;
    } catch {
      // ignore body parse errors
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  me: () => request<User>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  scheduledEmails: () => request<EmailRecord[]>("/emails/scheduled"),
  sentEmails: () => request<EmailRecord[]>("/emails/sent"),
  searchEmails: (q: string) => request<EmailRecord[]>(`/emails/search?q=${encodeURIComponent(q)}`),

  scheduleBatch: (formData: FormData) =>
    request<ScheduleBatchResponse>("/emails/schedule", { method: "POST", body: formData }),

  disconnectSlack: () => request<{ ok: boolean }>("/slack/disconnect", { method: "POST" }),
};

export { ApiError };
export const googleLoginUrl = () => `${BACKEND_URL}/auth/google`;
export const slackConnectUrl = () => `${BACKEND_URL}/slack/oauth/start`;
