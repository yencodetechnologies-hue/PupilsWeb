import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);
const ToastContext = createContext(() => {});

export function useAuth() {
  return useContext(AuthContext);
}

export function useToast() {
  return useContext(ToastContext);
}

export function Providers({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const timer = useRef();

  useEffect(() => {
    api("/api/auth/me")
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setReady(true));
  }, []);

  const toast = (message) => {
    setToastMsg(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(""), 3200);
  };

  const updateInstitution = (institution) => {
    setSession((current) => (current?.kind === "admin" ? { ...current, institution } : current));
  };

  const updateMember = (member) => {
    setSession((current) => (current?.kind === "member" ? { ...current, member } : current));
  };

  return (
    <AuthContext.Provider value={{ session, setSession, ready, updateInstitution, updateMember }}>
      <ToastContext.Provider value={toast}>
        {children}
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
