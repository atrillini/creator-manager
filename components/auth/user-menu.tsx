"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Loader2, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  email?: string | null;
};

export function UserMenu({ email: emailProp }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(emailProp ?? null);
  const [busy, setBusy] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [envEnabled, setEnvEnabled] = useState(true);
  const initials = useMemo(() => {
    const raw = (email ?? "Utente").split("@")[0] || "U";
    return raw.slice(0, 2).toUpperCase();
  }, [email]);

  useEffect(() => {
    void (async () => {
      const meRes = await fetch("/api/auth/me");
      const meData = (await meRes.json()) as {
        ok: boolean;
        email?: string | null;
      };
      if (meData.ok) {
        setEmail(meData.email ?? null);
      }

      const res = await fetch("/api/auth/signup-settings");
      const data = (await res.json()) as {
        ok: boolean;
        uiEnabled?: boolean;
        envEnabled?: boolean;
      };
      if (data.ok) {
        setSignupEnabled(data.uiEnabled !== false);
        setEnvEnabled(data.envEnabled !== false);
      }
    })();
  }, []);

  const onToggleSignup = async (next: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) setSignupEnabled(next);
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!email) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 rounded-full border-gray-200 bg-white/85 text-xs font-semibold text-gray-700"
        >
          {initials}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 border-white/60 bg-white/80 backdrop-blur-md">
        <p className="text-sm font-semibold text-gray-900">{email}</p>
        <div className="mt-3 rounded-xl border border-gray-200/80 bg-white/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-700">Registrazione aperta</p>
              <p className="text-[11px] text-gray-500">
                {envEnabled ? "Controllata da switch UI" : "Bloccata da AUTH_ALLOW_SIGNUP=false"}
              </p>
            </div>
            <Switch
              checked={signupEnabled}
              onCheckedChange={onToggleSignup}
              disabled={busy || !envEnabled}
              aria-label="Abilita registrazione"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full justify-start text-gray-700 hover:bg-white/80"
          onClick={onLogout}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Logout
        </Button>
      </PopoverContent>
    </Popover>
  );
}
