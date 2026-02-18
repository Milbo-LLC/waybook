const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
};

export const signUpWithEmail = async (input: {
  name: string;
  email: string;
  password: string;
}) => {
  const response = await fetch(`${apiBase}/v1/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Sign up failed");
  }

  return response.json();
};

export const signInWithEmail = async (input: {
  email: string;
  password: string;
}) => {
  const response = await fetch(`${apiBase}/v1/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Sign in failed");
  }

  return response.json();
};

export const getSession = async (): Promise<SessionUser | null> => {
  const response = await fetch(`${apiBase}/v1/auth/get-session`, {
    method: "GET",
    credentials: "include"
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    user?: SessionUser;
  };

  return payload.user ?? null;
};

export const signOut = async () => {
  const response = await fetch(`${apiBase}/v1/auth/sign-out`, {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Sign out failed");
  }
};
