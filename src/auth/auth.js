import { signIn, signOut, fetchAuthSession } from "aws-amplify/auth";

export const AUTH_STORAGE_KEY = "parking_web_auth_session";

export const ROLES = {
  ADMIN: "ADMIN",
  MERCHANT: "MERCHANT",
};

export function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const session = raw ? JSON.parse(raw) : null;

    // 기존 데모 로그인 세션 제거
    if (!session?.token || !Array.isArray(session?.groups)) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function login({ userId, password }) {
  if (!userId || !password) {
    throw new Error("아이디와 비밀번호를 입력해 주세요.");
  }

  await signIn({
    username: userId,
    password,
  });

  const sessionData = await fetchAuthSession();

  const idToken = sessionData.tokens?.idToken?.toString();

  if (!idToken) {
    throw new Error("인증 토큰을 가져오지 못했습니다.");
  }

  const payload = sessionData.tokens?.idToken?.payload || {};
  const groups = payload["cognito:groups"] || [];

  let role = null;

  if (groups.includes(ROLES.ADMIN)) {
    role = ROLES.ADMIN;
  } else if (groups.includes(ROLES.MERCHANT)) {
    role = ROLES.MERCHANT;
  }

  const session = {
    isAuthenticated: true,
    role,
    userId: payload["cognito:username"] || userId,
    displayName: payload["cognito:username"] || userId,
    token: idToken,
    groups,
  };

  saveSession(session);

  return session;
}

export async function logout() {
  await signOut();
  clearSession();
}
