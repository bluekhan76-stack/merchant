import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { completeNewPassword, login, LOGIN_CHALLENGES, ROLES } from "../auth/auth.js";

export default function LoginPage() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [requireNewPassword, setRequireNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const moveByRole = (session) => {
    if (session.role === ROLES.ADMIN) {
      navigate("/admin", { replace: true });
    } else if (session.role === ROLES.MERCHANT) {
      navigate("/merchant", { replace: true });
    } else {
      navigate("/pending", { replace: true });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      if (requireNewPassword) {
        if (newPassword.length < 8) {
          throw new Error("새 비밀번호는 최소 8자 이상으로 입력해 주세요.");
        }

        if (newPassword !== newPasswordConfirm) {
          throw new Error("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
        }

        const session = await completeNewPassword({
          userId,
          newPassword,
        });

        moveByRole(session);
        return;
      }

      const result = await login({
        userId,
        password,
      });

      if (result.challenge === LOGIN_CHALLENGES.NEW_PASSWORD_REQUIRED) {
        setRequireNewPassword(true);
        setPassword("");
        setError("");
        return;
      }

      moveByRole(result);
    } catch (err) {
      setError(err?.message || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">방문자 주차권 시스템</p>
        <h1 className="mt-1 text-2xl font-bold">
          {requireNewPassword ? "새 비밀번호 설정" : "로그인"}
        </h1>

        {requireNewPassword && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호를 설정해 주세요.
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            아이디
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              disabled={requireNewPassword || loading}
              className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100"
              placeholder="아이디"
            />
          </label>

          {!requireNewPassword && (
            <label className="block text-sm font-medium">
              비밀번호
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="비밀번호"
              />
            </label>
          )}

          {requireNewPassword && (
            <>
              <label className="block text-sm font-medium">
                새 비밀번호
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="새 비밀번호"
                />
              </label>

              <label className="block text-sm font-medium">
                새 비밀번호 확인
                <input
                  value={newPasswordConfirm}
                  onChange={(event) => setNewPasswordConfirm(event.target.value)}
                  type="password"
                  className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="새 비밀번호 확인"
                />
              </label>
            </>
          )}

          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "처리 중..." : requireNewPassword ? "새 비밀번호 설정" : "로그인"}
          </button>
        </form>

        {!requireNewPassword && (
          <div className="mt-5 text-center text-sm text-slate-600">
            상가 계정이 없나요? <Link to="/signup" className="font-semibold text-slate-950 underline">회원가입 신청</Link>
          </div>
        )}

        <p className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-xs text-sky-700">
          AWS Cognito 기반 로그인 구조가 적용되었습니다.
        </p>
      </div>
    </div>
  );
}
