"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/signup-settings");
      const data = (await res.json()) as {
        ok: boolean;
        effectiveEnabled?: boolean;
      };
      if (data.ok) {
        setSignupEnabled(data.effectiveEnabled !== false);
      }
    })();
  }, []);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Operazione non riuscita");
        return;
      }
      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next") || "/dashboard"
          : "/dashboard";
      router.replace(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#F5F5F7] p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-8">
        <p className="text-xl font-semibold tracking-tight text-gray-900">CreatorCRM</p>
        <p className="mt-1 text-sm text-gray-500">
          Accesso privato all&apos;area gestionale.
        </p>

        <div className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="nome@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="rounded-xl border-gray-200 focus-visible:ring-2 focus-visible:ring-blue-500/25"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="rounded-xl border-gray-200 focus-visible:ring-2 focus-visible:ring-blue-500/25"
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex gap-2">
          <Button
            type="button"
            className="flex-1 rounded-full"
            onClick={onSubmit}
            disabled={loading || !email || !password}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : mode === "login" ? "Login" : "Registrati"}
          </Button>
          {signupEnabled ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-gray-200"
              onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
              disabled={loading}
            >
              {mode === "login" ? "Registrazione" : "Ho già un account"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
