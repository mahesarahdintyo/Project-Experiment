"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/");
      }
    };
    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg("");
    setInfoMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setBusy(false);
    if (error) {
      setErrorMsg("Login gagal: " + error.message);
      return;
    }

    router.push("/");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg("");
    setInfoMsg("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    setBusy(false);
    if (error) {
      setErrorMsg("Pendaftaran gagal: " + error.message);
      return;
    }

    setInfoMsg("Pendaftaran berhasil. Cek email untuk verifikasi (jika diaktifkan), lalu login.");
    setMode("login");
  };

  return (
    <div className="login-shell flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <div className="login-card w-full max-w-md panel bg-[var(--panel)] border border-[var(--border)] rounded-lg p-8 shadow-xl text-[var(--text)]">
        <h1 className="text-2xl font-bold font-display text-center mb-1">
          Sistem Produksi <span style={{ color: "var(--amber)" }}>&amp;</span> Downtime
        </h1>
        <p className="sub text-xs text-center text-[var(--muted)] mb-6">
          Login untuk mencatat data produksi &amp; downtime mesin.
        </p>

        {errorMsg && (
          <div className="error-msg bg-red-500/10 border border-red-500/30 text-red-500 text-sm p-3 rounded mb-4">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="success-msg bg-green-500/10 border border-green-500/30 text-green-500 text-sm p-3 rounded mb-4">
            {infoMsg}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full py-2.5 font-semibold text-center"
              disabled={busy}
            >
              {busy ? "Memproses…" : "Masuk"}
            </button>
            <p className="hint text-center text-xs mt-4">
              Belum punya akun?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-[var(--amber)] hover:underline font-semibold"
              >
                Daftar di sini
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="field">
              <label>Nama Lengkap</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <p className="hint text-xs text-[var(--muted)] mt-1">Minimal 6 karakter.</p>
            </div>
            <button
              type="submit"
              className="btn-primary w-full py-2.5 font-semibold text-center"
              disabled={busy}
            >
              {busy ? "Memproses…" : "Daftar"}
            </button>
            <p className="hint text-center text-xs mt-4">
              Sudah punya akun?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-[var(--amber)] hover:underline font-semibold"
              >
                Masuk di sini
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
