export const AUTH_STORAGE_KEY = "parking_web_auth_session";

export const ROLES = {
  ADMIN: "ADMIN",
  MERCHANT: "MERCHANT",
};

export function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function demoLogin({ userId, password, role }) {
  if (!userId || !password) {
    throw new Error("아이디와 비밀번호를 입력해 주세요.");
  }

  const now = new Date().toISOString();
  const normalizedRole = role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.MERCHANT;

  const session = {
    isAuthenticated: true,
    role: normalizedRole,
    userId,
    displayName: normalizedRole === ROLES.ADMIN ? "운영 관리자" : "A동 201호",
    status: normalizedRole === ROLES.ADMIN ? "APPROVED" : "APPROVED",
    token: `demo-token-${normalizedRole.toLowerCase()}-${Date.now()}`,
    createdAt: now,
  };

  saveSession(session);
  return session;
}
