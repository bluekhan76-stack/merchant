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


  if (Array.isArray(allowedRoles) && !allowedRoles.includes(session.role)) {
    const fallback = session.role === ROLES.ADMIN ? "/admin" : "/merchant";
    return <Navigate to={fallback} replace />;
  }

  return children;
}

function HomeRedirect() {
  const session = getSession();
  const searchCode = new URLSearchParams(window.location.search).get("code");

  if (searchCode) return <OpenBridgePage />;
  if (!session?.isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={session.role === ROLES.ADMIN ? "/admin" : "/merchant"} replace />;
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
        <Route path="/" element={<HomeRedirect />} />
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
