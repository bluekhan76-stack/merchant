import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { clearSession } from "../auth/auth.js";
import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE = "https://8q72reoak2.execute-api.ap-northeast-2.amazonaws.com";
const PURCHASE_OPTIONS = {
  single: { label: "1장 구매", unit: 1, price: 1000 },
  bundle50: { label: "50장 구매", unit: 50, price: 20000 },
  bundle100: { label: "100장 구매", unit: 100, price: 15000 },
};

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

function isPayAsYouGoPlan(item) {
  return String(item?.planType || "").toLowerCase() === "payg" ||
    String(item?.planLimit || "").toLowerCase() === "payg";
}

function getUnitPrice(item) {
  const unitPrice = Number(item?.unitPrice || item?.paygUnitPrice || 0);
  return Number.isFinite(unitPrice) && unitPrice >= 0 ? Math.floor(unitPrice) : 0;
}

function formatCurrency(value) {
  const n = Number(value || 0);
  return `${new Intl.NumberFormat("ko-KR").format(Math.max(n, 0))}원`;
}

function purchaseOptionLabel(type) {
  return PURCHASE_OPTIONS[type]?.label || type || "-";
}

function getPurchaseRequests(item) {
  const requests = item?.purchaseRequests || item?.passPurchaseRequests || item?.ticketPurchaseRequests || [];
  return Array.isArray(requests) ? requests : [];
}

function getPendingPurchaseRequests(item) {
  return getPurchaseRequests(item).filter((row) => String(row?.status || "PENDING").toUpperCase() === "PENDING");
}

function getPurchaseHistoryRows(item) {
  const requests = getPurchaseRequests(item);
  const history = item?.purchaseHistory || item?.passPurchaseHistory || item?.ticketPurchaseHistory || [];
  const rows = [...requests, ...(Array.isArray(history) ? history : [])];

  return rows
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = new Date(a?.createdAt || a?.requestedAt || a?.approvedAt || 0).getTime();
      const bTime = new Date(b?.createdAt || b?.requestedAt || b?.approvedAt || 0).getTime();
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
}

function purchaseStatusLabel(status) {
  const value = String(status || "PENDING").toUpperCase();
  if (value === "APPROVED") return "승인";
  if (value === "REJECTED") return "거절";
  return "승인 대기";
}

function getAvailablePasses(item) {
  const candidates = [item?.availablePasses, item?.approvedPasses, item?.purchasedPasses, item?.remainingPasses, item?.additionalPasses];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 0;
}

function getKstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTodayIssuedCount(item) {
  const serverDate = String(item?.todayIssuedDate || "");
  const todayKey = getKstDateKey();

  if (serverDate && serverDate !== todayKey) {
    return 0;
  }

  const count = Number(item?.todayIssuedCount || 0);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

function planLabel(value, planType) {
  if (String(planType || "").toLowerCase() === "payg" || String(value || "").toLowerCase() === "payg") return "종량제";
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


function isApprovedMerchant(item) {
  const status = String(item?.status || "").toLowerCase();
  return status === "approved" || item?.isActive === true;
}

function addOneMonth(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

function getSubscriptionStartValue(item) {
  return (
    item?.subscriptionStartAt ||
    item?.subscriptionStartDate ||
    item?.validFrom ||
    item?.serviceStartAt ||
    item?.startAt ||
    item?.approvedAt ||
    item?.approvedDate ||
    item?.updatedAt ||
    ""
  );
}

function getSubscriptionEndDate(item) {
  const savedEndValue =
    item?.subscriptionEndAt ||
    item?.subscriptionEndDate ||
    item?.expireAt ||
    item?.expiredAt ||
    item?.validUntil ||
    item?.serviceEndAt ||
    item?.endAt ||
    "";

  if (savedEndValue) {
    const savedEndDate = new Date(savedEndValue);
    if (!Number.isNaN(savedEndDate.getTime())) return savedEndDate;
    return null;
  }

  if (!isApprovedMerchant(item)) return null;

  const startValue = getSubscriptionStartValue(item);
  if (!startValue) return null;

  return addOneMonth(startValue);
}

function getSubscriptionEndValue(item) {
  const endDate = getSubscriptionEndDate(item);
  return endDate ? endDate.toISOString() : "";
}

function getSubscriptionStatus(item) {
  const endDate = getSubscriptionEndDate(item);

  if (!endDate) {
    return {
      key: "missing",
      label: "기간 미설정",
      badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
      daysLeft: null,
      endDate: null,
    };
  }

  const now = new Date();
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      key: "expired",
      label: `만료 ${Math.abs(daysLeft)}일 경과`,
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
      daysLeft,
      endDate,
    };
  }

  if (daysLeft <= 7) {
    return {
      key: "expiring",
      label: daysLeft === 0 ? "오늘 만료" : `${daysLeft}일 이내 만료`,
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      daysLeft,
      endDate,
    };
  }

  return {
    key: "active",
    label: "정상",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    daysLeft,
    endDate,
  };
}

function merchantDisplayName(item) {
  const loginId = item?.loginId || item?.email || item?.merchantId || "-";
  const building = item?.buildingName || "상가명 없음";
  const room = item?.roomNo ? ` / ${item.roomNo}` : "";
  return `${building}${room} (${loginId})`;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [pendingItems, setPendingItems] = useState([]);
  const [merchantItems, setMerchantItems] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedPurchaseHistoryId, setExpandedPurchaseHistoryId] = useState("");

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

  const expireAlert = useMemo(() => {
    const rows = merchantItems.map((item) => ({
      item,
      status: getSubscriptionStatus(item),
    }));

    const expired = rows.filter((row) => row.status.key === "expired");
    const expiring = rows.filter((row) => row.status.key === "expiring");
    const missing = rows.filter((row) => row.status.key === "missing");
    const attentionList = [...expired, ...expiring]
      .sort((a, b) => {
        const aTime = a.status.endDate?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.status.endDate?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .slice(0, 8);

    return { expired, expiring, missing, attentionList };
  }, [merchantItems]);

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


  async function approvePurchaseRequest(item, request) {
    if (!item?.merchantId || !request) return;

    const quantity = Number(request.quantity || 0);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      alert("승인할 구매 수량이 올바르지 않습니다.");
      return;
    }

    const ok = window.confirm(`${merchantDisplayName(item)}의 ${purchaseOptionLabel(request.purchaseType)} ${quantity}장을 승인하시겠습니까?`);
    if (!ok) return;

    try {
      setLoading(true);
      const requestId = request.requestId || request.id || request.createdAt || "latest";
      await apiFetch(`/admin/merchants/${encodeURIComponent(item.merchantId)}/purchase-requests/${encodeURIComponent(requestId)}/approve`, {
        method: "POST",
        body: JSON.stringify({
          requestId,
          purchaseType: request.purchaseType,
          quantity,
          totalAmount: Number(request.totalAmount || 0),
        }),
      });
      await loadData();
      alert("구매 요청이 승인되었습니다.");
    } catch (err) {
      console.error(err);
      alert(err.message || "구매 요청 승인 실패");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(merchantId) {
    if (!window.confirm("해당 사용자의 비밀번호를 초기화하시겠습니까?")) return;

    try {
      setLoading(true);
      await apiFetch(`/admin/merchants/${encodeURIComponent(merchantId)}/reset-password`, {
        method: "POST",
      });
      alert("비밀번호 초기화가 요청되었습니다.");
    } catch (err) {
      console.error(err);
      alert(err.message || "비밀번호 초기화 실패");
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
                    <td colSpan="6" className="py-6 text-center text-slate-500">
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

          <div className="mt-4 space-y-4">
            {filteredMerchants.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 py-8 text-center text-sm text-slate-500">
                가입된 사용자가 없습니다.
              </div>
            ) : (
              filteredMerchants.map((item) => {
                const pendingRequests = getPendingPurchaseRequests(item);
                const historyRows = getPurchaseHistoryRows(item);

                return (
                  <div
                    key={item.merchantId}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_1fr]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-500">아이디</div>
                          <div className="mt-1 break-all font-semibold">
                            {item.loginId || item.email || item.merchantId}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500">상가명</div>
                          <div className="mt-1">{item.buildingName || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500">호실</div>
                          <div className="mt-1">{item.roomNo || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-500">사용 가능 주차권</div>
                          <div className="mt-1 font-bold text-slate-900">{getAvailablePasses(item)}장</div>
                          <div className="text-xs text-slate-500">오늘 {getTodayIssuedCount(item)}건 발행</div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-blue-50 p-3 ring-1 ring-blue-100">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-blue-700">구매 승인 요청</div>
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">
                            {pendingRequests.length}건
                          </span>
                        </div>
                        {pendingRequests.length === 0 ? (
                          <div className="rounded-xl bg-white/70 px-3 py-4 text-center text-xs text-slate-500">
                            승인 대기 구매 요청이 없습니다.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pendingRequests.map((request, index) => (
                              <div key={request.requestId || request.id || index} className="rounded-xl bg-white p-2 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-semibold text-slate-900">
                                      {purchaseOptionLabel(request.purchaseType)} / {Number(request.quantity || 0)}장
                                    </div>
                                    <div className="mt-1 text-slate-500">
                                      요청일: {formatDate(request.createdAt || request.requestedAt)}
                                    </div>
                                    <div className="mt-1 text-slate-600">
                                      금액: {formatCurrency(request.totalAmount || 0)}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => approvePurchaseRequest(item, request)}
                                    className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={loading}
                                  >
                                    승인
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="mb-2 text-xs font-semibold text-slate-500">차단기 MAC 주소</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
                                className="w-full min-w-0 rounded-xl border bg-white px-2 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-300"
                                disabled={loading}
                              />
                            </label>
                          ))}
                        </div>

                        <div className="mt-3 rounded-2xl bg-white p-3">
                          <div className="mb-2 text-xs font-semibold text-slate-500">관리</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs whitespace-nowrap">
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
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs whitespace-nowrap hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={loading}
                            >
                              비밀번호 초기화
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPurchaseHistoryId((prev) =>
                            prev === item.merchantId ? "" : item.merchantId
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800">구매 히스토리</div>
                          <div className="mt-1 text-xs text-slate-500">날짜별 요청한 구매단위와 수량을 확인합니다.</div>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {expandedPurchaseHistoryId === item.merchantId ? "접기" : "펼치기"}
                        </span>
                      </button>

                      {expandedPurchaseHistoryId === item.merchantId && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full min-w-[520px] text-left text-xs">
                            <thead className="border-b text-slate-500">
                              <tr>
                                <th className="py-2">날짜</th>
                                <th>구매단위</th>
                                <th className="text-right">수량</th>
                                <th className="text-right">금액</th>
                                <th className="text-right">상태</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historyRows.length === 0 ? (
                                <tr>
                                  <td colSpan="5" className="py-5 text-center text-slate-500">구매 히스토리가 없습니다.</td>
                                </tr>
                              ) : (
                                historyRows.map((row, index) => (
                                  <tr key={row.requestId || row.id || index} className="border-b last:border-0">
                                    <td className="py-2">{formatDate(row.createdAt || row.requestedAt || row.approvedAt)}</td>
                                    <td>{purchaseOptionLabel(row.purchaseType)}</td>
                                    <td className="text-right font-semibold">{Number(row.quantity || 0)}장</td>
                                    <td className="text-right">{formatCurrency(row.totalAmount || 0)}</td>
                                    <td className="text-right">{purchaseStatusLabel(row.status)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
