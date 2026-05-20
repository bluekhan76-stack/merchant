import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import OpenBridgePage from "./OpenBridgePage.jsx";
import { getSession, ROLES } from "./auth/auth.js";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MerchantDashboard from "./pages/MerchantDashboard.jsx";
import SignupPage from "./pages/SignupPage.jsx";

function RequireAuth({ allowedRoles, children }) {
  const location = useLocation();
  const session = getSession();

  if (!session?.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // 승인 대기 상태여도 /pending 으로 보내지 않습니다.
  // QR/주차권 발행 제한은 MerchantDashboard에서 status/isActive 기준으로 처리합니다.
  if (Array.isArray(allowedRoles) && !allowedRoles.includes(session.role)) {
    const fallback = session.role === ROLES.ADMIN ? "/admin" : "/merchant";
    return <Navigate to={fallback} replace />;
  }

  return children;
}

function RootPage() {
  const searchCode = new URLSearchParams(window.location.search).get("code");

  if (searchCode) {
    return <OpenBridgePage />;
  }

  // 기존에는 로그인 세션이 있으면 자동으로 /merchant 또는 /admin 으로 이동했습니다.
  // 이 자동 이동 때문에 빈 화면/리다이렉트 충돌이 발생할 수 있어 루트는 항상 로그인 화면으로 둡니다.
  return <LoginPage />;
}

function AuthSync() {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const onStorage = () => setVersion((value) => value + 1);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthSync />
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/open" element={<OpenBridgePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/merchant"
          element={
            <RequireAuth allowedRoles={[ROLES.MERCHANT]}>
              <MerchantDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth allowedRoles={[ROLES.ADMIN]}>
              <AdminDashboard />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
