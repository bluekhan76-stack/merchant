import React, { useEffect, useMemo, useRef, useState } from "react";
import OpenBridgePage from "./OpenBridgePage.jsx";

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
};

const BARRIER_OPTIONS = [
  { id: "gate-1", name: "차단기 1" },
  { id: "gate-2", name: "차단기 2" },
  { id: "gate-3", name: "차단기 3" },
  { id: "gate-4", name: "차단기 4" },
];


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
  const response = await fetch(`${API_BASE_URL}${API_PATHS.requestPass}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: normalizedPhone,
      visitorName: visitorName || "",
      parkingGateId,
      parkingGateIds: Array.isArray(parkingGateIds) ? parkingGateIds : undefined,
      parkingGateNames: Array.isArray(parkingGateNames) ? parkingGateNames : undefined,
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

async function requestQrParkingPass({
  visitorName,
  parkingGateIds,
  parkingGateNames,
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
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

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const searchCode =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("code")
      : "";

  // /open?code=... 또는 /?code=... 로 들어오면 메인 관리 화면이 아니라
  // 앱 실행 브릿지 화면을 바로 보여줍니다.
  if (pathname === "/open" || searchCode) {
    return <OpenBridgePage />;
  }

  const [merchant, setMerchant] = useState(defaultMerchant);
  const [invites, setInvites] = useState([]);
  const [form, setForm] = useState(buildInitialForm(defaultMerchant.parkingGates[0].id));
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingPass, setPendingPass] = useState(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [barrierSectionOpen, setBarrierSectionOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState("");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrTicket, setQrTicket] = useState(null);
  const [qrTicketUsed, setQrTicketUsed] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [issuedInvite, setIssuedInvite] = useState(null);
  const [inviteResultModalOpen, setInviteResultModalOpen] = useState(false);

  useEffect(() => {
    try {
      const savedMerchant = localStorage.getItem(STORAGE_KEYS.merchant);
      const savedInvites = localStorage.getItem(STORAGE_KEYS.invites);

      if (savedMerchant) {
        const parsedMerchant = JSON.parse(savedMerchant);
        const parkingGatesSource = parsedMerchant?.parkingGates || parsedMerchant?.anchors;
        const normalizedParkingGates =
          Array.isArray(parkingGatesSource) && parkingGatesSource.length > 0
            ? BARRIER_OPTIONS.map((defaultGate, index) => {
                const savedGate = parkingGatesSource[index] || {};
                return {
                  id: savedGate?.id || savedGate?.anchorId || defaultGate.id,
                  name: defaultGate.name,
                };
              })
            : BARRIER_OPTIONS;

        const nextMerchant = {
          ...defaultMerchant,
          ...parsedMerchant,
          parkingGates: normalizedParkingGates,
        };

        setMerchant(nextMerchant);
        localStorage.setItem(STORAGE_KEYS.merchant, JSON.stringify(nextMerchant));
      } else {
        localStorage.setItem(STORAGE_KEYS.merchant, JSON.stringify(defaultMerchant));
      }

      if (savedInvites) {
        const parsedInvites = JSON.parse(savedInvites);
        const safeInvites = Array.isArray(parsedInvites)
          ? parsedInvites.map(sanitizeInvite)
          : makeSeedInvites();
        setInvites(safeInvites);
        localStorage.setItem(STORAGE_KEYS.invites, JSON.stringify(safeInvites));
      } else {
        const seed = makeSeedInvites();
        setInvites(seed);
        localStorage.setItem(STORAGE_KEYS.invites, JSON.stringify(seed));
      }

      const savedFavorites = localStorage.getItem(STORAGE_KEYS.favorites);
      if (savedFavorites) {
        const parsedFavorites = JSON.parse(savedFavorites);
        setFavorites(Array.isArray(parsedFavorites) ? parsedFavorites : []);
      }
    } catch {
      const seed = makeSeedInvites();
      setMerchant(defaultMerchant);
      setInvites(seed);
      localStorage.setItem(STORAGE_KEYS.merchant, JSON.stringify(defaultMerchant));
      localStorage.setItem(STORAGE_KEYS.invites, JSON.stringify(seed));
      setFavorites([]);
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([]));
    }
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

  const remainingPasses = useMemo(() => {
    const usedCount = invites.filter((item) => item.status !== "취소").length;
    return Math.max(merchant.monthlyQuota - usedCount, 0);
  }, [invites, merchant.monthlyQuota]);

  const remainingPassesRef = useRef(remainingPasses);
  useEffect(() => {
    remainingPassesRef.current = remainingPasses;
  }, [remainingPasses]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      usageLimit: String(Math.min(Math.max(Number(prev.usageLimit || 1), 1), Math.max(remainingPasses, 1))),
    }));
  }, [remainingPasses]);

  const todayIssued = useMemo(() => {
    const today = new Date().toLocaleDateString("ko-KR");
    return invites.filter((item) => {
      const d = new Date(item.createdAt);
      if (Number.isNaN(d.getTime())) return false;
      return d.toLocaleDateString("ko-KR") === today;
    }).length;
  }, [invites]);

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
          usageLimit: String(Math.min(Math.max(numeric, 1), Math.max(remainingPasses, 1))),
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
      usageLimit: String(Math.min(Math.max(Number(favorite.usageLimit || 1), 1), Math.max(remainingPasses, 1))),
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

    if (!Array.isArray(form.selectedGateIds) || form.selectedGateIds.length === 0) {
      setError("대상 차단기를 1개 이상 선택해 주세요.");
      return;
    }

    if (remainingPasses <= 0) {
      setError("잔여 주차권이 없습니다. 운영자에게 충전 요청이 필요합니다.");
      return;
    }

    const usageLimit = Number(form.usageLimit || 1);
    if (usageLimit < 1 || usageLimit > remainingPasses) {
      setError(`사용 가능 횟수는 1회 이상, 잔여 주차권 ${remainingPasses}회 이하로 설정해 주세요.`);
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

    const nextPendingPass = buildPendingPass({ form, merchant, invites });
    setPendingPass(nextPendingPass);
    setConfirmModalOpen(true);
  }

  async function confirmIssuePass() {
    if (!pendingPass) return;

    setError("");
    setApiStatus("서버에 초대 코드 발행 요청 중입니다...");

    try {
      const result = await requestParkingPass({
        phone: "",
        visitorName: "초대코드 방문자",
        parkingGateId: pendingPass.parkingGateIds[0],
        parkingGateIds: pendingPass.parkingGateIds,
        parkingGateNames: pendingPass.parkingGateNames,
        validMinutes: pendingPass.durationMinutes,
        memo: pendingPass.memo,
        usageLimit: pendingPass.usageLimit,
        ticketValidFrom: pendingPass.ticketValidFrom,
        ticketValidUntil: pendingPass.ticketValidUntil,
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
        id: inviteId,
        inviteId,
        inviteCode,
        status: "발행 완료",
        phone: "초대코드 직접 전달",
        visitorName: "초대코드 방문자",
        issueMethod: "manual",
        serverSynced: true,
        serverInviteUrl: inviteUrl,
      });

      persistInvites([savedInvite, ...invites]);
      setIssuedInvite({
        ...savedInvite,
        inviteUrl,
      });
      setInviteResultModalOpen(true);
      setConfirmModalOpen(false);
      setPendingPass(null);
      setApiStatus("");
      setToast("초대 코드가 발행되었습니다.");
      resetForm();
    } catch (err) {
      setApiStatus("");
      setError(err?.message || "초대 코드 발행 중 오류가 발생했습니다.");
    }
  }

  async function copyLink(invite) {
    const code = invite.inviteCode || invite.inviteId || invite.id || "";

    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(invite.id);
      setToast("초대 코드를 복사했습니다.");
      setTimeout(() => setCopiedId(""), 1500);
    } catch {
      setError("초대 코드 복사에 실패했습니다.");
    }
  }

  async function copyIssuedInviteCode() {
    if (!issuedInvite?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(issuedInvite.inviteCode);
      setToast("초대 코드를 복사했습니다.");
    } catch {
      setError("초대 코드 복사에 실패했습니다.");
    }
  }

  async function copyIssuedInviteLink() {
    const value = issuedInvite?.inviteCode ? deepLinkFor("", issuedInvite.inviteId || issuedInvite.id, issuedInvite.inviteCode) : "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setToast("초대 링크를 복사했습니다.");
    } catch {
      setError("초대 링크 복사에 실패했습니다.");
    }
  }

  async function issueAnotherInviteFromLast() {
    if (!issuedInvite) return;

    setError("");
    setApiStatus("서버에 새 초대 코드 발행 요청 중입니다...");

    try {
      const parkingGateIds = normalizeGateIds(issuedInvite.parkingGateIds);
      const parkingGateNames =
        Array.isArray(issuedInvite.parkingGateNames) && issuedInvite.parkingGateNames.length > 0
          ? issuedInvite.parkingGateNames
          : gateNamesFromIds(parkingGateIds, merchant.parkingGates);

      const result = await requestParkingPass({
        phone: "",
        visitorName: "초대코드 방문자",
        parkingGateId: parkingGateIds[0],
        parkingGateIds,
        parkingGateNames,
        validMinutes: Number(issuedInvite.durationMinutes || 60),
        memo: issuedInvite.memo || "",
        usageLimit: Number(issuedInvite.usageLimit || 1),
        ticketValidFrom: issuedInvite.ticketValidFrom,
        ticketValidUntil: issuedInvite.ticketValidUntil,
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
        phone: "초대코드 직접 전달",
        visitorName: "초대코드 방문자",
        issueMethod: "manual",
        createdAt: nowIso(),
        serverSynced: true,
        serverInviteUrl: inviteUrl,
        usedAt: "",
      });

      persistInvites([newInvite, ...invites]);
      setIssuedInvite({
        ...newInvite,
        inviteUrl,
      });
      setApiStatus("");
      setToast("새 초대 코드가 발행되었습니다.");
    } catch (err) {
      setApiStatus("");
      setError(err?.message || "새 초대 코드 발행 중 오류가 발생했습니다.");
    }
  }


  async function handleIssueQrPass() {
    setError("");

    if (!Array.isArray(form.selectedGateIds) || form.selectedGateIds.length === 0) {
      setError("대상 차단기를 1개 이상 선택해 주세요.");
      return;
    }

    if (remainingPasses <= 0) {
      setError("잔여 주차권이 없습니다. 운영자에게 충전 요청이 필요합니다.");
      return;
    }

    const usageLimit = Number(form.usageLimit || 1);
    if (usageLimit < 1 || usageLimit > remainingPasses) {
      setError(`사용 가능 횟수는 1회 이상, 잔여 주차권 ${remainingPasses}회 이하로 설정해 주세요.`);
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

    const selectedGateIds = normalizeGateIds(form.selectedGateIds);
    const selectedGateNames = gateNamesFromIds(selectedGateIds, merchant.parkingGates);

    setQrBusy(true);
    setApiStatus("서버에 QR 주차권 등록 요청 중입니다...");

    try {
      const result = await requestQrParkingPass({
        visitorName: form.visitorName.trim() || "QR 방문자",
        parkingGateIds: selectedGateIds,
        parkingGateNames: selectedGateNames,
        validMinutes: Number(form.durationMinutes),
        memo: form.memo.trim(),
        usageLimit,
        ticketValidFrom: validFrom.toISOString(),
        ticketValidUntil: validUntil.toISOString(),
        merchant,
      });

      const inviteId = result.inviteId || result.requestId || result.id || safeUuid();
      const inviteCode = result.inviteCode || result.code || inviteId;
      const inviteUrl = deepLinkFor("", inviteId, inviteCode);

      const newQrInvite = sanitizeInvite({
        id: inviteId,
        inviteId,
        inviteCode,
        visitorName: form.visitorName.trim() || "QR 방문자",
        phone: "QR 스캔 발급",
        shopName: merchant.shopName,
        parkingGateIds: selectedGateIds,
        parkingGateNames: selectedGateNames,
        memo: form.memo.trim(),
        durationMinutes: Number(form.durationMinutes),
        expiresAt: futureIso(Number(form.durationMinutes)),
        ticketValidFrom: validFrom.toISOString(),
        ticketValidUntil: validUntil.toISOString(),
        usageLimit,
        status: "발행 완료",
        issueMethod: "qr",
        createdAt: nowIso(),
        serverSynced: true,
        serverInviteUrl: inviteUrl,
      });

      persistInvites([newQrInvite, ...invites]);
      setQrTicket({
        ...newQrInvite,
        inviteUrl,
      });
      setQrTicketUsed(false);
      setQrModalOpen(true);
      setToast("QR 주차권이 서버에 등록되었습니다.");
      setApiStatus("");
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

    setFavoriteModalOpen(false);
    setIssuedInvite(null);

    resetForm();
    setShowHistoryPanel(false);

    setToast("데모 데이터를 초기화했습니다.");
  }

  const stats = [
    { label: "잔여 주차권", value: `${remainingPasses}` },
    { label: "오늘 발행", value: `${todayIssued}` },
    { label: "이번 달 한도", value: `${merchant.monthlyQuota}` },
  ];

  const quickMenus = [
    {
      label: "잔여 주차권 충전 요청",
      action: () => setToast("운영자에게 충전 요청을 보냈다고 가정한 데모입니다."),
    },
    {
      label: "즐겨찾기",
      action: () => setFavoriteModalOpen(true),
    },
    {
      label: "방문자 이력 확인하기",
      action: () => {
        setFilter("all");
        setShowHistoryPanel(true);
      },
    },
    {
      label: "만료 내역 보기",
      action: () => {
        setFilter("만료");
        setShowHistoryPanel(true);
      },
    },
    {
      label: "고객센터 문의",
      action: () => setToast("고객센터 연결 기능은 다음 단계에서 추가할 수 있습니다."),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm text-slate-500">방문자 주차권 시스템</p>
            <h1 className="text-xl font-bold sm:text-2xl">{merchant.shopName} 주차 방문 관리</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetDemoData}
              className="rounded-2xl border px-4 py-2 text-sm font-medium leading-tight shadow-sm hover:bg-slate-50"
            >
              데모<br />초기화
            </button>
            <button
              type="button"
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
        title="초대 코드 발행 확인"
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
              <p>
                <span className="font-medium text-slate-700">사용 가능 횟수:</span> {pendingPass.usageLimit}회
              </p>
              <p className="sm:col-span-2">
                <span className="font-medium text-slate-700">주차권 사용기간:</span> {displayDate(pendingPass.ticketValidFrom)} ~ {displayDate(pendingPass.ticketValidUntil)}
              </p>
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
                확인 후 초대코드 발행
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={inviteResultModalOpen}
        title="초대 코드 발행 완료"
        onClose={() => setInviteResultModalOpen(false)}
      >
        {issuedInvite ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-800">초대 코드가 발행되었습니다.</p>
              <div className="mt-3 rounded-xl bg-white px-4 py-4 text-3xl font-black tracking-widest text-slate-900 ring-1 ring-emerald-100">
                {issuedInvite.inviteCode || "-"}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-emerald-800">
                방문자에게 초대 코드를 직접 전달해 주세요. 전화번호/SMS는 사용하지 않습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyIssuedInviteCode}
                className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                초대 코드 복사
              </button>
              <button
                type="button"
                onClick={copyIssuedInviteLink}
                className="rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                초대 링크 복사
              </button>
            </div>

            <button
              type="button"
              onClick={issueAnotherInviteFromLast}
              disabled={Boolean(apiStatus)}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {apiStatus ? "새 초대 코드 발행 중..." : "같은 조건으로 새 초대 코드 발행"}
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
        open={qrModalOpen}
        title="QR 초대 코드 발행"
        onClose={() => setQrModalOpen(false)}
      >
        {qrTicket ? (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <p><span className="font-medium text-slate-700">방문자명:</span> {qrTicket.visitorName}</p>
              <p><span className="font-medium text-slate-700">상태:</span> 서버 등록 완료</p>
              <p className="sm:col-span-2"><span className="font-medium text-slate-700">대상 차단기:</span> {qrTicket.parkingGateNames.join(", ")}</p>
              <p><span className="font-medium text-slate-700">유효시간:</span> {displayDuration(qrTicket.durationMinutes)}</p>
              <p><span className="font-medium text-slate-700">사용 가능 횟수:</span> {qrTicket.usageLimit}회</p>
              <p className="sm:col-span-2"><span className="font-medium text-slate-700">주차권 사용기간:</span> {displayDate(qrTicket.ticketValidFrom)} ~ {displayDate(qrTicket.ticketValidUntil)}</p>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="flex flex-col items-center gap-3">
                {qrTicketUsed ? (
                  <div className="flex h-64 w-64 items-center justify-center rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-lg font-bold text-slate-500">
                    새로 발급해 주세요
                  </div>
                ) : (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrTicket.inviteUrl)}`}
                    alt="QR Code"
                    className="h-64 w-64 rounded-2xl border bg-white p-2"
                  />
                )}
                <p className="text-xs text-slate-500">
                  방문자 폰으로 스캔하면 서버에 등록된 실제 주차권 코드로 열립니다. 사용 처리 후에는 같은 팝업에서 새 QR을 발행할 수 있습니다.
                </p>
                {!qrTicketUsed ? (
                  <div className="w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700 break-all">
                    {qrTicket.inviteUrl}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
              <button
                type="button"
                onClick={handleIssueQrPass}
                disabled={qrBusy}
                className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {qrBusy ? "발행 중..." : "새 QR 발행"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(qrTicket.inviteUrl);
                    setToast("QR 링크를 복사했습니다.");
                  } catch {
                    setError("클립보드 복사에 실패했습니다.");
                  }
                }}
                disabled={qrTicketUsed}
                className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                링크 복사
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
        ) : null}
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
              유효시간, 사용 횟수, 시작/종료 시간, 대상 차단기를 저장합니다.
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
                          유효시간 {displayDuration(favorite.durationMinutes)} · {favorite.usageLimit}회
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

      <main className="mx-auto grid max-w-7xl gap-3 px-3 py-3 sm:px-4 lg:grid-cols-12 lg:px-6">
        <section className="space-y-3 lg:col-span-8">
          <form onSubmit={handleOpenConfirm} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold sm:text-xl">방문자 초대 코드 발행</h2>
                <p className="mt-1 text-sm text-slate-500">
                  유효시간은 방문자가 실제로 주차권을 사용한 시점부터 적용됩니다.
                </p>
              </div>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                잔여 주차권 {remainingPasses}건
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1">
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

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1">
                <div className="flex items-center gap-1.5">
                  <label className="w-12 shrink-0 text-[11px] font-medium text-slate-700">횟수</label>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(remainingPasses, 1)}
                    value={form.usageLimit}
                    onChange={(e) => handleChange("usageLimit", e.target.value)}
                    className="min-w-0 w-14 rounded-md border bg-white px-1.5 py-1 text-[12px] outline-none focus:border-slate-400"
                  />
                  <span className="truncate text-[10px] text-slate-500">/{remainingPasses}</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 col-span-2">
                <div className="grid grid-cols-[1fr_auto] gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <label className="w-12 shrink-0 text-[11px] font-medium text-slate-700">시작</label>
                    <input
                      type="datetime-local"
                      value={form.ticketValidFrom}
                      onChange={(e) => handleChange("ticketValidFrom", e.target.value)}
                      className="min-w-0 flex-1 rounded-md border bg-white px-1.5 py-1 text-[11px] outline-none focus:border-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => applyDefaultValidityRange(form.durationMinutes)}
                    className="rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-slate-50 whitespace-nowrap"
                  >
                    현재 기준
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 col-span-2">
                <div className="flex items-center gap-1.5">
                  <label className="w-12 shrink-0 text-[11px] font-medium text-slate-700">종료</label>
                  <input
                    type="datetime-local"
                    value={form.ticketValidUntil}
                    onChange={(e) => handleChange("ticketValidUntil", e.target.value)}
                    className="min-w-0 flex-1 rounded-md border bg-white px-1.5 py-1 text-[11px] outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <p className="col-span-2 text-[10px] leading-tight text-slate-500">
                유효시간은 실제 사용 시점부터 적용됩니다. 시작/종료일시를 직접 수정하지 않으면 현재 시각 기준으로 자동 반영됩니다.
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
                          <span className="text-[11px] font-medium leading-none">{barrier.name}</span>
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
                className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-[15px] font-semibold text-white shadow-sm hover:opacity-90 sm:py-3.5"
              >
                초대 코드 발행
              </button>
              <button
                type="button"
                onClick={handleIssueQrPass}
                disabled={qrBusy}
                className="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3.5"
              >
                {qrBusy ? "QR 서버 등록 중..." : "QR Code 발행"}
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
                            <p>사용 가능 횟수: {row.usageLimit}회</p>
                            <p>생성 시각: {displayDate(row.createdAt)}</p>
                            <p className="sm:col-span-2">주차권 사용기간: {displayDate(row.ticketValidFrom)} ~ {displayDate(row.ticketValidUntil)}</p>
                            <p className="sm:col-span-2">메모: {row.memo || "-"}</p>
                            <p className="break-all sm:col-span-2">
                              초대 링크: {deepLinkFor("", row.inviteId || row.id, row.inviteCode)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[360px]">
                          <button
                            type="button"
                            onClick={() => copyLink(row)}
                            className="rounded-2xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            {copiedId === row.id ? "복사됨" : "초대 코드 복사"}
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
                <span className="text-slate-500">대표자</span>
                <span className="font-medium">{merchant.ownerName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="shrink-0 text-slate-500">주소</span>
                <span className="text-right font-medium">{merchant.address || "주소 미등록"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">요금제</span>
                <span className="font-medium">{merchant.pricingName || merchant.planName}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
            <h2 className="text-lg font-semibold">서버 연동 상태</h2>
            <div className="mt-4 space-y-2 text-sm">
              <p className="break-all text-slate-600">API: {API_BASE_URL}</p>
              {API_BASE_URL.includes("REPLACE_WITH_YOUR_API_ID") ? (
                <p className="rounded-2xl bg-amber-50 px-3 py-2 text-amber-700">
                  App.jsx 상단의 API_BASE_URL 또는 VITE_API_BASE_URL 값을 실제 Invoke URL로 바꿔야 합니다.
                </p>
              ) : (
                <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-700">실제 API Gateway 주소가 설정되어 있습니다.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
            <h2 className="text-lg font-semibold">빠른 메뉴</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {quickMenus.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="rounded-2xl border px-4 py-4 text-sm font-medium hover:bg-slate-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
