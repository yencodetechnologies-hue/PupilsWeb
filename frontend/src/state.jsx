import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Icon } from "./components";

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
  const [toastMsg, setToastMsg] = useState(null);
  const timer = useRef();

  useEffect(() => {
    api("/api/auth/me")
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setReady(true));
  }, []);

  const toast = (message, kind = "ok") => {
    setToastMsg({ message, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), 3200);
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
        {toastMsg && (
          <div className={toastMsg.kind === "err" ? "toast toast-err" : "toast"} role={toastMsg.kind === "err" ? "alert" : "status"}>
            {toastMsg.kind === "err" && <Icon name="alert" size={18} />}
            <span>{toastMsg.message}</span>
          </div>
        )}
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
