import React from "react";
import { Link } from "react-router-dom";

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">회원가입 신청 완료</p>
        <h1 className="mt-2 text-2xl font-bold">운영자 승인 대기 중입니다</h1>
        <p className="mt-3 text-sm text-slate-600">관리자가 상가 정보를 확인한 후 승인하면 로그인하여 주차권을 발행할 수 있습니다.</p>
        <Link to="/login" className="mt-6 inline-flex rounded-2xl border px-5 py-3 text-sm font-semibold hover:bg-slate-50">로그인 화면으로 이동</Link>
      </div>
    </div>
  );
}
