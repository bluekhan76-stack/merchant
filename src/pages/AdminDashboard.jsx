import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { clearSession } from "../auth/auth.js";
import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE = "https://8q72reoak2.execute-api.ap-northeast-2.amazonaws.com";
const PLAN_OPTIONS = [100, 200, 300, 400, 500, "unlimited"];

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

async function getIdToken() {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();

  if (!idToken) {
    throw new Error("로그인 토큰이 없습니다. 다시 로그인해 주세요.");
  }

  return idToken;
}

function planLabel(value) {
  if (value === -1 || value === "unlimited") return "무제한";
  return String(value ?? "-");
}

const DEFAULT_PARKING_GATES = [
  { id: "gate-1", name: "차단기 1", macAddress: "" },
  { id: "gate-2", name: "차단기 2", macAddress: "" },
  { id: "gate-3", name: "차단기 3", macAddress: "" },
  { id: "gate-4", name: "차단기 4", macAddress: "" },
];

function normalizeMacInput(value) {
  return String(value || "")
    .trim()
    .replace(/[^0-9a-fA-F]/g, "")
    .slice(0, 12)
    .toUpperCase()
    .replace(/(.{2})(?=.)/g, "$1:");
}

function getParkingGates(merchant) {
  const source = Array.isArray(merchant?.parkingGates) && merchant.parkingGates.length > 0
    ? merchant.parkingGates
    : DEFAULT_PARKING_GATES;

  return DEFAULT_PARKING_GATES.map((fallbackGate, index) => {
    const matched =
      source.find((gate) => gate?.id === fallbackGate.id) ||
      source[index] ||
      {};

    return {
      id: matched.id || fallbackGate.id,
      name: matched.name || fallbackGate.name,
      macAddress: normalizeMacInput(matched.macAddress || matched.mac || matched.macAddr || ""),
    };
  });
}

function buildParkingGatesWithMac(merchant, gateId, macAddress) {
  return getParkingGates(merchant).map((gate) =>
    gate.id === gateId
      ? {
          ...gate,
          macAddress: normalizeMacInput(macAddress),
        }
      : gate
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [pendingItems, setPendingItems] = useState([]);
  const [merchantItems, setMerchantItems] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const filteredMerchants = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merchantItems;

    return merchantItems.filter((item) => {
      return (
        String(item.loginId || "").toLowerCase().includes(q) ||
        String(item.email || "").toLowerCase().includes(q) ||
        String(item.buildingName || "").toLowerCase().includes(q) ||
        String(item.roomNo || "").toLowerCase().includes(q)
      );
    });
  }, [merchantItems, query]);

  async function apiFetch(path, options = {}) {
    const token = await getIdToken();

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok || data.ok === false) {
      throw new Error(data.message || `API error: ${res.status}`);
    }

    return data;
  }

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      const [pendingRes, merchantsRes] = await Promise.all([
        apiFetch("/admin/merchants/pending"),
        apiFetch("/admin/merchants"),
      ]);

      setPendingItems(pendingRes.items || []);
      setMerchantItems(merchantsRes.items || []);
    } catch (err) {
      console.error(err);
      setMessage(err.message || "데이터 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approveMerchant(merchantId) {
    if (!window.confirm("해당 가입 신청을 승인하시겠습니까?")) return;

    try {
      setLoading(true);
      await apiFetch(`/admin/merchants/${encodeURIComponent(merchantId)}/approve`, {
        method: "POST",
      });
      await loadData();
      alert("승인되었습니다.");
    } catch (err) {
      console.error(err);
      alert(err.message || "승인 실패");
    } finally {
      setLoading(false);
    }
  }

  async function rejectMerchant(merchantId) {
    const rejectReason = window.prompt("거절 사유를 입력하세요.");
    if (!rejectReason) return;

    try {
      setLoading(true);
      await apiFetch(`/admin/merchants/${encodeURIComponent(merchantId)}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectReason }),
      });
      await loadData();
      alert("거절 처리되었습니다.");
    } catch (err) {
      console.error(err);
      alert(err.message || "거절 실패");
    } finally {
      setLoading(false);
    }
  }

  async function updateMerchant(merchantId, patch) {
    try {
      setLoading(true);
      await apiFetch(`/admin/merchants/${encodeURIComponent(merchantId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.message || "수정 실패");
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = async () => {
  try {
    await signOut({ global: true });
  } catch (err) {
    console.warn("signOut failed", err);
  }

  clearSession();

  localStorage.removeItem("idToken");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("parking_id_token");
  localStorage.removeItem("parking_access_token");

  window.location.replace("/login");
};

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">방문자 주차권 시스템</p>
            <h1 className="text-2xl font-bold">관리자 페이지</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="rounded-2xl border px-4 py-3 text-sm font-semibold hover:bg-slate-50"
              disabled={loading}
            >
              새로고침
            </button>
            <button
              onClick={handleLogout}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {message && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {message}
          </div>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">상가 가입 신청 관리</h2>
              <p className="mt-2 text-sm text-slate-600">
                가입 신청 상태가 pending인 상가 목록입니다.
              </p>
            </div>
            {loading && <span className="text-sm text-slate-500">처리 중...</span>}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3">신청 아이디</th>
                  <th>상가명</th>
                  <th>호실</th>
                  <th>신청일</th>
                  <th>상태</th>
                  <th className="text-right">처리</th>
                </tr>
              </thead>
              <tbody>
                {pendingItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-6 text-center text-slate-500">
                      가입 신청 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pendingItems.map((item) => (
                    <tr key={item.merchantId} className="border-b last:border-0">
                      <td className="py-3 font-semibold">{item.loginId || item.email || item.merchantId}</td>
                      <td>{item.buildingName || "-"}</td>
                      <td>{item.roomNo || "-"}</td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{item.status || "-"}</td>
                      <td className="space-x-2 text-right">
                        <button
                          onClick={() => approveMerchant(item.merchantId)}
                          className="rounded-xl border px-3 py-2 hover:bg-emerald-50"
                          disabled={loading}
                        >
                          승인
                        </button>
                        <button
                          onClick={() => rejectMerchant(item.merchantId)}
                          className="rounded-xl border px-3 py-2 hover:bg-rose-50"
                          disabled={loading}
                        >
                          거절
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">가입 사용자 관리</h2>
              <p className="mt-2 text-sm text-slate-600">
                승인된 사용자 목록입니다. 상가명 또는 아이디로 검색할 수 있습니다.
              </p>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="상가명 또는 아이디 검색"
              className="rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-3">아이디</th>
                  <th>상가명</th>
                  <th>호실</th>
                  <th>요금제</th>
                  <th>사용 횟수</th>
                  <th>차단기 MAC 주소</th>
                  <th className="w-[190px]">활성화</th>
                </tr>
              </thead>
              <tbody>
                {filteredMerchants.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-6 text-center text-slate-500">
                      가입된 사용자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredMerchants.map((item) => (
                    <tr key={item.merchantId} className="border-b last:border-0">
                      <td className="py-3 font-semibold">{item.loginId || item.email || item.merchantId}</td>
                      <td>{item.buildingName || "-"}</td>
                      <td>{item.roomNo || "-"}</td>
                      <td>
                        <select
                          value={item.planLimit === -1 ? "unlimited" : item.planLimit}
                          onChange={(e) => updateMerchant(item.merchantId, { planLimit: e.target.value })}
                          className="rounded-xl border px-3 py-2"
                          disabled={loading}
                        >
                          {PLAN_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option === "unlimited" ? "무제한" : option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {item.usedCount || 0} / {planLabel(item.planLimit)}
                      </td>
                      <td className="py-3">
                        <div className="grid min-w-[250px] grid-cols-1 gap-2">
                          {getParkingGates(item).map((gate) => (
                            <label key={gate.id} className="flex items-center gap-2">
                              <span className="w-12 shrink-0 text-xs font-semibold text-slate-600">
                                {gate.name}
                              </span>
                              <input
                                type="text"
                                defaultValue={gate.macAddress}
                                placeholder="AA:BB:CC:DD:EE:FF"
                                maxLength={17}
                                onBlur={(e) =>
                                  updateMerchant(item.merchantId, {
                                    parkingGates: buildParkingGatesWithMac(
                                      item,
                                      gate.id,
                                      e.target.value
                                    ),
                                  })
                                }
                                className="w-36 rounded-xl border px-2 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-300"
                                disabled={loading}
                              />
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(item.isActive)}
                              onChange={(e) =>
                                updateMerchant(item.merchantId, {
                                  isActive: e.target.checked,
                                })
                              }
                              disabled={loading}
                            />
                            <span>{item.isActive ? "활성화" : "비활성화"}</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => resetPassword(item.merchantId)}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50"
                            disabled={loading}
                          >
                            비밀번호 초기화
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
