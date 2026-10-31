const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function apiRequest(path, session, options = {}) {
  if (!session?.access_token) {
    throw new Error("Please sign in again to continue.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const result = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      result?.detail || `The request failed (${response.status}). Please try again.`;
    throw new Error(message);
  }

  return result;
}
