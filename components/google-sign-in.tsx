"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GoogleSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
      const redirectTo = `${configuredOrigin || window.location.origin}/auth/callback`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (authError) setError("Google sign-in could not be started. Please try again.");
    } catch (cause) {
      console.error("Google sign-in start failed", cause instanceof Error ? { name: cause.name } : undefined);
      setError("Google sign-in could not be started. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return <>
    <Button className="h-11 w-full" variant="outline" onClick={signIn} disabled={loading}>
      <span className="font-semibold text-info">G</span>{loading ? "Connecting…" : "Continue with Google"}
    </Button>
    {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
  </>;
}
