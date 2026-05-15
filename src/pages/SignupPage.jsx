import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function SignupPage() {
  const navigate = useNavigate();
  const [requestedUsername, setRequestedUsername] = useState("");
  const [error, setError] = useState("");

  const normalizeUsername = (value) =>
    value
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 32);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    const username = requestedUsername.trim();

    if (username.length < 4) {
      setError("로그인 ID는 4자 이상 입력해 주세요.");
      return;
    }

    localStorage.setItem(
      "parking_web_signup_request",
      JSON.stringify({
        requestedUsername: username,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      })
    );

    navigate("/pending", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold">상가 회원가입 신청</h1>
        <p className="mt-2 text-sm text-slate-600">
          개인정보 최소 수집을 위해 상가명, 대표자명, 연락처, 주소는 입력받지 않습니다.
          운영자 승인 완료 후 주차권 발행 기능을 사용할 수 있습니다.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            희망 로그인 ID
            <input
              value={requestedUsername}
              onChange={(event) => setRequestedUsername(normalizeUsername(event.target.value))}
              className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="예: merchant001"
              autoComplete="username"
              required
            />
          </label>

          <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600 ring-1 ring-slate-200">
            로그인 ID에는 이름, 전화번호, 주소 등 개인정보를 넣지 마세요.
            예: <span className="font-semibold text-slate-900">merchant001</span>, <span className="font-semibold text-slate-900">shop-a201</span>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">
              {error}
            </div>
          )}

          <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white">
            가입 신청
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-600">
          이미 계정이 있나요? <Link to="/login" className="font-semibold text-slate-950 underline">로그인</Link>
        </div>
      </div>
    </div>
  );
}
