import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEYS = {
  merchant: "merchant_owner_demo_profile",
  invites: "merchant_owner_demo_invites",
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
  if (API_BASE_URL.includes("REPLACE_WITH_YOUR_API_ID")) {
    const url = new URL("https://parking.example.com/invite");
    url.searchParams.set("claim", inviteId || "");
    url.searchParams.set("phone", phone.replace(/\D/g, ""));
    return url.toString();
  }
  return `${API_BASE_URL}/i/${inviteKey}`;
}

function statusTone(status) {
  if (status === "앱 수신") return "bg-emerald-50 text-emerald-700";
  if (status === "만료") return "bg-rose-50 text-rose-700";
  if (status === "재발송") return "bg-amber-50 text-amber-700";
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
  validMinutes,
  memo,
  usageLimit,
  ticketValidFrom,
  ticketValidUntil,
}) {
  const response = await fetch(`${API_BASE_URL}${API_PATHS.requestPass}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: phone.replace(/\D/g, ""),
      visitorName: visitorName || "",
      parkingGateId,
      validMinutes,
      memo: memo || "",
      usageLimit,
      ticketValidFrom,
      ticketValidUntil,
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
    } catch {
      const seed = makeSeedInvites();
      setMerchant(defaultMerchant);
      setInvites(seed);
      localStorage.setItem(STORAGE_KEYS.merchant, JSON.stringify(defaultMerchant));
      localStorage.setItem(STORAGE_KEYS.invites, JSON.stringify(seed));
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

  function resetForm() {
    setForm(buildInitialForm(merchant.parkingGates?.[0]?.id || defaultMerchant.parkingGates[0].id));
    setError("");
    setApiStatus("");
  }

  function handleOpenConfirm(event) {
    event.preventDefault();
    setError("");

    if (!isValidPhone(form.phone)) {
      setError("전화번호 형식을 확인해 주세요. 예: 010-1234-5678");
      return;
    }

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
    setApiStatus("서버에 주차권 발행 요청 중입니다...");

    try {
      const result = await requestParkingPass({
        phone: pendingPass.phone,
        visitorName: pendingPass.visitorName,
        parkingGateId: pendingPass.parkingGateIds[0],
        validMinutes: pendingPass.durationMinutes,
        memo: pendingPass.memo,
        usageLimit: pendingPass.usageLimit,
        ticketValidFrom: pendingPass.ticketValidFrom,
        ticketValidUntil: pendingPass.ticketValidUntil,
      });

      const inviteId = result.inviteId || result.requestId || pendingPass.id;
      const inviteCode = result.inviteCode || "";
      const inviteUrl = result.link || result.inviteUrl || "";

      const { history, visitCount, ...newPass } = pendingPass;
      const next = [
        sanitizeInvite({
          ...newPass,
          id: inviteId,
          inviteId,
          inviteCode,
          status: "발행 완료",
          serverSynced: true,
          serverInviteUrl: inviteUrl,
        }),
        ...invites,
      ];

      persistInvites(next);
      setConfirmModalOpen(false);
      setPendingPass(null);
      setApiStatus("");
      setToast("주차권이 발행되었고 서버 요청이 완료되었습니다.");
      resetForm();
    } catch (err) {
      setApiStatus("");
      setError(err?.message || "주차권 발행 중 오류가 발생했습니다.");
    }
  }

  async function copyLink(invite) {
    const link = invite.serverInviteUrl || deepLinkFor(invite.phone, invite.inviteId || invite.id, invite.inviteCode);

    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      setToast("방문자 링크를 복사했습니다.");
      setTimeout(() => setCopiedId(""), 1500);
    } catch {
      setError("클립보드 복사에 실패했습니다.");
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
    const seed = makeSeedInvites();
    localStorage.setItem(STORAGE_KEYS.merchant, JSON.stringify(defaultMerchant));
    localStorage.setItem(STORAGE_KEYS.invites, JSON.stringify(seed));
    setMerchant(defaultMerchant);
    setInvites(seed);
    setPendingPass(null);
    setConfirmModalOpen(false);
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
      label: "문자 재발송 안내",
      action: () => setToast("발행 내역 카드에서 재발송 버튼으로 테스트할 수 있습니다."),
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
            <p className="text-sm text-slate-500">상가 주인용 방문자 주차권 관리</p>
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
        title="주차권 발행 확인"
        onClose={() => {
          setConfirmModalOpen(false);
          setPendingPass(null);
        }}
      >
        {pendingPass ? (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <p>
                <span className="font-medium text-slate-700">방문자명:</span> {pendingPass.visitorName}
              </p>
              <p>
                <span className="font-medium text-slate-700">전화번호:</span> {pendingPass.phone}
              </p>
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

            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-base font-semibold">방문 이력 확인</h4>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  총 방문 {pendingPass.visitCount}회
                </span>
              </div>

              {pendingPass.history.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  해당 전화번호로 등록된 방문 이력이 없습니다. 이번이 첫 방문입니다.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {pendingPass.history.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{displayDate(item.createdAt)}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-2 text-slate-600">차단기: {item.parkingGateNames.join(", ")}</p>
                      <p className="text-slate-600">사용 가능 횟수: {item.usageLimit}회</p>
                      <p className="text-slate-600">메모: {item.memo || "-"}</p>
                    </div>
                  ))}
                </div>
              )}
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
                확인 후 링크 발송
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <main className="mx-auto grid max-w-7xl gap-3 px-3 py-3 sm:px-4 lg:grid-cols-12 lg:px-6">
        <section className="space-y-3 lg:col-span-8">
          <form onSubmit={handleOpenConfirm} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold sm:text-xl">방문자 주차권 발행</h2>
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
                  <label className="w-12 shrink-0 text-[11px] font-medium text-slate-700">이름</label>
                  <input
                    value={form.visitorName}
                    onChange={(e) => handleChange("visitorName", e.target.value)}
                    className="min-w-0 flex-1 rounded-md border bg-white px-1.5 py-1 text-[12px] outline-none transition focus:border-slate-400"
                    placeholder="김민수"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1">
                <div className="flex items-center gap-1.5">
                  <label className="w-12 shrink-0 text-[11px] font-medium text-slate-700">전화</label>
                  <input
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    className="min-w-0 flex-1 rounded-md border bg-white px-1.5 py-1 text-[12px] outline-none transition focus:border-slate-400"
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>

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

            <div className="mt-2">
              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-[15px] font-semibold text-white shadow-sm hover:opacity-90 sm:py-3.5"
              >
                주차권 발행
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
                            <p>전화번호: {row.phone}</p>
                            <p>상가: {row.shopName}</p>
                            <p>대상 차단기: {row.parkingGateNames.join(", ")}</p>
                            <p>유효시간: {displayDuration(row.durationMinutes)}</p>
                            <p>사용 가능 횟수: {row.usageLimit}회</p>
                            <p>생성 시각: {displayDate(row.createdAt)}</p>
                            <p className="sm:col-span-2">주차권 사용기간: {displayDate(row.ticketValidFrom)} ~ {displayDate(row.ticketValidUntil)}</p>
                            <p className="sm:col-span-2">메모: {row.memo || "-"}</p>
                            <p className="break-all sm:col-span-2">
                              방문자 링크: {row.serverInviteUrl || deepLinkFor(row.phone, row.inviteId || row.id, row.inviteCode)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[360px]">
                          <button
                            type="button"
                            onClick={() => copyLink(row)}
                            className="rounded-2xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            {copiedId === row.id ? "복사됨" : "링크 복사"}
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
              <div className="flex justify-between">
                <span className="text-slate-500">연락처</span>
                <span className="font-medium">{merchant.phone}</span>
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
