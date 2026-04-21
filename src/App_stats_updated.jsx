import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEYS = {
  merchant: "merchant_owner_demo_profile",
  invites: "merchant_owner_demo_invites",
};

const defaultMerchant = {
  shopName: "A동 201호",
  ownerName: "정태윤",
  phone: "010-1111-2222",
  planName: "월 300건",
  monthlyQuota: 300,
  parkingGates: [
    { id: "gate-main", name: "정문 차단기" },
    { id: "gate-b1", name: "지하 주차장 입구" },
  ],
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

function makeSeedInvites() {
  return [
    {
      id: safeUuid(),
      visitorName: "김민수",
      phone: "010-1234-5678",
      shopName: "A동 201호",
      parkingGateId: "gate-main",
      parkingGateName: "정문 차단기",
      memo: "12가 3456 / 미팅 방문",
      durationMinutes: 60,
      expiresAt: futureIso(60),
      status: "앱 수신",
      createdAt: nowIso(),
    },
    {
      id: safeUuid(),
      visitorName: "김민수",
      phone: "010-1234-5678",
      shopName: "A동 201호",
      parkingGateId: "gate-main",
      parkingGateName: "정문 차단기",
      memo: "재방문 / 납품 차량",
      durationMinutes: 120,
      expiresAt: futureIso(120),
      status: "발행 완료",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: safeUuid(),
      visitorName: "박지현",
      phone: "010-9876-5432",
      shopName: "A동 201호",
      parkingGateId: "gate-b1",
      parkingGateName: "지하 주차장 입구",
      memo: "차량번호 미입력",
      durationMinutes: 120,
      expiresAt: futureIso(120),
      status: "발행 완료",
      createdAt: nowIso(),
    },
  ];
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

function deepLinkFor(phone, inviteId) {
  const url = new URL("https://parking.example.com/invite");
  url.searchParams.set("claim", inviteId);
  url.searchParams.set("phone", phone.replace(/\D/g, ""));
  return url.toString();
}

function statusTone(status) {
  if (status === "앱 수신") return "bg-emerald-50 text-emerald-700";
  if (status === "만료") return "bg-rose-50 text-rose-700";
  if (status === "재발송") return "bg-amber-50 text-amber-700";
  if (status === "취소") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function sanitizeInvite(item) {
  return {
    id: item?.id || safeUuid(),
    visitorName: item?.visitorName || "",
    phone: item?.phone || "",
    shopName: item?.shopName || defaultMerchant.shopName,
    parkingGateId: item?.parkingGateId || item?.anchorId || defaultMerchant.parkingGates[0].id,
    parkingGateName:
      item?.parkingGateName || item?.anchorName || defaultMerchant.parkingGates[0].name,
    memo: item?.memo || "",
    durationMinutes: Number(item?.durationMinutes || 60),
    expiresAt: item?.expiresAt || futureIso(60),
    status: item?.status || "발행 완료",
    createdAt: item?.createdAt || nowIso(),
  };
}

function buildPendingPass({ form, merchant, invites }) {
  const fallbackGate = merchant.parkingGates?.[0] || defaultMerchant.parkingGates[0];
  const parkingGate =
    merchant.parkingGates.find((item) => item.id === form.parkingGateId) || fallbackGate;
  const history = invites
    .filter((item) => item.phone === form.phone)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    id: safeUuid(),
    visitorName: form.visitorName.trim() || "이름 미입력",
    phone: form.phone,
    shopName: merchant.shopName,
    parkingGateId: parkingGate?.id || form.parkingGateId,
    parkingGateName: parkingGate?.name || "미지정",
    memo: form.memo.trim(),
    durationMinutes: Number(form.durationMinutes),
    expiresAt: futureIso(Number(form.durationMinutes)),
    status: "발행 완료",
    createdAt: nowIso(),
    history,
    visitCount: history.length,
  };
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4">
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
  const [form, setForm] = useState({
    visitorName: "",
    phone: "",
    durationMinutes: "60",
    parkingGateId: defaultMerchant.parkingGates[0].id,
    memo: "",
  });
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingPass, setPendingPass] = useState(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  useEffect(() => {
    try {
      const savedMerchant = localStorage.getItem(STORAGE_KEYS.merchant);
      const savedInvites = localStorage.getItem(STORAGE_KEYS.invites);

      if (savedMerchant) {
        const parsedMerchant = JSON.parse(savedMerchant);
        const parkingGatesSource = parsedMerchant?.parkingGates || parsedMerchant?.anchors;
        setMerchant({
          ...defaultMerchant,
          ...parsedMerchant,
          parkingGates:
            Array.isArray(parkingGatesSource) && parkingGatesSource.length > 0
              ? parkingGatesSource.map((item, index) => ({
                  id: item?.id || item?.anchorId || defaultMerchant.parkingGates[index]?.id || `gate-${index + 1}`,
                  name:
                    item?.name ||
                    item?.anchorName ||
                    defaultMerchant.parkingGates[index]?.name ||
                    `주차기 ${index + 1}`,
                }))
              : defaultMerchant.parkingGates,
        });
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
      const hasMatchingGate = merchant.parkingGates.some((item) => item.id === prev.parkingGateId);
      if (hasMatchingGate) return prev;

      return {
        ...prev,
        parkingGateId: merchant.parkingGates[0].id,
      };
    });
  }, [merchant]);


  const remainingPasses = useMemo(() => {
    const usedCount = invites.filter((item) => item.status !== "취소").length;
    return Math.max(merchant.monthlyQuota - usedCount, 0);
  }, [invites, merchant.monthlyQuota]);

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

  function persistInvites(nextInvites) {
    setInvites(nextInvites);
    localStorage.setItem(STORAGE_KEYS.invites, JSON.stringify(nextInvites));
  }

  function handleChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: field === "phone" ? normalizePhone(value) : value,
    }));
  }

  function resetForm() {
    setForm({
      visitorName: "",
      phone: "",
      durationMinutes: "60",
      parkingGateId: merchant.parkingGates?.[0]?.id || defaultMerchant.parkingGates[0].id,
      memo: "",
    });
    setError("");
  }

  function handleOpenConfirm(event) {
    event.preventDefault();
    setError("");

    if (!isValidPhone(form.phone)) {
      setError("전화번호 형식을 확인해 주세요. 예: 010-1234-5678");
      return;
    }

    if (remainingPasses <= 0) {
      setError("잔여 주차권이 없습니다. 운영자에게 충전 요청이 필요합니다.");
      return;
    }

    const nextPendingPass = buildPendingPass({ form, merchant, invites });
    setPendingPass(nextPendingPass);
    setConfirmModalOpen(true);
  }

  function confirmIssuePass() {
    if (!pendingPass) return;

    const { history, visitCount, ...newPass } = pendingPass;
    const next = [newPass, ...invites];
    persistInvites(next);
    setConfirmModalOpen(false);
    setPendingPass(null);
    setToast("주차권이 발행되었고 방문자 링크가 발송되었습니다.");
    resetForm();
  }

  async function copyLink(invite) {
    const link = deepLinkFor(invite.phone, invite.id);

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
    대` },
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
            <h1 className="text-xl font-bold sm:text-2xl">
              {merchant.shopName} 주차 방문 관리
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={resetDemoData}
              className="rounded-2xl border px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
            >
              데모 초기화
            </button>
            <button
              type="button"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            >
              로그아웃
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
              <p>
                <span className="font-medium text-slate-700">대상 주차기:</span> {pendingPass.parkingGateName}
              </p>
              <p>
                <span className="font-medium text-slate-700">유효시간:</span> {pendingPass.durationMinutes}분
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
                      <p className="mt-2 text-slate-600">주차기: {item.parkingGateName}</p>
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
                className="rounded-2xl border px-5 py-3 font-medium hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmIssuePass}
                className="rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white shadow-sm hover:opacity-90"
              >
                확인 후 링크 발송
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:px-8">
        <section className="space-y-6 lg:col-span-8">
<form
            onSubmit={handleOpenConfirm}
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold sm:text-xl">방문자 1회성 주차권 발행</h2>
                <p className="mt-1 text-sm text-slate-500">
                  전화번호를 입력하면 방문자 앱 실행 링크를 발송할 수 있습니다.
                </p>
              </div>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                기본 주차기: {merchant.parkingGates[0]?.name}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">방문자 이름</label>
                <input
                  value={form.visitorName}
                  onChange={(e) => handleChange("visitorName", e.target.value)}
                  className="w-full rounded-2xl border bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                  placeholder="예: 김민수"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">전화번호</label>
                <input
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="w-full rounded-2xl border bg-white px-4 py-3 outline-none transition focus:border-slate-400"
                  placeholder="010-0000-0000"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">유효시간</label>
                <select
                  value={form.durationMinutes}
                  onChange={(e) => handleChange("durationMinutes", e.target.value)}
                  className="w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-slate-400"
                >
                  <option value="30">30분</option>
                  <option value="60">1시간</option>
                  <option value="120">2시간</option>
                  <option value="240">4시간</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">대상 주차기</label>
                <select
                  value={form.parkingGateId}
                  onChange={(e) => handleChange("parkingGateId", e.target.value)}
                  className="w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-slate-400"
                >
                  {merchant.parkingGates.map((parkingGate) => (
                    <option key={parkingGate.id} value={parkingGate.id}>
                      {parkingGate.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">메모</label>
              <textarea
                value={form.memo}
                onChange={(e) => handleChange("memo", e.target.value)}
                className="min-h-28 w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-slate-400"
                placeholder="차량번호 또는 방문 목적을 입력하세요."
              />
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border px-5 py-3 font-medium hover:bg-slate-50"
              >
                초기화
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white shadow-sm hover:opacity-90"
              >
                주차권 발행
              </button>
            </div>
          </form>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200"
              >
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="mt-1 text-xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>


          {showHistoryPanel ? (
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold sm:text-xl">최근 발행 내역</h2>
                  <p className="text-sm text-slate-500">
                    상태 변경과 링크 복사까지 바로 테스트할 수 있습니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="rounded-2xl border px-4 py-2 text-sm outline-none"
                  >
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
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(
                                row.status
                              )}`}
                            >
                              {row.status}
                            </span>
                          </div>

                          <div className="grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                            <p>전화번호: {row.phone}</p>
                            <p>상가: {row.shopName}</p>
                            <p>주차기: {row.parkingGateName}</p>
                            <p>유효기간: {displayDate(row.expiresAt)}</p>
                            <p className="sm:col-span-2">메모: {row.memo || "-"}</p>
                            <p className="break-all sm:col-span-2">
                              방문자 링크: {deepLinkFor(row.phone, row.id)}
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
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
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

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
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
