// Keep proxy/network failures readable; never render an HTML error page as JSON.
export async function responseJSON(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data?.code || data?.error;
    const messages: Record<string, string> = {
      SIGN_IN_REQUIRED: "Your session expired. Sign in again to continue.",
      ACCESS_DENIED: "Your account does not have access to this action.",
      STORAGE_UNAVAILABLE: "The workspace database is temporarily unavailable. Please retry.",
      RATE_LIMITED: "Too many requests. Wait a minute and retry.",
    };
    throw new Error(messages[code] || data?.error || `The request failed (${response.status}). Please retry.`);
  }
  if (!data) throw new Error("The server returned an incomplete response. Please retry.");
  return data;
}

export async function loadJSON(path: string, signal?: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(path, { cache: "no-store", signal });
      if (attempt < 2 && [502, 503, 504].includes(response.status)) continue;
      return await responseJSON(response);
    } catch (error) {
      if (signal?.aborted || attempt >= 2 || !(error instanceof TypeError)) throw error;
    }
  }
}
