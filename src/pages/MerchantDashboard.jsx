import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { signOut } from "aws-amplify/auth";

const STORAGE_KEYS = {
  merchant: "merchant_owner_demo_profile",
  invites: "merchant_owner_demo_invites",
  favorites: "merchant_owner_demo_favorites",
};

const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "https://8q72reoak2.execute-api.ap-northeast-2.amazonaws.com";

const API_PATHS = {
  requestPass: "/passes/request",
  merchantMe: "/merchant/me",
  purchaseRequest: "/merchant/purchase-requests",
};


const PURCHASE_OPTIONS = [
  { key: "single", label: "1장 구매", unit: 1, price: 1000, step: 1, helper: "수량 1 입력 = 1장", inputLabel: "장" },
  { key: "bundle50", label: "50장 구매", unit: 50, price: 20000, step: 1, helper: "수량 1 입력 = 50장 1세트", inputLabel: "세트" },
  { key: "bundle200", label: "200장 구매", unit: 200, price: 30000, step: 1, helper: "수량 1 입력 = 200장 1세트", inputLabel: "세트" },
];

const DEPOSIT_BANK_TEXT = "신한은행 : xxx-xx-xxxxxx (예금주 : 파킹크루즈)";

function getPurchaseOption(key) {
  return PURCHASE_OPTIONS.find((item) => item.key === key) || PURCHASE_OPTIONS[0];
}

function normalizePurchaseQuantity(key, value) {
  const option = getPurchaseOption(key);
  const raw = Number(String(value || "").replace(/\D/g, ""));
  if (!Number.isFinite(raw) || raw <= 0) return 0;

  // 입력 칸의 값은 구매 단위 수량입니다.
  // 예: 50장 구매에서 1 입력 = 50장 1세트, 2 입력 = 100장 2세트
  return Math.floor(raw) * option.unit;
}

function purchaseTotalAmount(key, quantity) {
  const option = getPurchaseOption(key);
  const qty = normalizePurchaseQuantity(key, quantity);
  return qty > 0 ? Math.floor(qty / option.unit) * option.price : 0;
}

function purchaseSetCount(key, quantity) {
  const option = getPurchaseOption(key);
  const qty = normalizePurchaseQuantity(key, quantity);
  return qty > 0 ? Math.floor(qty / option.unit) : 0;
}

function getAvailablePasses(merchant) {
  const planType = String(merchant?.planType || "").toLowerCase() === "payg" ||
    String(merchant?.planLimit || "").toLowerCase() === "payg"
    ? "payg"
    : "subscription";

  if (planType === "payg") return 0;

  const rawPlanLimit = merchant?.monthlyQuota ?? merchant?.planLimit;
  const planLimit = rawPlanLimit === "unlimited" ? -1 : Number(rawPlanLimit ?? 0);

  if (planLimit === -1) {
    return Number.MAX_SAFE_INTEGER;
  }

  const additionalPasses = Number(merchant?.additionalPasses || 0);
  const usedCount = Number(merchant?.usedCount || 0);

  if (Number.isFinite(planLimit) && planLimit >= 0) {
    return Math.max(
      Math.floor(planLimit) +
        (Number.isFinite(additionalPasses) ? Math.floor(additionalPasses) : 0) -
        (Number.isFinite(usedCount) ? Math.floor(usedCount) : 0),
      0
    );
  }

  const fallbackCandidates = [
    merchant?.remainingPasses,
    merchant?.availablePasses,
    merchant?.approvedPasses,
    merchant?.purchasedPasses,
    merchant?.additionalPasses,
  ];

  for (const value of fallbackCandidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }

  return 0;
}

function clearAuthStorageOnly() {
  [
    "idToken",
    "accessToken",
    "refreshToken",
    "parking_id_token",
    "parking_access_token",
    "role",
    "isAuthenticated",
    "session",
  ].forEach((key) => localStorage.removeItem(key));

  sessionStorage.clear();
}

async function handleLogout() {
  try {
    await signOut();
  } catch (err) {
    console.error(err);
  } finally {
    // 발행 이력/즐겨찾기/상가 캐시는 유지하고 인증 관련 값만 정리합니다.
    // todayIssuedCount는 서버 기준으로 다시 조회되므로 로그아웃 후 재로그인해도 유지됩니다.
    clearAuthStorageOnly();
    window.location.href = "/login";
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

function isPayAsYouGoPlan(merchant) {
  return String(merchant?.planType || "").toLowerCase() === "payg" ||
    String(merchant?.planLimit || "").toLowerCase() === "payg";
}

function getUnitPrice(merchant) {
  const unitPrice = Number(merchant?.unitPrice || merchant?.paygUnitPrice || 0);
  return Number.isFinite(unitPrice) && unitPrice >= 0 ? Math.floor(unitPrice) : 0;
}

function formatCurrency(value) {
  const n = Number(value || 0);
  return `${new Intl.NumberFormat("ko-KR").format(Math.max(n, 0))}원`;
}

function getKstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getServerTodayIssuedCount(merchant) {
  const serverDate = String(merchant?.todayIssuedDate || "");
  const todayKey = getKstDateKey();

  if (serverDate && serverDate !== todayKey) {
    return 0;
  }

  const count = Number(merchant?.todayIssuedCount || 0);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

function planLabel(planLimit, planType) {
  if (String(planType || "").toLowerCase() === "payg" || String(planLimit || "").toLowerCase() === "payg") return "종량제";
  if (planLimit === -1 || planLimit === "unlimited") return "무제한";
  if (planLimit === undefined || planLimit === null || planLimit === "") return "-";
  return `월 ${planLimit}건`;
}

function mapMerchantFromApi(item) {
  const planType = String(item?.planType || "").toLowerCase() === "payg" || String(item?.planLimit || "").toLowerCase() === "payg" ? "payg" : "subscription";
  const planLimit = planType === "payg" ? 0 : item?.planLimit === "unlimited" ? -1 : Number(item?.monthlyQuota ?? item?.planLimit ?? defaultMerchant.monthlyQuota);
  const additionalPasses = planType === "payg" ? 0 : Number(item?.additionalPasses || 0);
  const unitPrice = getUnitPrice(item);
  const buildingName = item?.buildingName || item?.shopName || defaultMerchant.shopName;
  const roomNo = item?.roomNo || "";
  const shopName = buildingName;

  return {
    ...defaultMerchant,
    ...item,
    merchantId: item?.merchantId || "",
    email: item?.email || "",
    buildingName,
    roomNo,
    shopName,
    ownerName: item?.ownerName || item?.email || defaultMerchant.ownerName,
    address: item?.address || buildingName,
    planType,
    unitPrice,
    planLimit,
    planName: planLabel(planLimit, planType),
    monthlyQuota: planLimit,
    additionalPasses,
    availablePasses: getAvailablePasses(item),
    purchaseRequests: Array.isArray(item?.purchaseRequests) ? item.purchaseRequests : [],
    purchaseHistory: Array.isArray(item?.purchaseHistory) ? item.purchaseHistory : [],
    totalLimit: planLimit === -1 || planType === "payg" ? -1 : planLimit + additionalPasses,
    estimatedAmount: planType === "payg" ? Number(item?.estimatedAmount ?? Number(item?.usedCount || 0) * unitPrice) : 0,
    usageHistory: Array.isArray(item?.usageHistory) ? item.usageHistory : [],
    usedCount: Number(item?.usedCount || 0),
    todayIssuedDate: item?.todayIssuedDate || "",
    todayIssuedCount: getServerTodayIssuedCount(item),
    isActive: item?.isActive !== false,
    status: item?.status || "pending",
    parkingGates: normalizeParkingGates(item?.parkingGates || item?.gates || item?.parkingGateMacAddresses || item?.gateMacAddresses),
  };
}

async function fetchMerchantMe() {
  const token = await getIdToken();

  const response = await fetch(`${API_BASE_URL}${API_PATHS.merchantMe}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `상가 정보를 불러오지 못했습니다. (${response.status})`);
  }

  return mapMerchantFromApi(data.merchant || data.item || data);
}

const BARRIER_OPTIONS = [
  { id: "gate-1", name: "차단기 1" },
  { id: "gate-2", name: "차단기 2" },
  { id: "gate-3", name: "차단기 3" },
  { id: "gate-4", name: "차단기 4" },
];

function normalizeParkingGates(value) {
  const source = Array.isArray(value) && value.length > 0 ? value : BARRIER_OPTIONS;

  return source
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          id: `gate-${index + 1}`,
          name: `차단기 ${index + 1}`,
          macAddress: item.trim().toUpperCase(),
        };
      }

      const id = (item?.id || item?.gateId || `gate-${index + 1}`).toString();
      const name = (item?.name || item?.gateName || item?.label || `차단기 ${index + 1}`).toString();
      const macAddress = (item?.macAddress || item?.mac || item?.gateMac || item?.address || "")
        .toString()
        .trim()
        .toUpperCase();

      return {
        ...item,
        id,
        name,
        ...(macAddress ? { macAddress } : {}),
      };
    })
    .filter((item) => item.id);
}

function parkingGatesFromIds(gateIds, merchantParkingGates = BARRIER_OPTIONS) {
  const selectedIds = normalizeGateIds(gateIds);
  return normalizeParkingGates(merchantParkingGates).filter((gate) => selectedIds.includes(gate.id));
}


const DURATION_OPTIONS = [
  { value: "30", label: "30분" },
  { value: "60", label: "1시간" },
  { value: "120", label: "2시간" },
  { value: "240", label: "4시간" },
  { value: "480", label: "8시간" },
  { value: "1440", label: "24시간" },
];

const defaultMerchant = {
  shopName: "A동 201호",
  ownerName: "정태윤",
  phone: "010-1111-2222",
  address: "수원시 영통구 예시로 123",
  planName: "월 300건",
  monthlyQuota: 300,
  status: "pending",
  isActive: true,
  parkingGates: BARRIER_OPTIONS,
};

function safeUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback below
    }
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function futureIso(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function toDateTimeLocalValue(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function localDateTimeNowValue() {
  return toDateTimeLocalValue(new Date().toISOString());
}

function addMinutesToLocalDateTimeValue(baseValue, minutes) {
  const base = new Date(baseValue);
  if (Number.isNaN(base.getTime())) return "";
  return toDateTimeLocalValue(new Date(base.getTime() + Number(minutes) * 60 * 1000).toISOString());
}

function displayDate(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}


function addMonthsClamped(date, months) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const day = d.getDate();
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);

  // 월말 날짜 보정: 1/31 + 1개월 같은 경우 다음 달 말일로 맞춥니다.
  if (next.getDate() !== day) {
    next.setDate(0);
  }

  return next;
}

function getMerchantApprovedDate(merchant) {
  const raw =
    merchant?.approvedAt ||
    merchant?.approvedDate ||
    merchant?.approvalDate ||
    merchant?.joinedAt ||
    merchant?.joinedDate ||
    merchant?.registeredAt ||
    merchant?.createdAt ||
    merchant?.createdDate ||
    merchant?.signupAt ||
    merchant?.signupDate ||
    "";

  const date = raw ? new Date(raw) : null;
  if (date && !Number.isNaN(date.getTime())) return date;

  return new Date();
}

function getBillingCycle(merchant) {
  const baseDate = getMerchantApprovedDate(merchant);
  const now = new Date();

  let start = new Date(baseDate);
  let end = addMonthsClamped(start, 1);

  while (end && now.getTime() >= end.getTime()) {
    start = new Date(end);
    end = addMonthsClamped(start, 1);
  }

  return {
    start,
    end: end || addMonthsClamped(now, 1) || now,
  };
}

function displayDateOnly(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function displayBillingPeriod(cycle) {
  if (!cycle?.start || !cycle?.end) return "-";
  return `${displayDateOnly(cycle.start)} ~ ${displayDateOnly(cycle.end)}`;
}

function daysUntilCycleEnd(cycle) {
  if (!cycle?.end) return 0;

  const now = new Date();
  const end = new Date(cycle.end);
  if (Number.isNaN(end.getTime())) return 0;

  const diff = end.getTime() - now.getTime();
  return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
}

function merchantAccountText() {
  return "신한은행 xxx-xx-xxxxxxx";
}


function displayDuration(minutes) {
  const value = Number(minutes || 0);
  if (value % 1440 === 0) return `${value / 1440}일`;
  if (value % 60 === 0) return `${value / 60}시간`;
  return `${value}분`;
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function isValidPhone(value) {
  return /^01[016789]-\d{3,4}-\d{4}$/.test(value);
}

function deepLinkFor(phone, inviteId, inviteCode) {
  const inviteKey = inviteCode || inviteId || "";
  // 외부 공유용 링크는 카톡/SMS/메일에서 안정적으로 열리도록 HTTPS 루트 링크를 사용합니다.
  // App()에서 ?code 파라미터를 감지하면 OpenBridgePage를 렌더링하여 앱을 실행합니다.
  const url = new URL(window.location.origin);
  url.searchParams.set("code", inviteKey);
  return url.toString();
}

function statusTone(status) {
  if (status === "앱 수신") return "bg-emerald-50 text-emerald-700";
  if (status === "만료") return "bg-rose-50 text-rose-700";
  if (status === "재발송") return "bg-amber-50 text-amber-700";
  if (status === "사용 완료") return "bg-blue-50 text-blue-700";
  if (status === "취소") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function normalizeGateIds(gateIds) {
  const fallbackIds = [BARRIER_OPTIONS[0].id];
  if (!Array.isArray(gateIds) || gateIds.length === 0) return fallbackIds;
  return gateIds.filter((value, index, array) => value && array.indexOf(value) === index);
}

function gateNamesFromIds(gateIds, merchantParkingGates = BARRIER_OPTIONS) {
  return normalizeGateIds(gateIds)
    .map((id) => merchantParkingGates.find((item) => item.id === id)?.name)
    .filter(Boolean);
}

function sanitizeInvite(item) {
  const parkingGateIds = normalizeGateIds(
    item?.parkingGateIds || (item?.parkingGateId ? [item.parkingGateId] : null)
  );
  const parkingGateNames =
    Array.isArray(item?.parkingGateNames) && item.parkingGateNames.length > 0
      ? item.parkingGateNames
      : item?.parkingGateName
        ? [item.parkingGateName]
        : gateNamesFromIds(parkingGateIds);

  return {
    id: item?.id || safeUuid(),
    inviteId: item?.inviteId || item?.id || "",
    inviteCode: item?.inviteCode || "",
    visitorName: item?.visitorName || "",
    phone: item?.phone || "",
    shopName: item?.shopName || defaultMerchant.shopName,
    parkingGateIds,
    parkingGateNames,
    memo: item?.memo || "",
    durationMinutes: Number(item?.durationMinutes || 60),
    expiresAt: item?.expiresAt || futureIso(60),
    ticketValidFrom: item?.ticketValidFrom || nowIso(),
    ticketValidUntil: item?.ticketValidUntil || futureIso(60 * 24),
    usageLimit: Number(item?.usageLimit || 1),
    status: item?.status || "발행 완료",
    createdAt: item?.createdAt || nowIso(),
    serverSynced: item?.serverSynced ?? false,
    serverInviteUrl: item?.serverInviteUrl || "",
    issueMethod: item?.issueMethod || item?.deliveryMethod || (item?.phone === "QR 스캔 발급" ? "qr" : "sms"),
    usedAt: item?.usedAt || "",
  };
}

function makeSeedInvites() {
  return [
    sanitizeInvite({
      id: safeUuid(),
      visitorName: "김민수",
      phone: "010-1234-5678",
      shopName: "A동 201호",
      parkingGateIds: ["gate-1"],
      parkingGateNames: ["차단기 1"],
      memo: "12가 3456 / 미팅 방문",
      durationMinutes: 60,
      expiresAt: futureIso(60),
      ticketValidFrom: nowIso(),
      ticketValidUntil: futureIso(60 * 24),
      usageLimit: 1,
      status: "앱 수신",
      createdAt: nowIso(),
    }),
    sanitizeInvite({
      id: safeUuid(),
      visitorName: "김민수",
      phone: "010-1234-5678",
      shopName: "A동 201호",
      parkingGateIds: ["gate-2", "gate-3"],
      parkingGateNames: ["차단기 2", "차단기 3"],
      memo: "재방문 / 납품 차량",
      durationMinutes: 120,
      expiresAt: futureIso(120),
      ticketValidFrom: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      ticketValidUntil: futureIso(60 * 36),
      usageLimit: 3,
      status: "발행 완료",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    }),
    sanitizeInvite({
      id: safeUuid(),
      visitorName: "박지현",
      phone: "010-9876-5432",
      shopName: "A동 201호",
      parkingGateIds: BARRIER_OPTIONS.map((item) => item.id),
      parkingGateNames: BARRIER_OPTIONS.map((item) => item.name),
      memo: "차량번호 미입력",
      durationMinutes: 480,
      expiresAt: futureIso(480),
      ticketValidFrom: nowIso(),
      ticketValidUntil: futureIso(60 * 72),
      usageLimit: 5,
      status: "발행 완료",
      createdAt: nowIso(),
    }),
  ];
}

function buildInitialForm(defaultGateId = BARRIER_OPTIONS[0].id) {
  const nowValue = localDateTimeNowValue();
  return {
    visitorName: "",
    phone: "",
    durationMinutes: "60",
    selectedGateIds: [defaultGateId],
    memo: "",
    usageLimit: "1",
    ticketValidFrom: nowValue,
    ticketValidUntil: addMinutesToLocalDateTimeValue(nowValue, 60),
    customValidityRange: false,
    issueMethod: "manual",
  };
}

function buildPendingPass({ form, merchant, invites }) {
  const selectedGateIds = normalizeGateIds(form.selectedGateIds);
  const selectedGateNames = gateNamesFromIds(selectedGateIds, merchant.parkingGates);
  const history = invites
    .filter((item) => item.phone === form.phone)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    id: safeUuid(),
    visitorName: form.visitorName.trim() || "이름 미입력",
    phone: form.phone,
    shopName: merchant.shopName,
    parkingGateIds: selectedGateIds,
    parkingGateNames: selectedGateNames,
    parkingGates: parkingGatesFromIds(selectedGateIds, merchant.parkingGates),
    memo: form.memo.trim(),
    durationMinutes: Number(form.durationMinutes),
    expiresAt: futureIso(Number(form.durationMinutes)),
    ticketValidFrom: new Date(form.ticketValidFrom).toISOString(),
    ticketValidUntil: new Date(form.ticketValidUntil).toISOString(),
    usageLimit: Number(form.usageLimit),
    issueMethod: form.issueMethod || "sms",
    status: "발행 완료",
    createdAt: nowIso(),
    history,
    visitCount: history.length,
  };
}

async function requestParkingPass({
  phone,
  visitorName,
  parkingGateId,
  parkingGateIds,
  parkingGateNames,
  parkingGates,
  validMinutes,
  memo,
  usageLimit,
  ticketValidFrom,
  ticketValidUntil,
  issueMethod,
  deliveryMethod,
  merchantShopName,
  merchantOwnerName,
  merchantPhone,
}) {
  const normalizedPhone = String(phone || "").replace(/\D/g, "");
  const token = await getIdToken();

  const response = await fetch(`${API_BASE_URL}${API_PATHS.requestPass}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone: normalizedPhone,
      visitorName: visitorName || "",
      parkingGateId,
      parkingGateIds: Array.isArray(parkingGateIds) ? parkingGateIds : undefined,
      parkingGateNames: Array.isArray(parkingGateNames) ? parkingGateNames : undefined,
      parkingGates: Array.isArray(parkingGates) ? parkingGates : undefined,
      validMinutes,
      memo: memo || "",
      usageLimit,
      ticketValidFrom,
      ticketValidUntil,
      issueMethod: issueMethod || undefined,
      deliveryMethod: deliveryMethod || undefined,
      merchantShopName: merchantShopName || undefined,
      merchantOwnerName: merchantOwnerName || undefined,
      merchantPhone: merchantPhone || undefined,
    }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || "서버 요청에 실패했습니다.");
  }

  return data || {};
}

async function submitPurchaseRequest({ purchaseType, quantity }) {
  const option = getPurchaseOption(purchaseType);
  const normalizedQuantity = Number(quantity || 0);

  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    throw new Error(`${option.label} 수량을 1 이상 입력해 주세요.`);
  }

  const token = await getIdToken();
  const response = await fetch(`${API_BASE_URL}${API_PATHS.purchaseRequest}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      purchaseType,
      label: option.label,
      unit: option.unit,
      unitPrice: option.price,
      quantity: normalizedQuantity,
      totalAmount: Math.floor(normalizedQuantity / option.unit) * option.price,
      status: "PENDING",
    }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `구매 요청에 실패했습니다. (${response.status})`);
  }

  return data;
}

async function requestQrParkingPass({
  visitorName,
  parkingGateIds,
  parkingGateNames,
  parkingGates,
  validMinutes,
  memo,
  usageLimit,
  ticketValidFrom,
  ticketValidUntil,
  merchant,
}) {
  return requestParkingPass({
    phone: "",
    visitorName: visitorName || "QR 방문자",
    parkingGateId: parkingGateIds[0],
    parkingGateIds,
    parkingGateNames,
    parkingGates,
    validMinutes,
    memo: memo || "",
    usageLimit,
    ticketValidFrom,
    ticketValidUntil,
    issueMethod: "qr",
    deliveryMethod: "qr",
    merchantShopName: merchant?.shopName || "",
    merchantOwnerName: merchant?.ownerName || "",
    merchantPhone: merchant?.phone || "",
  });
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-3 py-3">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MerchantDashboard() {
  const [merchant, setMerchant] = useState(defaultMerchant);
  const [invites, setInvites] = useState([]);
  const [form, setForm] = useState(buildInitialForm(defaultMerchant.parkingGates[0].id));
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingPass, setPendingPass] = useState(null);
  const [pendingQrPass, setPendingQrPass] = useState(null);
  const [qrConfirmModalOpen, setQrConfirmModalOpen] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showUsageHistoryPanel, setShowUsageHistoryPanel] = useState(false);
  const [barrierSectionOpen, setBarrierSectionOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState("");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrTicket, setQrTicket] = useState(null);
  const [qrTicketUsed, setQrTicketUsed] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrModalNotice, setQrModalNotice] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [issuedInvite, setIssuedInvite] = useState(null);
  const [inviteResultModalOpen, setInviteResultModalOpen] = useState(false);
  const [purchaseInputs, setPurchaseInputs] = useState(() => ({ single: "", bundle50: "", bundle200: "" }));
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMerchantAndLocalData() {
      setApiStatus("상가 정보를 불러오는 중입니다...");

      try {
        const nextMerchant = await fetchMerchantMe();
        if (!cancelled) {
          setMerchant(nextMerchant);
          localStorage.setItem(STORAGE_KEYS.merchant, JSON.stringify(nextMerchant));
          setApiStatus("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "상가 정보를 불러오지 못했습니다.");
          setApiStatus("");

          const savedMerchant = localStorage.getItem(STORAGE_KEYS.merchant);
          if (savedMerchant) {
            try {
              setMerchant({ ...defaultMerchant, ...JSON.parse(savedMerchant), parkingGates: normalizeParkingGates(JSON.parse(savedMerchant)?.parkingGates) });
            } catch {
              setMerchant(defaultMerchant);
            }
          }
        }
      }

      try {
        const savedInvites = localStorage.getItem(STORAGE_KEYS.invites);
        const parsedInvites = savedInvites ? JSON.parse(savedInvites) : [];
        const safeInvites = Array.isArray(parsedInvites) ? parsedInvites.map(sanitizeInvite) : [];
        if (!cancelled) setInvites(safeInvites);
        localStorage.setItem(STORAGE_KEYS.invites, JSON.stringify(safeInvites));

        const savedFavorites = localStorage.getItem(STORAGE_KEYS.favorites);
        const parsedFavorites = savedFavorites ? JSON.parse(savedFavorites) : [];
        if (!cancelled) setFavorites(Array.isArray(parsedFavorites) ? parsedFavorites : []);
      } catch {
        if (!cancelled) {
          setInvites([]);
          setFavorites([]);
        }
        localStorage.setItem(STORAGE_KEYS.invites, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([]));
      }
    }

    loadMerchantAndLocalData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!merchant.parkingGates?.length) return;

    setForm((prev) => {
      const validIds = prev.selectedGateIds.filter((id) => merchant.parkingGates.some((item) => item.id === id));
      if (validIds.length > 0) {
        if (String(prev.usageLimit) === String(Math.min(Math.max(Number(prev.usageLimit || 1), 1), Math.max(remainingPassesRef.current, 1)))) {
          return { ...prev, selectedGateIds: validIds };
        }
        return { ...prev, selectedGateIds: validIds };
      }
      return {
        ...prev,
        selectedGateIds: [merchant.parkingGates[0].id],
      };
    });
  }, [merchant]);

  const isPayAsYouGo = isPayAsYouGoPlan(merchant);
  const isUnlimitedPlan = !isPayAsYouGo && merchant.monthlyQuota === -1;
  const unitPrice = getUnitPrice(merchant);

  const billingCycle = useMemo(() => getBillingCycle(merchant), [merchant]);
  const billingPeriodText = useMemo(() => displayBillingPeriod(billingCycle), [billingCycle]);
  const rechargeDday = useMemo(() => daysUntilCycleEnd(billingCycle), [billingCycle]);
  const accountText = useMemo(() => merchantAccountText(merchant), [merchant]);

  const remainingPasses = useMemo(() => {
    return getAvailablePasses(merchant);
  }, [merchant]);

  const remainingPassesRef = useRef(remainingPasses);
  useEffect(() => {
    remainingPassesRef.current = remainingPasses;
  }, [remainingPasses]);

  const isMerchantApproved = merchant.status === "approved";
  const canIssueParkingPass = isMerchantApproved && merchant.isActive !== false;

  useEffect(() => {
    if (isPayAsYouGo) return;
    setForm((prev) => ({
      ...prev,
      usageLimit: String(Math.min(Math.max(Number(prev.usageLimit || 1), 1), Math.max(remainingPasses, 1))),
    }));
  }, [remainingPasses, isPayAsYouGo]);

  // 운영 표시값은 서버 카운트를 우선 사용합니다.
  // localStorage 발행내역은 로그아웃/기기 변경에 따라 달라질 수 있으므로 보조값으로만 사용합니다.
  const todayIssued = useMemo(() => {
    return getServerTodayIssuedCount(merchant);
  }, [merchant.todayIssuedDate, merchant.todayIssuedCount]);

  const filteredInvites = useMemo(() => {
    if (filter === "all") return invites;
    return invites.filter((item) => item.status === filter);
  }, [invites, filter]);

  const allBarrierIds = useMemo(() => merchant.parkingGates.map((item) => item.id), [merchant.parkingGates]);
  const selectedBarrierNames = useMemo(
    () => gateNamesFromIds(form.selectedGateIds, merchant.parkingGates),
    [form.selectedGateIds, merchant.parkingGates]
  );
  const allChecked = allBarrierIds.length > 0 && allBarrierIds.every((id) => form.selectedGateIds.includes(id));
  const someChecked = form.selectedGateIds.length > 0 && !allChecked;
  const allBarrierCheckboxRef = useRef(null);

  useEffect(() => {
    if (!allBarrierCheckboxRef.current) return;
    allBarrierCheckboxRef.current.indeterminate = someChecked;
  }, [someChecked]);

  function persistInvites(nextInvites) {
    setInvites(nextInvites);
    localStorage.setItem(STORAGE_KEYS.invites, JSON.stringify(nextInvites));
  }

  function updateMerchantUsageFromApi(result, fallbackIncrement = 1) {
    setMerchant((prev) => {
      const apiUsedCount = Number(result?.merchantUsedCount);
      const nextUsedCount = Number.isFinite(apiUsedCount)
        ? apiUsedCount
        : Number(prev.usedCount || 0) + Number(fallbackIncrement || 1);

      const nextAdditionalPasses = Number(
        result?.merchantAdditionalPasses ?? prev.additionalPasses ?? 0
      );

      const nextPlanType = String(result?.merchantPlanType || prev.planType || "subscription").toLowerCase() === "payg" ? "payg" : "subscription";
      const nextUnitPrice = Number(result?.merchantUnitPrice ?? prev.unitPrice ?? 0);
      const nextMonthlyQuota = nextPlanType === "payg" ? 0 : Number(
        result?.merchantMonthlyQuota ?? result?.merchantPlanLimit ?? prev.monthlyQuota ?? prev.planLimit ?? 0
      );

      const apiTodayIssuedCount = Number(result?.merchantTodayIssuedCount);
      const nextTodayIssuedCount = Number.isFinite(apiTodayIssuedCount)
        ? apiTodayIssuedCount
        : getServerTodayIssuedCount(prev) + Number(fallbackIncrement || 1);

      const fallbackUseCount = Math.max(Number(fallbackIncrement || 1), 1);
      const prevAvailablePasses = getAvailablePasses(prev);
      const isUnlimitedOrPayg = nextMonthlyQuota === -1 || nextPlanType === "payg";
      const calculatedAvailablePasses = !isUnlimitedOrPayg && Number.isFinite(nextMonthlyQuota)
        ? Math.max(
            Math.floor(nextMonthlyQuota) +
              (Number.isFinite(nextAdditionalPasses) ? Math.floor(nextAdditionalPasses) : 0) -
              (Number.isFinite(nextUsedCount) ? Math.floor(nextUsedCount) : 0),
            0
          )
        : prevAvailablePasses;
      const nextAvailablePasses = isUnlimitedOrPayg
        ? prevAvailablePasses
        : calculatedAvailablePasses;

      const nextMerchant = {
        ...prev,
        usedCount: nextUsedCount,
        planType: nextPlanType,
        unitPrice: Number.isFinite(nextUnitPrice) ? nextUnitPrice : 0,
        estimatedAmount: nextPlanType === "payg" ? nextUsedCount * (Number.isFinite(nextUnitPrice) ? nextUnitPrice : 0) : 0,
        additionalPasses: nextPlanType === "payg" ? 0 : nextAdditionalPasses,
        availablePasses: nextAvailablePasses,
        remainingPasses: nextAvailablePasses,
        monthlyQuota: nextMonthlyQuota,
        planLimit: nextMonthlyQuota,
        totalLimit: nextMonthlyQuota === -1 || nextPlanType === "payg" ? -1 : nextMonthlyQuota + nextAdditionalPasses,
        todayIssuedDate: result?.merchantTodayIssuedDate || getKstDateKey(),
        todayIssuedCount: nextTodayIssuedCount,
      };

      localStorage.setItem(STORAGE_KEYS.merchant, JSON.stringify(nextMerchant));
      return nextMerchant;
    });
  }

  function handleChange(field, value) {
    setForm((prev) => {
      if (field === "phone") {
        return { ...prev, phone: normalizePhone(value) };
      }

      if (field === "durationMinutes") {
        const next = { ...prev, durationMinutes: value };
        if (!prev.customValidityRange) {
          const nextStart = localDateTimeNowValue();
          next.ticketValidFrom = nextStart;
          next.ticketValidUntil = addMinutesToLocalDateTimeValue(nextStart, Number(value));
        }
        return next;
      }

      if (field === "usageLimit") {
        const numeric = Number(String(value).replace(/\D/g, "") || 1);
        return {
          ...prev,
          usageLimit: String(isPayAsYouGo ? Math.max(numeric, 1) : Math.min(Math.max(numeric, 1), Math.max(remainingPasses, 1))),
        };
      }

      if (field === "ticketValidFrom" || field === "ticketValidUntil") {
        return {
          ...prev,
          [field]: value,
          customValidityRange: true,
        };
      }

      return { ...prev, [field]: value };
    });
  }

  function applyDefaultValidityRange(durationMinutes) {
    const nextStart = localDateTimeNowValue();
    setForm((prev) => ({
      ...prev,
      ticketValidFrom: nextStart,
      ticketValidUntil: addMinutesToLocalDateTimeValue(nextStart, Number(durationMinutes || prev.durationMinutes)),
      customValidityRange: false,
    }));
  }

  function toggleBarrier(barrierId) {
    setForm((prev) => {
      const exists = prev.selectedGateIds.includes(barrierId);
      const nextIds = exists
        ? prev.selectedGateIds.filter((id) => id !== barrierId)
        : [...prev.selectedGateIds, barrierId];

      return {
        ...prev,
        selectedGateIds: nextIds.length > 0 ? nextIds : [barrierId],
      };
    });
  }

  function toggleAllBarriers() {
    setForm((prev) => ({
      ...prev,
      selectedGateIds:
        allBarrierIds.length > 0 && allBarrierIds.every((id) => prev.selectedGateIds.includes(id))
          ? [merchant.parkingGates[0]?.id || defaultMerchant.parkingGates[0].id]
          : allBarrierIds,
    }));
  }

  function persistFavorites(nextFavorites) {
    setFavorites(nextFavorites);
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(nextFavorites));
  }

  function saveCurrentAsFavorite() {
    const name = favoriteName.trim() || `즐겨찾기 ${favorites.length + 1}`;
    const selectedGateIds = normalizeGateIds(form.selectedGateIds);
    const nextFavorite = {
      id: safeUuid(),
      name,
      durationMinutes: form.durationMinutes,
      usageLimit: form.usageLimit,
      ticketValidFrom: form.ticketValidFrom,
      ticketValidUntil: form.ticketValidUntil,
      customValidityRange: form.customValidityRange,
      selectedGateIds,
      createdAt: nowIso(),
    };
    persistFavorites([nextFavorite, ...favorites].slice(0, 8));
    setFavoriteName("");
    setToast("현재 발행 조건을 즐겨찾기에 저장했습니다.");
  }

  function applyFavorite(favorite) {
    const validGateIds = normalizeGateIds(favorite.selectedGateIds).filter((id) =>
      merchant.parkingGates.some((gate) => gate.id === id)
    );
    setForm((prev) => ({
      ...prev,
      durationMinutes: String(favorite.durationMinutes || "60"),
      usageLimit: String(isPayAsYouGo ? Math.max(Number(favorite.usageLimit || 1), 1) : Math.min(Math.max(Number(favorite.usageLimit || 1), 1), Math.max(remainingPasses, 1))),
      ticketValidFrom: favorite.ticketValidFrom || prev.ticketValidFrom,
      ticketValidUntil: favorite.ticketValidUntil || prev.ticketValidUntil,
      customValidityRange: favorite.customValidityRange ?? true,
      selectedGateIds: validGateIds.length > 0 ? validGateIds : prev.selectedGateIds,
    }));
    setFavoriteModalOpen(false);
    setToast(`${favorite.name} 조건을 불러왔습니다.`);
  }

  function removeFavorite(favoriteId) {
    persistFavorites(favorites.filter((item) => item.id !== favoriteId));
    setToast("즐겨찾기를 삭제했습니다.");
  }

  function resetForm() {
    setForm(buildInitialForm(merchant.parkingGates?.[0]?.id || defaultMerchant.parkingGates[0].id));
    setError("");
    setApiStatus("");
  }

  function handleOpenConfirm(event) {
    event.preventDefault();
    setError("");

    if (!canIssueParkingPass) {
      setError(
        merchant.isActive === false
          ? "비활성화된 계정입니다. 운영자에게 문의해 주세요."
          : "운영자 승인 전에는 QR Code/주차권을 발행할 수 없습니다."
      );
      return;
    }

    if (!Array.isArray(form.selectedGateIds) || form.selectedGateIds.length === 0) {
      setError("대상 차단기를 1개 이상 선택해 주세요.");
      return;
    }

    if (merchant.isActive === false) {
      setError("비활성화된 계정입니다. 운영자에게 문의해 주세요.");
      return;
    }

    if (!isPayAsYouGo && remainingPasses <= 0) {
      setError("잔여 주차권이 없습니다. 운영자에게 충전 요청이 필요합니다.");
      return;
    }

    const usageLimit = Number(form.usageLimit || 1);
    if (usageLimit < 1 || (!isPayAsYouGo && usageLimit > remainingPasses)) {
      setError(isPayAsYouGo ? "사용 가능 횟수는 1회 이상으로 설정해 주세요." : `사용 가능 횟수는 1회 이상, 잔여 주차권 ${remainingPasses}회 이하로 설정해 주세요.`);
      return;
    }

    const validFrom = new Date(form.ticketValidFrom);
    const validUntil = new Date(form.ticketValidUntil);
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
      setError("주차권 사용 시작일시와 종료일시를 확인해 주세요.");
      return;
    }

    if (validUntil.getTime() <= validFrom.getTime()) {
      setError("주차권 사용 종료일시는 시작일시보다 늦어야 합니다.");
      return;
    }

    const nextStart = localDateTimeNowValue();
    const nextForm = {
      ...form,
      ticketValidFrom: nextStart,
      ticketValidUntil: addMinutesToLocalDateTimeValue(nextStart, Number(form.durationMinutes || 60)),
      customValidityRange: false,
    };
    const nextPendingPass = buildPendingPass({ form: nextForm, merchant, invites });
    setPendingPass(nextPendingPass);
    setConfirmModalOpen(true);
  }

  async function confirmIssuePass() {
    if (!pendingPass) return;

    setError("");

    const validFrom = new Date(pendingPass.ticketValidFrom);
    const validUntil = new Date(pendingPass.ticketValidUntil);
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
      setError("주차권 사용 시작일시와 종료일시를 확인해 주세요.");
      return;
    }

    if (validUntil.getTime() <= validFrom.getTime()) {
      setError("주차권 사용 종료일시는 시작일시보다 늦어야 합니다.");
      return;
    }

    setApiStatus("서버에 주차권 코드 발행 요청 중입니다...");

    try {
      const result = await requestParkingPass({
        phone: "",
        visitorName: "주차권 코드 방문자",
        parkingGateId: pendingPass.parkingGateIds[0],
        parkingGateIds: pendingPass.parkingGateIds,
        parkingGateNames: pendingPass.parkingGateNames,
        parkingGates: pendingPass.parkingGates,
        validMinutes: pendingPass.durationMinutes,
        memo: pendingPass.memo,
        usageLimit: pendingPass.usageLimit,
        ticketValidFrom: validFrom.toISOString(),
        ticketValidUntil: validUntil.toISOString(),
        issueMethod: "manual",
        deliveryMethod: "manual",
        merchantShopName: merchant.shopName,
        merchantOwnerName: merchant.ownerName,
        merchantPhone: merchant.phone,
      });

      const inviteId = result.inviteId || result.requestId || pendingPass.id;
      const inviteCode = result.inviteCode || result.code || inviteId;
      const inviteUrl = deepLinkFor("", inviteId, inviteCode);

      const { history, visitCount, ...newPass } = pendingPass;
      const savedInvite = sanitizeInvite({
        ...newPass,
        ticketValidFrom: validFrom.toISOString(),
        ticketValidUntil: validUntil.toISOString(),
        id: inviteId,
        inviteId,
        inviteCode,
        status: "발행 완료",
        phone: "주차권 코드 직접 전달",
        visitorName: "주차권 코드 방문자",
        issueMethod: "manual",
        serverSynced: true,
        serverInviteUrl: inviteUrl,
      });

      updateMerchantUsageFromApi(result, Number(savedInvite.usageLimit || 1));
      persistInvites([savedInvite, ...invites]);
      setIssuedInvite({
        ...savedInvite,
        inviteUrl,
      });
      setInviteResultModalOpen(true);
      setConfirmModalOpen(false);
      setPendingPass(null);
      setApiStatus("");
      setToast("주차권 코드가 발행되었습니다.");
      resetForm();
    } catch (err) {
      setApiStatus("");
      setError(err?.message || "주차권 코드 발행 중 오류가 발생했습니다.");
    }
  }

  async function copyLink(invite) {
    const code = invite.inviteCode || invite.inviteId || invite.id || "";

    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(invite.id);
      setToast("주차권 코드를 복사했습니다.");
      setTimeout(() => setCopiedId(""), 1500);
    } catch {
      setError("주차권 코드 복사에 실패했습니다.");
    }
  }

  async function copyIssuedInviteCode() {
    if (!issuedInvite?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(issuedInvite.inviteCode);
      setToast("주차권 코드를 복사했습니다.");
    } catch {
      setError("주차권 코드 복사에 실패했습니다.");
    }
  }

  async function copyIssuedInviteLink() {
    const value = issuedInvite?.inviteCode ? deepLinkFor("", issuedInvite.inviteId || issuedInvite.id, issuedInvite.inviteCode) : "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setToast("주차권 링크를 복사했습니다.");
    } catch {
      setError("주차권 링크 복사에 실패했습니다.");
    }
  }

  async function issueAnotherInviteFromLast() {
    if (!issuedInvite) return;

    setError("");
    setApiStatus("서버에 새 주차권 코드 발행 요청 중입니다...");

    try {
      const parkingGateIds = normalizeGateIds(issuedInvite.parkingGateIds);
      const parkingGateNames =
        Array.isArray(issuedInvite.parkingGateNames) && issuedInvite.parkingGateNames.length > 0
          ? issuedInvite.parkingGateNames
          : gateNamesFromIds(parkingGateIds, merchant.parkingGates);

      const nextStart = localDateTimeNowValue();
      const nextEnd = addMinutesToLocalDateTimeValue(nextStart, Number(issuedInvite.durationMinutes || 60));

      const result = await requestParkingPass({
        phone: "",
        visitorName: "주차권 코드 방문자",
        parkingGateId: parkingGateIds[0],
        parkingGateIds,
        parkingGateNames,
        validMinutes: Number(issuedInvite.durationMinutes || 60),
        memo: issuedInvite.memo || "",
        usageLimit: Number(issuedInvite.usageLimit || 1),
        ticketValidFrom: new Date(nextStart).toISOString(),
        ticketValidUntil: new Date(nextEnd).toISOString(),
        issueMethod: "manual",
        deliveryMethod: "manual",
        merchantShopName: merchant.shopName,
        merchantOwnerName: merchant.ownerName,
        merchantPhone: merchant.phone,
      });

      const inviteId = result.inviteId || result.requestId || safeUuid();
      const inviteCode = result.inviteCode || result.code || inviteId;
      const inviteUrl = deepLinkFor("", inviteId, inviteCode);

      const newInvite = sanitizeInvite({
        ...issuedInvite,
        id: inviteId,
        inviteId,
        inviteCode,
        status: "발행 완료",
        phone: "주차권 코드 직접 전달",
        visitorName: "주차권 코드 방문자",
        issueMethod: "manual",
        ticketValidFrom: new Date(nextStart).toISOString(),
        ticketValidUntil: new Date(nextEnd).toISOString(),
        createdAt: nowIso(),
        serverSynced: true,
        serverInviteUrl: inviteUrl,
        usedAt: "",
      });

      updateMerchantUsageFromApi(result, Number(newInvite.usageLimit || 1));
      persistInvites([newInvite, ...invites]);
      setIssuedInvite({
        ...newInvite,
        inviteUrl,
      });
      setApiStatus("");
      setToast("새 주차권 코드가 발행되었습니다.");
    } catch (err) {
      setApiStatus("");
      setError(err?.message || "새 주차권 코드 발행 중 오류가 발생했습니다.");
    }
  }


  async function copyDepositAccount() {
    try {
      await navigator.clipboard.writeText(DEPOSIT_BANK_TEXT);
      setToast("계좌번호를 복사했습니다.");
    } catch {
      setError("계좌번호 복사에 실패했습니다.");
    }
  }

  async function handleSubmitPurchaseRequest(purchaseType) {
    const option = getPurchaseOption(purchaseType);
    const quantity = normalizePurchaseQuantity(purchaseType, purchaseInputs[purchaseType]);

    if (quantity <= 0) {
      setError(`${option.label} 수량을 1 이상 입력해 주세요.`);
      return;
    }

    setError("");
    setPurchaseBusy(true);
    try {
      const result = await submitPurchaseRequest({ purchaseType, quantity });
      const nextRequest = result.request || result.item || {
        requestId: safeUuid(),
        purchaseType,
        label: option.label,
        unit: option.unit,
        unitPrice: option.price,
        quantity,
        totalAmount: Math.floor(quantity / option.unit) * option.price,
        status: "PENDING",
        createdAt: nowIso(),
      };

      setMerchant((prev) => {
        const nextMerchant = {
          ...prev,
          purchaseRequests: [nextRequest, ...(Array.isArray(prev.purchaseRequests) ? prev.purchaseRequests : [])],
        };
        localStorage.setItem(STORAGE_KEYS.merchant, JSON.stringify(nextMerchant));
        return nextMerchant;
      });
      setPurchaseInputs((prev) => ({ ...prev, [purchaseType]: "" }));
      setPurchaseModalOpen(true);
      setToast("결제 요청이 등록되었습니다. 관리자 승인 후 사용할 수 있습니다.");
    } catch (err) {
      setError(err?.message || "결제 요청 중 오류가 발생했습니다.");
    } finally {
      setPurchaseBusy(false);
    }
  }

  async function handleSubmitSelectedPurchaseRequest() {
    const selectedOptions = PURCHASE_OPTIONS
      .map((option) => ({
        option,
        quantity: normalizePurchaseQuantity(option.key, purchaseInputs[option.key]),
        totalAmount: purchaseTotalAmount(option.key, purchaseInputs[option.key]),
      }))
      .filter((item) => item.quantity > 0);

    if (selectedOptions.length === 0) {
      setError("결제할 구매 수량을 1개 이상 입력해 주세요.");
      return;
    }

    setError("");
    setPurchaseBusy(true);

    try {
      const createdRequests = [];

      for (const item of selectedOptions) {
        const result = await submitPurchaseRequest({
          purchaseType: item.option.key,
          quantity: item.quantity,
        });

        createdRequests.push(
          result.request || result.item || {
            requestId: safeUuid(),
            purchaseType: item.option.key,
            label: item.option.label,
            unit: item.option.unit,
            unitPrice: item.option.price,
            quantity: item.quantity,
            totalAmount: item.totalAmount,
            status: "PENDING",
            createdAt: nowIso(),
          }
        );
      }

      setMerchant((prev) => {
        const nextMerchant = {
          ...prev,
          purchaseRequests: [
            ...createdRequests,
            ...(Array.isArray(prev.purchaseRequests) ? prev.purchaseRequests : []),
          ],
        };
        localStorage.setItem(STORAGE_KEYS.merchant, JSON.stringify(nextMerchant));
        return nextMerchant;
      });

      setPurchaseInputs({ single: "", bundle50: "", bundle200: "" });
      setPurchaseModalOpen(true);
      setToast("결제 요청이 등록되었습니다. 관리자 승인 후 사용할 수 있습니다.");
    } catch (err) {
      setError(err?.message || "결제 요청 중 오류가 발생했습니다.");
    } finally {
      setPurchaseBusy(false);
    }
  }

  function handleIssueQrPass() {
    setError("");
    setQrModalNotice("");

    if (!canIssueParkingPass) {
      const message =
        merchant.isActive === false
          ? "비활성화된 계정입니다. 운영자에게 문의해 주세요."
          : "운영자 승인 전에는 QR Code/주차권을 발행할 수 없습니다.";
      setQrModalNotice(message);
      setQrModalOpen(true);
      return;
    }

    if (!Array.isArray(form.selectedGateIds) || form.selectedGateIds.length === 0) {
      setQrModalNotice("대상 차단기를 1개 이상 선택해 주세요.");
      setQrModalOpen(true);
      return;
    }

    if (merchant.isActive === false) {
      setQrModalNotice("비활성화된 계정입니다. 운영자에게 문의해 주세요.");
      setQrModalOpen(true);
      return;
    }

    if (!isPayAsYouGo && remainingPasses <= 0) {
      setQrTicket(null);
      setPendingQrPass(null);
      setQrTicketUsed(false);
      setQrModalNotice("잔여 주차권이 없습니다. 운영자에게 충전 요청이 필요합니다.");
      setQrModalOpen(true);
      return;
    }

    const usageLimit = Number(form.usageLimit || 1);
    if (usageLimit < 1 || (!isPayAsYouGo && usageLimit > remainingPasses)) {
      setQrModalNotice(
        isPayAsYouGo
          ? "사용 가능 횟수는 1회 이상으로 설정해 주세요."
          : `사용 가능 횟수는 1회 이상, 잔여 주차권 ${remainingPasses}회 이하로 설정해 주세요.`
      );
      setQrModalOpen(true);
      return;
    }

    const nextStart = localDateTimeNowValue();
    const nextForm = {
      ...form,
      visitorName: form.visitorName.trim() || "QR 방문자",
      ticketValidFrom: nextStart,
      ticketValidUntil: addMinutesToLocalDateTimeValue(nextStart, Number(form.durationMinutes || 60)),
      customValidityRange: false,
    };

    const nextPendingQrPass = {
      ...buildPendingPass({ form: nextForm, merchant, invites }),
      visitorName: form.visitorName.trim() || "QR 방문자",
      phone: "QR 스캔 발급",
      issueMethod: "qr",
    };

    setPendingQrPass(nextPendingQrPass);
    setQrTicket(null);
    setQrTicketUsed(false);
    setQrModalOpen(true);
    confirmIssueQrPass(nextPendingQrPass);
  }

  async function confirmIssueQrPass(passOverride = null) {
    const qrPass = passOverride || pendingQrPass || qrTicket;
    if (!qrPass) return;

    const validFrom = new Date(qrPass.ticketValidFrom);
    const validUntil = new Date(qrPass.ticketValidUntil);
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
      setError("주차권 사용 시작일시와 종료일시를 확인해 주세요.");
      return;
    }

    if (validUntil.getTime() <= validFrom.getTime()) {
      setError("주차권 사용 종료일시는 시작일시보다 늦어야 합니다.");
      return;
    }

    const selectedGateIds = normalizeGateIds(qrPass.parkingGateIds);
    const selectedGateNames =
      Array.isArray(qrPass.parkingGateNames) && qrPass.parkingGateNames.length > 0
        ? qrPass.parkingGateNames
        : gateNamesFromIds(selectedGateIds, merchant.parkingGates);
    const selectedParkingGates =
      Array.isArray(qrPass.parkingGates) && qrPass.parkingGates.length > 0
        ? qrPass.parkingGates
        : parkingGatesFromIds(selectedGateIds, merchant.parkingGates);

    setQrBusy(true);
    setApiStatus("서버에 QR 주차권 등록 요청 중입니다...");

    try {
      const result = await requestQrParkingPass({
        visitorName: qrPass.visitorName || "QR 방문자",
        parkingGateIds: selectedGateIds,
        parkingGateNames: selectedGateNames,
        parkingGates: selectedParkingGates,
        validMinutes: Number(qrPass.durationMinutes),
        memo: qrPass.memo || "",
        usageLimit: Number(qrPass.usageLimit || 1),
        ticketValidFrom: validFrom.toISOString(),
        ticketValidUntil: validUntil.toISOString(),
        merchant,
      });

      const inviteId = result.inviteId || result.requestId || result.id || safeUuid();
      const inviteCode = result.inviteCode || result.code || inviteId;
      const inviteUrl = deepLinkFor("", inviteId, inviteCode);

      const { history, visitCount, ...newQrPass } = qrPass;
      const newQrInvite = sanitizeInvite({
        ...newQrPass,
        id: inviteId,
        inviteId,
        inviteCode,
        visitorName: qrPass.visitorName || "QR 방문자",
        phone: "QR 스캔 발급",
        shopName: merchant.shopName,
        parkingGateIds: selectedGateIds,
        parkingGateNames: selectedGateNames,
        parkingGates: selectedParkingGates,
        durationMinutes: Number(qrPass.durationMinutes),
        expiresAt: futureIso(Number(qrPass.durationMinutes)),
        ticketValidFrom: validFrom.toISOString(),
        ticketValidUntil: validUntil.toISOString(),
        usageLimit: Number(qrPass.usageLimit || 1),
        status: "발행 완료",
        issueMethod: "qr",
        createdAt: nowIso(),
        serverSynced: true,
        serverInviteUrl: inviteUrl,
      });

      updateMerchantUsageFromApi(result, Number(newQrInvite.usageLimit || 1));
      persistInvites([newQrInvite, ...invites]);
      setQrTicket({
        ...newQrInvite,
        inviteUrl,
      });
      setQrTicketUsed(false);
      setQrModalOpen(true);
      setQrConfirmModalOpen(false);
      setPendingQrPass(null);
      setQrModalNotice("");
      setToast("QR 주차권이 서버에 등록되었습니다.");
      setApiStatus("");
      resetForm();
    } catch (err) {
      setApiStatus("");
      setError(err?.message || "QR 주차권 등록 중 오류가 발생했습니다.");
    } finally {
      setQrBusy(false);
    }
  }

  function markAppReceived(inviteId) {
    const next = invites.map((item) =>
      item.id === inviteId ? { ...item, status: "앱 수신" } : item
    );
    persistInvites(next);
    setToast("방문자 앱 수신 상태로 변경했습니다.");
  }

  function resendInvite(inviteId) {
    const next = invites.map((item) =>
      item.id === inviteId ? { ...item, status: "재발송" } : item
    );
    persistInvites(next);
    setToast("재발송 처리했습니다.");
  }

  function expireInvite(inviteId) {
    const next = invites.map((item) =>
      item.id === inviteId ? { ...item, status: "만료" } : item
    );
    persistInvites(next);
    setToast("주차권을 만료 처리했습니다.");
  }

  function resetDemoData() {
    localStorage.setItem(STORAGE_KEYS.merchant, JSON.stringify(defaultMerchant));
    localStorage.setItem(STORAGE_KEYS.invites, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([]));

    setMerchant(defaultMerchant);
    setInvites([]);
    setFavorites([]);

    setPendingPass(null);
    setConfirmModalOpen(false);

    setQrTicket(null);
    setQrTicketUsed(false);
    setQrModalOpen(false);
    setPendingQrPass(null);
    setQrConfirmModalOpen(false);

    setFavoriteModalOpen(false);
    setIssuedInvite(null);

    resetForm();
    setShowHistoryPanel(false);
    setShowUsageHistoryPanel(false);

    setToast("로컬 발행 내역을 초기화했습니다.");
  }

  const availablePassesValue = getAvailablePasses(merchant);
  const availablePassesDisplay = isUnlimitedPlan ? "무제한" : `${availablePassesValue}장`;
  const pendingPurchaseRequests = useMemo(() => {
    return Array.isArray(merchant.purchaseRequests)
      ? merchant.purchaseRequests.filter((item) => String(item?.status || "PENDING").toUpperCase() === "PENDING")
      : [];
  }, [merchant.purchaseRequests]);

  const stats = [
    { label: "사용 가능 주차권", value: availablePassesDisplay },
    { label: "오늘 발행", value: `${todayIssued}건` },
    { label: "승인 대기 구매", value: `${pendingPurchaseRequests.length}건` },
  ];

  const purchaseSummaryRows = useMemo(() => {
    return PURCHASE_OPTIONS.map((option) => {
      const quantity = normalizePurchaseQuantity(option.key, purchaseInputs[option.key]);
      const setCount = purchaseSetCount(option.key, purchaseInputs[option.key]);
      const totalAmount = purchaseTotalAmount(option.key, purchaseInputs[option.key]);

      return {
        ...option,
        quantity,
        setCount,
        totalAmount,
      };
    });
  }, [purchaseInputs]);

  const purchaseGrandTotal = useMemo(() => {
    return purchaseSummaryRows.reduce((sum, item) => sum + item.totalAmount, 0);
  }, [purchaseSummaryRows]);


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm text-slate-500">방문자 주차권 시스템</p>
            <h1 className="text-xl font-bold sm:text-2xl">{merchant.shopName}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="whitespace-nowrap rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              고객센터 : <span className="font-black text-slate-950">1533 3302</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium leading-tight text-white shadow-sm hover:opacity-90"
            >
              로그<br />아웃
            </button>
          </div>
        </div>
      </header>

      {toast ? (
        <div className="fixed right-4 top-20 z-30 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      ) : null}

      <Modal
        open={confirmModalOpen}
        title="주차권 코드 발행 확인"
        onClose={() => {
          setConfirmModalOpen(false);
          setPendingPass(null);
        }}
      >
        {pendingPass ? (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <p className="sm:col-span-2">
                <span className="font-medium text-slate-700">대상 차단기:</span> {pendingPass.parkingGateNames.join(", ")}
              </p>
              <p>
                <span className="font-medium text-slate-700">유효시간:</span> {displayDuration(pendingPass.durationMinutes)}
              </p>
              <label className="sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">주차권 사용 시작</span>
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(pendingPass.ticketValidFrom)}
                  onChange={(e) => setPendingPass((prev) => (prev ? { ...prev, ticketValidFrom: e.target.value } : prev))}
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">주차권 사용 종료</span>
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(pendingPass.ticketValidUntil)}
                  onChange={(e) => setPendingPass((prev) => (prev ? { ...prev, ticketValidUntil: e.target.value } : prev))}
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setConfirmModalOpen(false);
                  setPendingPass(null);
                }}
                className="rounded-lg border px-2.5 py-1.5 text-[12px] font-medium hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmIssuePass}
                className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-sm hover:opacity-90"
              >
                확인 후 주차권 코드 발행
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={inviteResultModalOpen}
        title="주차권 코드 발행 완료"
        onClose={() => setInviteResultModalOpen(false)}
      >
        {issuedInvite ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-800">주차권 코드가 발행되었습니다.</p>
              <p className="mt-2 text-xs leading-relaxed text-emerald-800">
                주차권 링크를 복사하여 사용자에게 문자 또는 메신저로 전달해 주세요.
              </p>
            </div>

            <button
              type="button"
              onClick={copyIssuedInviteLink}
              className="w-full rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              주차권 링크 복사
            </button>

            <button
              type="button"
              onClick={issueAnotherInviteFromLast}
              disabled={Boolean(apiStatus)}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {apiStatus ? "새 주차권 코드 발행 중..." : "같은 조건으로 새 주차권 코드 발행"}
            </button>

            <button
              type="button"
              onClick={() => setInviteResultModalOpen(false)}
              className="w-full rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-slate-50"
            >
              닫기
            </button>
          </div>
        ) : null}
      </Modal>


      <Modal
        open={false && qrConfirmModalOpen}
        title="QR 주차권 발행 확인"
        onClose={() => {
          setQrConfirmModalOpen(false);
          setPendingQrPass(null);
        }}
      >
        {pendingQrPass ? (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <p>
                <span className="font-medium text-slate-700">방문자명:</span> {pendingQrPass.visitorName}
              </p>
              <p>
                <span className="font-medium text-slate-700">유효시간:</span> {displayDuration(pendingQrPass.durationMinutes)}
              </p>
              <p className="sm:col-span-2">
                <span className="font-medium text-slate-700">대상 차단기:</span> {pendingQrPass.parkingGateNames.join(", ")}
              </p>
              <label className="sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">주차권 사용 시작</span>
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(pendingQrPass.ticketValidFrom)}
                  onChange={(e) => setPendingQrPass((prev) => (prev ? { ...prev, ticketValidFrom: e.target.value } : prev))}
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">주차권 사용 종료</span>
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(pendingQrPass.ticketValidUntil)}
                  onChange={(e) => setPendingQrPass((prev) => (prev ? { ...prev, ticketValidUntil: e.target.value } : prev))}
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setQrConfirmModalOpen(false);
                  setPendingQrPass(null);
                }}
                className="rounded-lg border px-2.5 py-1.5 text-[12px] font-medium hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => confirmIssueQrPass()}
                disabled={qrBusy}
                className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {qrBusy ? "QR 서버 등록 중..." : "확인 후 QR Code 발행"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={qrModalOpen}
        title="QR 주차권 코드 발행"
        onClose={() => {
          setQrModalOpen(false);
          setQrModalNotice("");
        }}
      >
        <div className="space-y-3">
          {qrModalNotice ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {qrModalNotice}
            </div>
          ) : null}

          {pendingQrPass && !qrTicket ? (
            <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">
              QR Code를 서버에 등록하는 중입니다...
            </div>
          ) : null}

          {qrTicket ? (
            <>
              <div className="rounded-2xl bg-slate-50 p-3 text-sm">
                <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  <p><span className="font-medium text-slate-700">방문자명:</span> {qrTicket.visitorName}</p>
                  <p><span className="font-medium text-slate-700">상태:</span> 서버 등록 완료</p>
                  <p><span className="font-medium text-slate-700">대상 차단기:</span> {qrTicket.parkingGateNames.join(", ")}</p>
                  <p><span className="font-medium text-slate-700">유효시간:</span> {displayDuration(qrTicket.durationMinutes)}</p>
                </div>

                <div className="mt-3 grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-600">사용 시작</span>
                    <input
                      type="datetime-local"
                      value={toDateTimeLocalValue(qrTicket.ticketValidFrom)}
                      onChange={(e) => setQrTicket((prev) => (prev ? { ...prev, ticketValidFrom: e.target.value } : prev))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  </label>

                  <label>
                    <span className="mb-1 block text-xs font-medium text-slate-600">사용 종료</span>
                    <input
                      type="datetime-local"
                      value={toDateTimeLocalValue(qrTicket.ticketValidUntil)}
                      onChange={(e) => setQrTicket((prev) => (prev ? { ...prev, ticketValidUntil: e.target.value } : prev))}
                      className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => confirmIssueQrPass(qrTicket)}
                    disabled={qrBusy || qrTicketUsed}
                    className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {qrBusy ? "QR 재발행 중..." : "유효기간 적용"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border p-3">
                <div className="flex flex-col items-center gap-2">
                  {qrTicketUsed ? (
                    <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-base font-bold text-slate-500">
                      새로 발급해 주세요
                    </div>
                  ) : (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrTicket.inviteUrl)}`}
                      alt="QR Code"
                      className="h-56 w-56 rounded-2xl border bg-white p-2"
                    />
                  )}
                  <p className="text-center text-xs leading-relaxed text-slate-500">
                    방문자 폰으로 스캔하면 서버에 등록된 실제 주차권 코드로 열립니다. 사용 처리 후에는 같은 팝업에서 새 QR을 발행할 수 있습니다.
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {!pendingQrPass && !qrTicket && !qrModalNotice ? (
            <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-slate-500">
              QR Code 발행 정보를 불러올 수 없습니다.
            </div>
          ) : null}

          <div className="flex flex-row flex-wrap justify-end gap-2">
            {qrTicket ? (
              <button
                type="button"
                onClick={() => {
                  const usedAt = nowIso();
                  setQrTicketUsed(true);
                  setQrTicket((prev) => (prev ? { ...prev, status: "사용 완료", usedAt } : prev));
                  persistInvites(invites.map((item) => item.id === qrTicket.id ? { ...item, status: "사용 완료", usedAt } : item));
                  setToast("QR 사용 처리되었습니다. 새로 발급해 주세요.");
                }}
                disabled={qrTicketUsed}
                className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                사용 처리
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleIssueQrPass}
              disabled={qrBusy || !canIssueParkingPass}
              className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {qrBusy ? "발행 중..." : canIssueParkingPass ? "새 QR 발행" : "승인 후 발행 가능"}
            </button>
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            >
              닫기
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={favoriteModalOpen}
        title="즐겨찾기 발행 조건"
        onClose={() => setFavoriteModalOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
            <p className="text-sm font-semibold text-amber-950">현재 입력된 조건 저장</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              유효시간, 시작/종료 시간, 대상 차단기를 저장합니다.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={favoriteName}
                onChange={(e) => setFavoriteName(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                placeholder="예: 1시간 1회 QR"
              />
              <button
                type="button"
                onClick={saveCurrentAsFavorite}
                className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                현재 조건 저장
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">저장된 즐겨찾기</p>
                <p className="text-xs text-slate-500">불러오기를 누르면 발행 화면에 조건이 바로 적용됩니다.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {favorites.length}개
              </span>
            </div>

            {favorites.length > 0 ? (
              <div className="mt-3 space-y-2">
                {favorites.map((favorite) => (
                  <div key={favorite.id} className="rounded-2xl border p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{favorite.name}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          유효시간 {displayDuration(favorite.durationMinutes)}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          사용기간 {displayDate(favorite.ticketValidFrom)} ~ {displayDate(favorite.ticketValidUntil)}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          차단기 {gateNamesFromIds(favorite.selectedGateIds, merchant.parkingGates).join(", ") || "기본 차단기"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => applyFavorite(favorite)}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
                          불러오기
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFavorite(favorite.id)}
                          className="rounded-xl border px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-slate-500">
                저장된 즐겨찾기가 없습니다. 현재 조건을 입력한 뒤 저장해 주세요.
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={purchaseModalOpen} title="무통장 입금" onClose={() => setPurchaseModalOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <p className="text-lg font-bold text-slate-900">무통장 입금</p>
            <p className="mt-3 text-base font-semibold text-slate-800">신한은행 : xxx-xx-xxxxxx</p>
            <p className="mt-1 text-sm text-slate-600">예금주 : 파킹크루즈</p>
          </div>
          <button
            type="button"
            onClick={copyDepositAccount}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            계좌번호 복사
          </button>
          <p className="text-xs leading-relaxed text-slate-500">입금 후 관리자가 결제 요청을 승인하면 해당 수량이 사용 가능 주차권에 반영됩니다.</p>
        </div>
      </Modal>

      <main className="mx-auto grid max-w-7xl gap-3 px-3 py-3 sm:px-4 lg:grid-cols-12 lg:px-6">
        <section className="space-y-3 lg:col-span-8">
          <form onSubmit={handleOpenConfirm} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold sm:text-xl">방문자 주차권 코드 발행</h2>
                <p className="mt-1 text-sm text-slate-500">
                  유효시간은 방문자가 실제로 주차권을 사용한 시점부터 적용됩니다.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  사용 가능 {availablePassesDisplay}
                </span>
              </div>
            </div>

            {!canIssueParkingPass ? (
              <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">운영자 승인 대기 중입니다.</p>
                <p className="mt-1">로그인은 가능하지만, 승인 전에는 QR Code/주차권 발행이 제한됩니다.</p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 col-span-2">
                <div className="flex items-center gap-1.5">
                  <label className="w-12 shrink-0 text-[11px] font-medium text-slate-700">유효</label>
                  <select
                    value={form.durationMinutes}
                    onChange={(e) => handleChange("durationMinutes", e.target.value)}
                    className="min-w-0 flex-1 rounded-md border bg-white px-1.5 py-1 text-[12px] outline-none focus:border-slate-400"
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="col-span-2 text-[10px] leading-tight text-slate-500">
                시작/종료일시는 발행 버튼을 누른 뒤 팝업에서 현재 시각 기준으로 표시되며, 필요 시 수정할 수 있습니다.
              </p>
            </div>

            <div className="mt-1.5 rounded-lg border p-1.5">
              <button
                type="button"
                onClick={() => setBarrierSectionOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-slate-800">대상 차단기</span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {form.selectedGateIds.length}/{allBarrierIds.length}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-slate-600">
                    {selectedBarrierNames.length > 0 ? selectedBarrierNames.join(", ") : "차단기를 선택해 주세요"}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-slate-600">
                  {barrierSectionOpen ? "접기" : "펼치기"}
                </span>
              </button>

              {barrierSectionOpen ? (
                <div className="mt-1.5 grid gap-1">
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                      allChecked || someChecked ? "border-slate-900 bg-slate-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      ref={allBarrierCheckboxRef}
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAllBarriers}
                      className="h-3 w-3 shrink-0"
                    />
                    <span className="min-w-0 flex-1 text-[12px] font-medium">모든 차단기</span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {form.selectedGateIds.length}/{allBarrierIds.length}
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                    {merchant.parkingGates.map((barrier) => {
                      const checked = form.selectedGateIds.includes(barrier.id);
                      return (
                        <label
                          key={barrier.id}
                          className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-center transition ${
                            checked ? "border-slate-900 bg-slate-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBarrier(barrier.id)}
                            className="h-3 w-3 shrink-0"
                          />
                          <span className="text-[11px] font-medium leading-none">{barrier.name}{barrier.macAddress ? ` (${barrier.macAddress})` : ""}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>


            {error ? (
              <div className="mt-2 rounded-xl bg-rose-50 px-2.5 py-2 text-[12px] font-medium text-rose-700">{error}</div>
            ) : null}

            {apiStatus ? (
              <div className="mt-2 rounded-xl bg-slate-100 px-2.5 py-2 text-[12px] font-medium text-slate-700">{apiStatus}</div>
            ) : null}

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="submit"
                disabled={!canIssueParkingPass}
                className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-[15px] font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:py-3.5"
              >
                {canIssueParkingPass ? "주차권 코드 발행" : "승인 후 발행 가능"}
              </button>
              <button
                type="button"
                onClick={handleIssueQrPass}
                disabled={qrBusy || !canIssueParkingPass}
                className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3.5"
              >
                {qrBusy ? "QR 서버 등록 중..." : canIssueParkingPass ? "QR Code 발행" : "승인 후 발행 가능"}
              </button>
            </div>
          </form>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {stats.map((item) => (
              <div key={item.label} className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                <p className="text-[11px] text-slate-500">{item.label}</p>
                <p className="mt-1 text-xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
            <div>
              <h2 className="text-base font-semibold sm:text-lg">정액제 주차권 구매</h2>
              <p className="mt-1 text-xs text-slate-500">결제한 수량은 관리자가 승인한 후 사용 가능 주차권에 반영됩니다.</p>
            </div>

            <div className="mt-3 grid gap-2">
              {PURCHASE_OPTIONS.map((option) => {
                const quantity = normalizePurchaseQuantity(option.key, purchaseInputs[option.key]);
                const setCount = purchaseSetCount(option.key, purchaseInputs[option.key]);
                const totalAmount = purchaseTotalAmount(option.key, purchaseInputs[option.key]);

                return (
                  <div key={option.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_140px_1fr] sm:items-center">
                      <div>
                        <div className="font-semibold text-slate-900">{option.label}</div>
                        <div className="mt-1 text-xs text-slate-500">{option.helper}</div>
                      </div>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={purchaseInputs[option.key]}
                        onChange={(e) => setPurchaseInputs((prev) => ({ ...prev, [option.key]: e.target.value }))}
                        placeholder={option.inputLabel === "세트" ? "세트 수" : "수량"}
                        className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                      />
                      <div className="text-sm text-slate-700">
                        <div>단가: <span className="font-semibold">{formatCurrency(option.price)}</span> / {option.unit}장</div>
                        <div>결제 수량: <span className="font-semibold">{setCount}{option.inputLabel}</span> = {quantity}장</div>
                        <div>총 비용: <span className="font-bold text-slate-950">{formatCurrency(totalAmount)}</span></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-sm font-bold text-slate-900">결제 금액 합계</div>
              <div className="space-y-1 text-sm text-slate-700">
                {purchaseSummaryRows.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <span>
                      {item.label}
                      {item.quantity > 0 ? (
                        <span className="ml-1 text-xs text-slate-500">
                          ({item.setCount}{item.inputLabel} / {item.quantity}장)
                        </span>
                      ) : null}
                    </span>
                    <span className="font-semibold text-slate-900">{formatCurrency(item.totalAmount)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-sm font-bold text-slate-900">총 결제 금액</span>
                <span className="text-lg font-black text-slate-950">{formatCurrency(purchaseGrandTotal)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitSelectedPurchaseRequest}
              disabled={purchaseBusy}
              className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {purchaseBusy ? "결제 요청 중..." : "결제"}
            </button>
          </div>

          {showHistoryPanel ? (
            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold sm:text-xl">최근 발행 내역</h2>
                  <p className="text-sm text-slate-500">상태 변경과 링크 복사까지 바로 테스트할 수 있습니다.</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-2xl border px-4 py-2 text-sm outline-none">
                    <option value="all">전체 상태</option>
                    <option value="발행 완료">발행 완료</option>
                    <option value="앱 수신">앱 수신</option>
                    <option value="재발송">재발송</option>
                    <option value="만료">만료</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowHistoryPanel(false)}
                    className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    내역 숨기기
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {filteredInvites.length === 0 ? (
                  <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-slate-500">
                    표시할 발행 내역이 없습니다.
                  </div>
                ) : (
                  filteredInvites.map((row) => (
                    <div key={row.id} className="rounded-2xl border p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold">{row.visitorName || "이름 미입력"}</p>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(row.status)}`}>
                              {row.status}
                            </span>
                          </div>

                          <div className="grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                            <p>상가: {row.shopName}</p>
                            <p>대상 차단기: {row.parkingGateNames.join(", ")}</p>
                            <p>유효시간: {displayDuration(row.durationMinutes)}</p>
                            <p>생성 시각: {displayDate(row.createdAt)}</p>
                            <p className="sm:col-span-2">주차권 사용기간: {displayDate(row.ticketValidFrom)} ~ {displayDate(row.ticketValidUntil)}</p>
                            <p className="sm:col-span-2">메모: {row.memo || "-"}</p>
                            <p className="break-all sm:col-span-2">
                              주차권 링크: {deepLinkFor("", row.inviteId || row.id, row.inviteCode)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[360px]">
                          <button
                            type="button"
                            onClick={() => copyLink(row)}
                            className="rounded-2xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            {copiedId === row.id ? "복사됨" : "주차권 코드 복사"}
                          </button>
                          <button
                            type="button"
                            onClick={() => markAppReceived(row.id)}
                            className="rounded-2xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            앱 수신
                          </button>
                          <button
                            type="button"
                            onClick={() => resendInvite(row.id)}
                            className="rounded-2xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            재발송
                          </button>
                          <button
                            type="button"
                            onClick={() => expireInvite(row.id)}
                            className="rounded-2xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            만료 처리
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
            <h2 className="text-lg font-semibold">상가 정보</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">상가명</span>
                <span className="font-medium">{merchant.shopName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">아이디</span>
                <span className="font-medium">{merchant.loginId || merchant.email || merchant.ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">호실</span>
                <span className="font-medium">{merchant.roomNo || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">상태</span>
                <span className={`font-medium ${merchant.isActive === false ? "text-rose-600" : "text-emerald-700"}`}>
                  {merchant.isActive === false ? "비활성" : "활성"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">사용 가능 주차권</span>
                <span className="font-medium">{availablePassesDisplay}</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
