import { Navigate, Route, Routes } from "react-router-dom";
import { Loading } from "./components";
import { LanguageProvider } from "./i18n";
import { Forgot, Login, Register } from "./pages/AuthPages";
import { Dashboard } from "./pages/Dashboard";
import { Join } from "./pages/Join";
import { MemberHome } from "./pages/MemberHome";
import { Providers, useAuth } from "./state";

function Guard({ kind, children }) {
  const { session, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!session) return <Navigate to="/" replace />;
  if (session.kind !== kind) return <Navigate to={session.kind === "admin" ? "/app" : "/home"} replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/app" element={<Guard kind="admin"><Dashboard /></Guard>} />
      <Route path="/home" element={<Guard kind="member"><MemberHome /></Guard>} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="ac">
      <LanguageProvider>
        <Providers>
          <AppRoutes />
        </Providers>
      </LanguageProvider>
    </div>
  );
}
