import React, { useEffect, useMemo, useRef, useState } from "react";

const ANDROID_PACKAGE = "com.bluekhan.bleflutter";
const IOS_APP_STORE_URL = "https://apps.apple.com/app/id1234567890";
const ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

function detectPlatform() {
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  return { isAndroid, isIOS };
}

function buildCustomSchemeUrl(code) {
  return `bluekhan://invite?code=${encodeURIComponent(code)}`;
}

function buildAndroidIntentUrl(code) {
  return `intent://invite?code=${encodeURIComponent(
    code
  )}#Intent;scheme=bluekhan;package=${ANDROID_PACKAGE};end`;
}

export default function OpenBridgePage() {
  const code = useMemo(() => getQueryParam("code"), []);
  const { isAndroid, isIOS } = useMemo(() => detectPlatform(), []);
  const [status, setStatus] = useState("앱을 여는 중입니다...");
  const [showFallback, setShowFallback] = useState(false);
  const openedRef = useRef(false);

  const appUrl = useMemo(() => buildCustomSchemeUrl(code), [code]);
  const androidIntentUrl = useMemo(() => buildAndroidIntentUrl(code), [code]);

  const storeUrl = useMemo(() => {
    if (isIOS) return IOS_APP_STORE_URL;
    return ANDROID_STORE_URL;
  }, [isIOS]);

  useEffect(() => {
    if (!code) {
      setStatus("유효하지 않은 접근입니다. 초대 코드가 없습니다.");
      setShowFallback(false);
      return;
    }

    let fallbackTimer;
    let visibilityTimer;

    const onVisibilityChange = () => {
      if (document.hidden) {
        openedRef.current = true;
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const tryOpenApp = () => {
      setStatus("앱을 여는 중입니다...");

      if (isAndroid) {
        window.location.href = androidIntentUrl;

        setTimeout(() => {
          if (!openedRef.current) {
            window.location.href = appUrl;
          }
        }, 400);
      } else {
        window.location.href = appUrl;
      }

      fallbackTimer = setTimeout(() => {
        if (!openedRef.current && !document.hidden) {
          setStatus("앱이 설치되어 있지 않거나 실행에 실패했습니다.");
          setShowFallback(true);
        }
      }, 1800);

      visibilityTimer = setTimeout(() => {
        if (!openedRef.current && !document.hidden) {
          setShowFallback(true);
        }
      }, 2200);
    };

    tryOpenApp();

    return () => {
      clearTimeout(fallbackTimer);
      clearTimeout(visibilityTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [code, isAndroid, appUrl, androidIntentUrl]);

  const handleOpenAppAgain = () => {
    openedRef.current = false;
    setShowFallback(false);
    setStatus("앱을 다시 여는 중입니다...");

    if (isAndroid) {
      window.location.href = androidIntentUrl;
      setTimeout(() => {
        window.location.href = appUrl;
      }, 400);
    } else {
      window.location.href = appUrl;
    }

    setTimeout(() => {
      if (!document.hidden) {
        setShowFallback(true);
        setStatus("앱을 실행하지 못했습니다.");
      }
    }, 1800);
  };

  const handleGoStore = () => {
    window.location.href = storeUrl;
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>주차권 앱 연결</h1>
        <p style={styles.desc}>{status}</p>

        {code ? (
          <div style={styles.codeBox}>
            <span style={styles.label}>초대 코드</span>
            <strong style={styles.code}>{code}</strong>
          </div>
        ) : null}

        {showFallback ? (
          <div style={styles.actions}>
            <button style={styles.primaryBtn} onClick={handleGoStore}>
              앱 설치하기
            </button>
            <button style={styles.secondaryBtn} onClick={handleOpenAppAgain}>
              앱 다시 열기
            </button>
          </div>
        ) : (
          <div style={styles.loadingBox}>
            <div style={styles.spinner} />
          </div>
        )}

        <p style={styles.help}>
          설치 후 앱이 자동으로 열리지 않으면, 앱을 실행한 뒤 QR을 다시 스캔해 주세요.
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "#f5f7fb",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    textAlign: "center",
    boxSizing: "border-box",
  },
  title: {
    margin: "0 0 12px",
    fontSize: 24,
  },
  desc: {
    margin: "0 0 16px",
    fontSize: 15,
    color: "#444",
    lineHeight: 1.5,
  },
  codeBox: {
    background: "#f3f6fb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
  },
  code: {
    fontSize: 18,
    letterSpacing: 1,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    height: 46,
    border: 0,
    borderRadius: 10,
    background: "#1f6feb",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 10,
    border: "1px solid #c9d4e5",
    background: "#fff",
    color: "#223",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  help: {
    marginTop: 16,
    fontSize: 12,
    color: "#667",
    lineHeight: 1.5,
  },
  loadingBox: {
    display: "flex",
    justifyContent: "center",
    padding: "16px 0 8px",
  },
  spinner: {
    width: 28,
    height: 28,
    border: "3px solid #d9e2f1",
    borderTop: "3px solid #1f6feb",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};
