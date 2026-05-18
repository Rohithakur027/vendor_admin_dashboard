"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const role = await login(email, password);
      if (role === "vendor" || role === "vendor_member") router.push("/dashboard");
      else if (role === "superadmin" || role === "superadmin_member") router.push("/superadmin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        html, body { height: 100%; overflow: hidden; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: #94a3b8; }
        input:focus { outline: none; }
        .login-input { width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; font-family: inherit; color: #0f172a; background: #f8fafc; transition: border-color 0.15s, background 0.15s; }
        .login-input:focus { border-color: #2563eb; background: #fff; }
        .login-btn { width: 100%; padding: 11px; border-radius: 10px; border: none; background: #2563eb; color: #fff; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.15s, opacity 0.15s; }
        .login-btn:hover:not(:disabled) { background: #1d4ed8; }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

      `}</style>

      {/* ── Left panel ── */}
      <div style={{
        flex: "0 0 48%", height: "100%",
        background: "linear-gradient(145deg, #1e40af 0%, #2563eb 45%, #3b82f6 100%)",
        display: "flex", flexDirection: "column", padding: "32px 48px", position: "relative", overflow: "hidden",
      }}>
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", top: "38%", right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, zIndex: 1 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 17h18M5 17V9a2 2 0 012-2h10a2 2 0 012 2v8M9 17v-4h6v4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="7.5" cy="17.5" r="1.5" fill="#fff"/>
              <circle cx="16.5" cy="17.5" r="1.5" fill="#fff"/>
            </svg>
          </div>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>SK Travels</span>
        </div>

        {/* Tagline */}
        <div style={{ marginTop: 28, zIndex: 1 }}>
          <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            One platform<br />for your entire<br />fleet.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 14.5, marginTop: 14, lineHeight: 1.6, maxWidth: 280 }}>
            Manage drivers, vendors, trips and vehicles — all from a single dashboard.
          </p>
        </div>

        {/* Illustration */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, marginTop: 20 }}>
          <svg viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 380 }}>
            {/* Dashboard card */}
            <rect x="60" y="40" width="260" height="190" rx="16" fill="white" fillOpacity="0.12"/>
            <rect x="60" y="40" width="260" height="190" rx="16" stroke="white" strokeOpacity="0.25" strokeWidth="1.5"/>

            {/* Dashboard header */}
            <rect x="76" y="56" width="80" height="7" rx="3.5" fill="white" fillOpacity="0.5"/>
            <rect x="76" y="68" width="48" height="5" rx="2.5" fill="white" fillOpacity="0.25"/>

            {/* Stat cards */}
            <rect x="76" y="86" width="66" height="44" rx="8" fill="white" fillOpacity="0.15"/>
            <rect x="152" y="86" width="66" height="44" rx="8" fill="white" fillOpacity="0.15"/>
            <rect x="228" y="86" width="76" height="44" rx="8" fill="white" fillOpacity="0.15"/>
            <rect x="80" y="92" width="28" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
            <rect x="80" y="102" width="40" height="8" rx="4" fill="white" fillOpacity="0.7"/>
            <rect x="80" y="115" width="20" height="4" rx="2" fill="#86efac" fillOpacity="0.8"/>
            <rect x="156" y="92" width="28" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
            <rect x="156" y="102" width="36" height="8" rx="4" fill="white" fillOpacity="0.7"/>
            <rect x="156" y="115" width="20" height="4" rx="2" fill="#86efac" fillOpacity="0.8"/>
            <rect x="232" y="92" width="28" height="5" rx="2.5" fill="white" fillOpacity="0.4"/>
            <rect x="232" y="102" width="44" height="8" rx="4" fill="white" fillOpacity="0.7"/>
            <rect x="232" y="115" width="20" height="4" rx="2" fill="#fcd34d" fillOpacity="0.8"/>

            {/* Chart area */}
            <rect x="76" y="140" width="228" height="74" rx="8" fill="white" fillOpacity="0.08"/>
            <rect x="84" y="148" width="40" height="5" rx="2.5" fill="white" fillOpacity="0.35"/>
            {/* Chart bars */}
            <rect x="90"  y="185" width="14" height="20" rx="3" fill="white" fillOpacity="0.35"/>
            <rect x="112" y="175" width="14" height="30" rx="3" fill="white" fillOpacity="0.5"/>
            <rect x="134" y="168" width="14" height="37" rx="3" fill="white" fillOpacity="0.65"/>
            <rect x="156" y="178" width="14" height="27" rx="3" fill="white" fillOpacity="0.5"/>
            <rect x="178" y="162" width="14" height="43" rx="3" fill="white" fillOpacity="0.8"/>
            <rect x="200" y="170" width="14" height="35" rx="3" fill="white" fillOpacity="0.55"/>
            <rect x="222" y="165" width="14" height="40" rx="3" fill="white" fillOpacity="0.7"/>
            <rect x="244" y="172" width="14" height="33" rx="3" fill="white" fillOpacity="0.5"/>
            {/* Chart line */}
            <polyline points="97,183 119,171 141,164 163,174 185,158 207,166 229,161 251,168" stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeOpacity="0.9"/>

            {/* Sedan Taxi — body */}
            <rect x="78" y="271" width="224" height="29" rx="8" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.3" strokeWidth="1.5"/>
            {/* Cabin (trapezoid roofline) */}
            <path d="M118,271 L140,248 L240,248 L262,271 Z" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.25" strokeWidth="1.5"/>
            {/* Front windshield */}
            <path d="M142,250 L124,269 L185,269 L185,250 Z" fill="white" fillOpacity="0.32"/>
            {/* Door window */}
            <rect x="187" y="250" width="26" height="19" rx="2" fill="white" fillOpacity="0.32"/>
            {/* Rear windshield */}
            <path d="M238,250 L259,269 L215,269 L215,250 Z" fill="white" fillOpacity="0.25"/>
            {/* Front wheel */}
            <circle cx="118" cy="300" r="9" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
            <circle cx="118" cy="300" r="3.5" fill="white" fillOpacity="0.5"/>
            {/* Rear wheel */}
            <circle cx="240" cy="300" r="9" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
            <circle cx="240" cy="300" r="3.5" fill="white" fillOpacity="0.5"/>
            {/* Taxi light on roof */}
            <rect x="162" y="240" width="36" height="9" rx="3" fill="white" fillOpacity="0.75"/>
            <rect x="166" y="241" width="28" height="7" rx="2" fill="#fcd34d" fillOpacity="0.9"/>

            {/* Person / driver */}
            <circle cx="334" cy="198" r="18" fill="white" fillOpacity="0.18"/>
            <circle cx="334" cy="192" r="9" fill="white" fillOpacity="0.55"/>
            <path d="M318 224c0-10 7-16 16-16s16 6 16 16" fill="white" fillOpacity="0.35"/>

            {/* Floating badge — trips */}
            <rect x="18" y="140" width="76" height="38" rx="10" fill="white" fillOpacity="0.9"/>
            <rect x="26" y="148" width="28" height="5" rx="2.5" fill="#2563eb" fillOpacity="0.5"/>
            <rect x="26" y="157" width="44" height="7" rx="3.5" fill="#1e40af"/>

            {/* Floating badge — live */}
            <rect x="318" y="94" width="68" height="38" rx="10" fill="white" fillOpacity="0.9"/>
            <circle cx="330" cy="113" r="4" fill="#22c55e"/>
            <rect x="340" y="108" width="36" height="5" rx="2.5" fill="#0f172a" fillOpacity="0.5"/>
            <rect x="340" y="117" width="28" height="5" rx="2.5" fill="#0f172a" fillOpacity="0.3"/>
          </svg>
        </div>

        {/* Bottom tagline dots */}
        <div style={{ display: "flex", gap: 6, zIndex: 1 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ width: i === 1 ? 20 : 6, height: 6, borderRadius: 3, background: i === 1 ? "#fff" : "rgba(255,255,255,0.35)" }} />
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", padding: "24px 48px", overflow: "hidden" }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          {/* Heading */}
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Sign in</h2>
          <p style={{ fontSize: 13.5, color: "#94a3b8", marginTop: 5 }}>Welcome back. Enter your credentials below.</p>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Email address</label>
              <input
                className="login-input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff style={{ width: 16, height: 16 }} />
                    : <Eye    style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 9, padding: "10px 12px" }}>
                <AlertCircle style={{ width: 15, height: 15, color: "#ef4444", marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#dc2626" }}>{error}</span>
              </div>
            )}

            <button type="submit" className="login-btn" disabled={loading} style={{ marginTop: 6 }}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Vendor sign-up prompt */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #f1f5f9", textAlign: "center" as const }}>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>
              New vendor on the platform?{" "}
              <a
                href="/signup"
                style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
              >
                Sign up here
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
