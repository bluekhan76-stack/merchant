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
  const [ticketAddInputs, setTicketAddInputs] = useState({});

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


  function getAdditionalPasses(item) {
    return Number(item?.additionalPasses || item?.extraPasses || item?.addedPasses || 0);
  }

  function getMonthlyTotalLimit(item) {
    if (item?.planLimit === -1 || item?.planLimit === "unlimited") return -1;
    const monthlyQuota = Number(item?.monthlyQuota ?? item?.planLimit ?? 0);
    return monthlyQuota + getAdditionalPasses(item);
  }

  async function addParkingTickets(item) {
    if (!item?.merchantId) return;

    if (item.planLimit === -1 || item.planLimit === "unlimited") {
      alert("무제한 요금제는 주차권 추가가 필요하지 않습니다.");
      return;
    }

    const rawValue = ticketAddInputs[item.merchantId] ?? "";
    const addCount = Number(rawValue);

    if (!Number.isInteger(addCount) || addCount <= 0) {
      alert("추가할 주차권 수량을 1 이상의 정수로 입력해 주세요.");
      return;
    }

    const currentAdditionalPasses = getAdditionalPasses(item);
    const nextAdditionalPasses = currentAdditionalPasses + addCount;

    const ok = window.confirm(
      `이번 달 추가 주차권에 ${addCount}장을 추가하시겠습니까?\n현재 추가 주차권: ${currentAdditionalPasses}장 → 변경 후: ${nextAdditionalPasses}장`
    );
    if (!ok) return;

    await updateMerchant(item.merchantId, { additionalPasses: nextAdditionalPasses });
    setTicketAddInputs((prev) => ({ ...prev, [item.merchantId]: "" }));
    alert("이번 달 사용 주차권에 추가되었습니다.");
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-bold">사용기간 알림</h2>
              <p className="mt-2 text-sm text-slate-600">
                만료되었거나 7일 이내 만료 예정인 상가를 확인할 수 있습니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <div className="text-xs font-semibold text-rose-600">만료</div>
                <div className="mt-1 text-2xl font-bold text-rose-700">{expireAlert.expired.length}</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-xs font-semibold text-amber-700">7일 이내</div>
                <div className="mt-1 text-2xl font-bold text-amber-700">{expireAlert.expiring.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold text-slate-600">기간 미설정</div>
                <div className="mt-1 text-2xl font-bold text-slate-700">{expireAlert.missing.length}</div>
              </div>
            </div>
          </div>

          {expireAlert.attentionList.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-700">만료/만료 예정 상가</div>
              <div className="space-y-2">
                {expireAlert.attentionList.map(({ item, status }) => (
                  <div
                    key={item.merchantId}
                    className="flex flex-col gap-2 rounded-xl bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="font-semibold text-slate-800">{merchantDisplayName(item)}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className={`rounded-full border px-2 py-1 font-semibold ${status.badgeClass}`}>
                        {status.label}
                      </span>
                      <span>종료일: {formatDate(getSubscriptionEndValue(item))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              만료 또는 7일 이내 만료 예정인 상가가 없습니다.
            </div>
          )}
        </section>

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

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="w-[95px] py-3">아이디</th>
                  <th className="w-[95px]">상가명</th>
                  <th className="w-[55px]">호실</th>
                  <th className="w-[120px]">요금제</th>
                  <th className="w-[150px]">사용 횟수</th>
                  <th className="w-[170px]">사용기간 상태</th>
                  <th className="w-[140px]">주차권 추가</th>
                  <th className="w-[220px]">차단기 MAC 주소</th>
                  <th className="w-[180px]">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredMerchants.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-6 text-center text-slate-500">
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
                        <div className="whitespace-nowrap">
                          <div>
                            {item.usedCount || 0} / {getMonthlyTotalLimit(item) === -1 ? "무제한" : `${getMonthlyTotalLimit(item)}건`}
                          </div>
                          {getMonthlyTotalLimit(item) !== -1 && getAdditionalPasses(item) > 0 && (
                            <div className="text-xs text-slate-500">
                              기본 {item.monthlyQuota ?? item.planLimit ?? 0}건 + 추가 {getAdditionalPasses(item)}건
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const status = getSubscriptionStatus(item);
                          return (
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs font-semibold ${status.badgeClass}`}>
                                {status.label}
                              </span>
                              <div className="break-words text-xs leading-4 text-slate-500">
                                종료:<br />
                                {formatDate(getSubscriptionEndValue(item))}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3">
                        <div className="flex min-w-[150px] items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={ticketAddInputs[item.merchantId] || ""}
                            onChange={(e) =>
                              setTicketAddInputs((prev) => ({
                                ...prev,
                                [item.merchantId]: e.target.value,
                              }))
                            }
                            placeholder="수량"
                            className="w-20 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                            disabled={loading || item.planLimit === -1 || item.planLimit === "unlimited"}
                          />
                          <button
                            type="button"
                            onClick={() => addParkingTickets(item)}
                            className="rounded-xl border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={loading || item.planLimit === -1 || item.planLimit === "unlimited"}
                          >
                            추가
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="grid w-[245px] grid-cols-1 gap-2">
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
                                className="w-[138px] rounded-xl border px-2 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-300"
                                disabled={loading}
                              />
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 align-middle">
                        <div className="flex w-[170px] flex-col gap-2">
                          <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs whitespace-nowrap">
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
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs whitespace-nowrap hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
