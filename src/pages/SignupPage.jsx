import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function SignupPage() {
  const navigate = useNavigate();

  const [buildingName, setBuildingName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const normalizeUsername = (value) =>
    value
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 32);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    const cleanBuildingName = buildingName.trim();
    const cleanRoomNumber = roomNumber.trim();
    const cleanUsername = username.trim();

    if (!cleanBuildingName) {
      setError("상가(건물)명을 입력해 주세요.");
      return;
    }

    if (!cleanRoomNumber) {
      setError("호실을 입력해 주세요.");
      return;
    }

    if (cleanUsername.length < 4) {
      setError("로그인 ID는 4자 이상 입력해 주세요.");
      return;
    }

    if (password.length < 8) {
      setError("비밀번호는 8자 이상 입력해 주세요.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    const signupRequest = {
      buildingName: cleanBuildingName,
      roomNumber: cleanRoomNumber,
      username: cleanUsername,
      password,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    // 현재는 AWS API 연동 전 임시 저장입니다.
    // 실제 운영에서는 password를 localStorage/DynamoDB에 저장하지 말고 Cognito에만 전달해야 합니다.
    localStorage.setItem("parking_web_signup_request", JSON.stringify(signupRequest));

    navigate("/pending", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold">상가 회원가입 신청</h1>
        <p className="mt-2 text-sm text-slate-600">
          운영자 승인 완료 후 주차권 발행 기능을 사용할 수 있습니다.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            상가(건물)명
            <input
              value={buildingName}
              onChange={(event) => setBuildingName(event.target.value)}
              className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="예: 블루칸타워"
              autoComplete="organization"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            호실
            <input
              value={roomNumber}
              onChange={(event) => setRoomNumber(event.target.value)}
              className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="예: 201호"
              autoComplete="off"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            로그인 아이디
            <input
              value={username}
              onChange={(event) => setUsername(normalizeUsername(event.target.value))}
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
            비밀번호 확인
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1 w-full rounded-2xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="비밀번호 재입력"
              autoComplete="new-password"
              required
            />
          </label>

          <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600 ring-1 ring-slate-200">
            현재는 AWS API 연동 전이므로 가입 신청 정보가 브라우저에 임시 저장됩니다.
            실제 운영에서는 비밀번호를 DB에 저장하지 않고 Cognito에만 전달합니다.
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">
              {error}
            </div>
          )}

          <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white">
            가입 신청
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-600">
          이미 계정이 있나요? <Link to="/login" className="font-semibold text-slate-950 underline">로그인</Link>
        </div>
      </div>
    </div>
  );
}
