// Shared HTTP client for the backend API.
export const API_BASE_URL = import.meta.env.VITE_API_URL;

export const getAuthToken = () => sessionStorage.getItem("authToken");

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-serialised as the request body; FormData is sent as-is. */
  body?: unknown;
  /** Message used when the server's error response has none. */
  errorMessage?: string;
};

/**
 * Calls `${API_BASE_URL}${path}` and returns the parsed JSON body.
 * Sends the signed-in user's token when there is one.
 * On a non-2xx response, throws an Error with the server's `message`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers type the result themselves
export async function apiRequest<T = any>(
  path: string,
  { method = "GET", body, errorMessage = "Request failed" }: RequestOptions = {}
): Promise<T> {
  const token = getAuthToken();
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = {
    // Skips ngrok's browser warning page when the API is tunnelled
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.message || errorMessage);
  }
  return json as T;
}

/** Removes keys whose value is an empty string. */
export const withoutEmptyStrings = <T extends Record<string, unknown>>(payload: T): Partial<T> =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "")) as Partial<T>;
