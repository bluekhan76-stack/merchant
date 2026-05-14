import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ shopName: "", ownerName: "", phone: "", address: "" });

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    localStorage.setItem("parking_web_signup_request", JSON.stringify({ ...form, status: "PENDING", createdAt: new Date().toISOString() }));
    navigate("/pending", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold">상가 회원가입 신청</h1>
        <p className="mt-2 text-sm text-slate-600">신청 후 운영자 승인 완료 시 주차권 발행 기능을 사용할 수 있습니다.</p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          {[
            ["shopName", "상가명", "예: A동 201호"],
            ["ownerName", "대표자", "대표자 이름"],
            ["phone", "연락처", "010-0000-0000"],
            ["address", "주소", "상가 주소"],
          ].map(([key, label, placeholder]) => (
            <label key={key} className="block text-sm font-medium">
              {label}
              <input
                value={form[key]}
                onChange={(event) => update(key, event.target.value)}
                className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
                placeholder={placeholder}
                required
              />
            </label>
          ))}

          <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white">가입 신청</button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-600">
          이미 계정이 있나요? <Link to="/login" className="font-semibold text-slate-950 underline">로그인</Link>
        </div>
      </div>
    </div>
  );
}
