const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
};

export const startGoogleSignIn = async (callbackPath = "/") => {
  const callbackURL = `${window.location.origin}${callbackPath}`;
  const response = await fetch(`${apiBase}/v1/auth/sign-in/social`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      provider: "google",
      callbackURL,
      disableRedirect: true
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Google sign in failed");
  }

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) throw new Error("Missing Google redirect URL");
  window.location.assign(payload.url);
};

export const getSession = async (): Promise<SessionUser | null> => {
  const response = await fetch(`${apiBase}/v1/auth/get-session`, {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as
    | {
        user?: SessionUser | null;
      }
    | null;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload.user ?? null;
};

export const signOut = async () => {
  const response = await fetch(`${apiBase}/v1/auth/sign-out`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({})
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Sign out failed");
  }
};
