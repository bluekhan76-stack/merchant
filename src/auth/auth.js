import { confirmSignIn, fetchAuthSession, signIn, signOut } from "aws-amplify/auth";

export const AUTH_STORAGE_KEY = "parking_web_auth_session";

export const ROLES = {
  ADMIN: "ADMIN",
  MERCHANT: "MERCHANT",
};

export const LOGIN_CHALLENGES = {
  NEW_PASSWORD_REQUIRED: "NEW_PASSWORD_REQUIRED",
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
  localStorage.removeItem("role");
  localStorage.removeItem("isAuthenticated");
}

function getRoleFromGroups(groups) {
  if (groups.includes(ROLES.ADMIN)) return ROLES.ADMIN;
  if (groups.includes(ROLES.MERCHANT)) return ROLES.MERCHANT;
  return null;
}

async function createSessionFromCognito(userId) {
  // Cognito 토큰 저장 반영 대기용. 일부 브라우저에서 로그인 직후 바로 조회하면 토큰이 비어 있을 수 있음.
  await new Promise((resolve) => setTimeout(resolve, 300));

  const sessionData = await fetchAuthSession();
  const idToken = sessionData.tokens?.idToken?.toString();

  if (!idToken) {
    throw new Error("인증 토큰을 가져오지 못했습니다.");
  }

  const payload = sessionData.tokens?.idToken?.payload || {};
  const groups = payload["cognito:groups"] || [];
  const username = payload["cognito:username"] || userId;

  const session = {
    isAuthenticated: true,
    role: getRoleFromGroups(groups),
    userId: username,
    displayName: username,
    token: idToken,
    groups,
  };

  saveSession(session);
  return session;
}

export async function login({ userId, password }) {
  if (!userId || !password) {
    throw new Error("아이디와 비밀번호를 입력해 주세요.");
  }

  clearSession();

  const result = await signIn({
    username: userId,
    password,
  });

  const signInStep = result?.nextStep?.signInStep;

  if (signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
    return {
      challenge: LOGIN_CHALLENGES.NEW_PASSWORD_REQUIRED,
      userId,
    };
  }

  if (signInStep && signInStep !== "DONE") {
    throw new Error(`현재 로그인 단계(${signInStep})는 아직 지원하지 않습니다.`);
  }

  return createSessionFromCognito(userId);
}

export async function completeNewPassword({ userId, newPassword }) {
  if (!newPassword) {
    throw new Error("새 비밀번호를 입력해 주세요.");
  }

  const result = await confirmSignIn({
    challengeResponse: newPassword,
  });

  const signInStep = result?.nextStep?.signInStep;

  if (signInStep && signInStep !== "DONE") {
    throw new Error(`현재 로그인 단계(${signInStep})는 아직 지원하지 않습니다.`);
  }

  return createSessionFromCognito(userId);
}

export async function logout() {
  try {
    await signOut();
  } finally {
    clearSession();
  }
}
