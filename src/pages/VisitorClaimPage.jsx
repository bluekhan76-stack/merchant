import React, { useMemo, useState } from "react";

const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_VISITOR_API_BASE_URL ||
      import.meta.env.VITE_API_BASE_URL)) ||
  "https://8q72reoak2.execute-api.ap-northeast-2.amazonaws.com";

const API_PATHS = {
  claimPass: "/api/visitor/claim",
};

function getInviteCodeFromLocation() {
  const url = new URL(window.location.href);
  return url.searchParams.get("code") || url.searchParams.get("inviteCode") || "";
}

function getPinCodeFromLocation() {
  const url = new URL(window.location.href);
  return url.searchParams.get("pin") || url.searchParams.get("pinCode") || "";
}

export default function VisitorClaimPage() {
  const inviteCode = useMemo(() => getInviteCodeFromLocation(), []);
  const pinCode = useMemo(() => getPinCodeFromLocation(), []);
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function handleClaim() {
    if (!inviteCode) {
      setError("주차권 코드가 없습니다. QR Code를 다시 스캔해 주세요.");
      return;
    }

    if (!pinCode) {
      setError("QR Code 보안값이 없습니다. 상가에서 새 QR Code를 다시 발행해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}${API_PATHS.claimPass}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviteCode,
          pinCode,
          deviceType: "web",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.ok === false) {
        throw new Error(data.message || "주차권 사용 처리에 실패했습니다.");
      }

      setClaimed(true);
      setResult(data);
      setMessage("주차권이 사용 처리되었습니다. 앱이 설치되어 있다면 앱 열기를 눌러 차단기를 열어 주세요.");
    } catch (err) {
      setError(err?.message || "주차권 사용 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function openApp() {
    const token = result?.parkingToken || result?.appToken || result?.token || inviteCode;
    window.location.href = `bluekhan://invite?code=${encodeURIComponent(inviteCode)}&token=${encodeURIComponent(token)}`;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">방문자 주차권</p>
        <h1 className="mt-2 text-2xl font-bold">주차권 사용 확인</h1>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          QR Code 스캔만으로는 주차권이 차감되지 않습니다. 아래 버튼을 누르면 서버가 QR 내부 보안값을 검증한 뒤 상가 주차권이 1회 차감되고 출차용 주차권이 활성화됩니다.
        </p>

        {inviteCode ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 ring-1 ring-slate-200">
            주차권 코드가 확인되었습니다.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
            {message}
          </div>
        ) : null}

        {!claimed ? (
          <button
            type="button"
            onClick={handleClaim}
            disabled={loading || !inviteCode}
            className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "사용 처리 중..." : "주차권 사용하기"}
          </button>
        ) : (
          <button
            type="button"
            onClick={openApp}
            className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white"
          >
            앱 열기
          </button>
        )}

        <p className="mt-4 text-xs leading-5 text-slate-500">
          앱이 설치되어 있으면 앱 내부의 QR 스캔 기능을 사용해도 됩니다. 앱이 없으면 앱 설치 후 같은 QR 링크를 다시 열어 주세요.
        </p>
      </div>
    </div>
  );
}
