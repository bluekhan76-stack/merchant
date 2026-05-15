import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, ROLES } from "../auth/auth.js";

export default function LoginPage() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const session = await login({
        userId,
        password,
      });

      if (session.role === ROLES.ADMIN) {
        navigate("/admin", { replace: true });
      } else if (session.role === ROLES.MERCHANT) {
        navigate("/merchant", { replace: true });
      } else {
        navigate("/pending", { replace: true });
      }
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
        <h1 className="mt-1 text-2xl font-bold">로그인</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            아이디
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="아이디"
            />
          </label>

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

          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-600">
          상가 계정이 없나요? <Link to="/signup" className="font-semibold text-slate-950 underline">회원가입 신청</Link>
        </div>

        <p className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-xs text-sky-700">
          AWS Cognito 기반 로그인 구조가 적용되었습니다.
        </p>
      </div>
    </div>
  );
}
