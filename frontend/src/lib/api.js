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

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("The API did not respond within 15 seconds. Check that the backend is running and its database connection is healthy.", { cause: error });
    }
    throw new Error(`Could not reach the API at ${API_URL}. Check that the backend is running and VITE_API_URL is correct.`, { cause: error });
  }
  const result = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      result?.detail || `The request failed (${response.status}). Please try again.`;
    throw new Error(message);
  }

  return result;
}
