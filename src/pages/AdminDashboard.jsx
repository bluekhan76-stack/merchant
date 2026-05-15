import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession } from "../auth/auth.js";

const seedRequests = [
  { id: "req-1", requestedUsername: "merchant001", status: "PENDING", createdAt: "2026-05-15T00:00:00.000Z" },
];

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const signupRequest = useMemo(() => {
    try {
      const saved = localStorage.getItem("parking_web_signup_request");
      return saved ? [{ id: "local-request", ...JSON.parse(saved) }] : [];
    } catch {
      return [];
    }
  }, []);
  const [requests, setRequests] = useState([...signupRequest, ...seedRequests]);

  const updateStatus = (id, status) => {
    setRequests((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">방문자 주차권 시스템</p>
            <h1 className="text-2xl font-bold">관리자 페이지</h1>
          </div>
          <button onClick={handleLogout} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">로그아웃</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">상가 가입 신청 관리</h2>
          <p className="mt-2 text-sm text-slate-600">
            개인정보 최소 수집 정책에 따라 상가명, 대표자명, 연락처, 주소는 표시하지 않습니다.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3">신청 ID</th>
                  <th>희망 로그인 ID</th>
                  <th>신청일</th>
                  <th>상태</th>
                  <th className="text-right">처리</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3 font-semibold">{item.id}</td>
                    <td>{item.requestedUsername || "-"}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.status}</td>
                    <td className="space-x-2 text-right">
                      <button onClick={() => updateStatus(item.id, "APPROVED")} className="rounded-xl border px-3 py-2 hover:bg-emerald-50">승인</button>
                      <button onClick={() => updateStatus(item.id, "REJECTED")} className="rounded-xl border px-3 py-2 hover:bg-rose-50">거절</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
