import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { demoLogin, ROLES } from "../auth/auth.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(ROLES.MERCHANT);
  const [userId, setUserId] = useState("merchant01");
  const [password, setPassword] = useState("1234");
  const [error, setError] = useState("");

  const nextPath = useMemo(() => {
    const from = location.state?.from;
    if (from && from !== "/login") return from;
    return role === ROLES.ADMIN ? "/admin" : "/merchant";
  }, [location.state, role]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    try {
      const session = demoLogin({ userId, password, role });
      navigate(session.role === ROLES.ADMIN ? "/admin" : nextPath, { replace: true });
    } catch (err) {
      setError(err?.message || "로그인에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">방문자 주차권 시스템</p>
        <h1 className="mt-1 text-2xl font-bold">로그인</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setRole(ROLES.MERCHANT);
                setUserId("merchant01");
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${role === ROLES.MERCHANT ? "bg-white shadow-sm" : "text-slate-500"}`}
            >
              상가 회원
            </button>
            <button
              type="button"
              onClick={() => {
                setRole(ROLES.ADMIN);
                setUserId("admin01");
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${role === ROLES.ADMIN ? "bg-white shadow-sm" : "text-slate-500"}`}
            >
              관리자
            </button>
          </div>

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

          <button type="submit" className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white">
            로그인
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-600">
          상가 계정이 없나요? <Link to="/signup" className="font-semibold text-slate-950 underline">회원가입 신청</Link>
        </div>

        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
          현재는 화면 구조 정리를 위한 데모 로그인입니다. AWS Cognito 연동 후 실제 인증으로 교체합니다.
        </p>
      </div>
    </div>
  );
}
