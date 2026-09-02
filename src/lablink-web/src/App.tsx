import { useState } from "react";
import Login from "./pages/Login";
import Shell from "./pages/Shell";
import type { Session } from "./auth/session";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) return <Login onLogin={setSession} />;
  return <Shell session={session} onLogout={() => setSession(null)} />;
}
