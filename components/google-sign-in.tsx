"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (authError) setError(authError.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start Google sign-in.");
    } finally {
      setLoading(false);
    }
  }
  return <>
    <button className="google-button" onClick={signIn} disabled={loading}>
      <span className="google-g">G</span>{loading ? "Connecting…" : "Continue with Google"}
    </button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </>;
}
