import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://8q72reoak2.execute-api.ap-northeast-2.amazonaws.com";

export default function SignupPage() {
  const navigate = useNavigate();

  const [requestedUsername, setRequestedUsername] = useState("");
  const [password, setPassword] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const normalizeUsername = (value) =>
    value
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 32);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const loginId = requestedUsername.trim();
    const trimmedPassword = password.trim();
    const trimmedBuildingName = buildingName.trim();
    const trimmedRoomNo = roomNo.trim();

    if (loginId.length < 4) {
      setError("로그인 ID는 4자 이상 입력해 주세요.");
      return;
    }

    if (trimmedPassword.length < 8) {
      setError("비밀번호는 8자 이상 입력해 주세요.");
      return;
    }

    if (!trimmedBuildingName) {
      setError("상가(건물)명을 입력해 주세요.");
      return;
    }

    if (!trimmedRoomNo) {
      setError("호실을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/public/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loginId,
          username: loginId,
          password: trimmedPassword,
          buildingName: trimmedBuildingName,
          roomNo: trimmedRoomNo,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        if (data?.code === "UsernameExistsException") {
          setError("이미 사용 중인 로그인 ID입니다.");
        } else {
          setError(data.message || "가입 신청에 실패했습니다.");
        }
        return;
      }

      alert("가입 신청이 완료되었습니다. 운영자 승인 후 로그인할 수 있습니다.");
      navigate("/pending", { replace: true });
    } catch (err) {
      console.error(err);
      setError("서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold">상가 회원가입 신청</h1>
        <p className="mt-2 text-sm text-slate-600">
          가입 신청 후 운영자 승인 완료 시 주차권 발행 기능을 사용할 수 있습니다.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            희망 로그인 ID
            <input
              value={requestedUsername}
              onChange={(event) =>
                setRequestedUsername(normalizeUsername(event.target.value))
              }
              className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="예: merchant001"
              autoComplete="username"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="8자 이상 입력"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            상가(건물) 명
            <input
              value={buildingName}
              onChange={(event) => setBuildingName(event.target.value)}
              className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="예: 블루칸상가"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            호실
            <input
              value={roomNo}
              onChange={(event) => setRoomNo(event.target.value)}
              className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="예: 301호"
              required
            />
          </label>

          <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600 ring-1 ring-slate-200">
            로그인 ID에는 이름, 전화번호, 주소 등 개인정보를 넣지 마세요.
            예: <span className="font-semibold text-slate-900">merchant001</span>,{" "}
            <span className="font-semibold text-slate-900">shop-a201</span>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "가입 신청 중..." : "가입 신청"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-600">
          이미 계정이 있나요?{" "}
          <Link to="/login" className="font-semibold text-slate-950 underline">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
