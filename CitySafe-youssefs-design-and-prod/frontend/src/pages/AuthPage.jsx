import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Shield, Mail, Lock, User, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [form, setForm] = useState({
    userId: "",
    displayName: "",
    password: "",
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "signup" && !agreed) {
      setError("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.userId.trim(), form.password);
      } else {
        await register(form.userId.trim(), form.password, form.displayName.trim() || form.userId.trim());
      }
      toast.success(mode === "login" ? "Welcome back! 👋" : "Account created successfully! 🎉");
      navigate("/");
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-teal-500/20 border border-teal-500/30 mb-4">
            <Shield className="h-8 w-8 text-teal-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">CitySafe</h1>
          <p className="text-slate-400 text-sm mt-1">Community safety, together</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Tab toggle */}
          <div className="flex bg-white/5 rounded-2xl p-1 mb-6">
            {["login", "signup"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={[
                  "flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200",
                  mode === m
                    ? "bg-teal-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-300",
                ].join(" ")}
              >
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name – signup only */}
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    value={form.displayName}
                    onChange={set("displayName")}
                    placeholder="Your name (optional)"
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                  />
                </div>
              </div>
            )}

            {/* User ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {mode === "login" ? "User ID" : "Choose a User ID"}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  required
                  value={form.userId}
                  onChange={set("userId")}
                  placeholder="e.g. john_doe"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  required
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder={mode === "signup" ? "Min 6 chars, letters + numbers" : "Enter your password"}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl pl-10 pr-11 py-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <p className="text-xs text-slate-500">Must contain at least one letter and one number.</p>
              )}
            </div>

            {/* Terms checkbox – signup only */}
            {mode === "signup" && (
              <div className="flex items-start gap-3 pt-1">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="sr-only"
                  />
                  <button
                    type="button"
                    onClick={() => setAgreed((v) => !v)}
                    className={[
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                      agreed
                        ? "bg-teal-500 border-teal-500"
                        : "bg-white/5 border-white/20 hover:border-teal-500/50",
                    ].join(" ")}
                  >
                    {agreed && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </button>
                </div>
                <label
                  htmlFor="terms"
                  className="text-sm text-slate-400 leading-snug cursor-pointer"
                  onClick={() => setAgreed((v) => !v)}
                >
                  I agree to the{" "}
                  <Link
                    to="/terms"
                    target="_blank"
                    className="text-teal-400 hover:text-teal-300 underline underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy"
                    target="_blank"
                    className="text-teal-400 hover:text-teal-300 underline underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {!loading && (mode === "login" ? "Sign In" : "Create Account")}
              {loading && (mode === "login" ? "Signing in…" : "Creating account…")}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          &copy; {new Date().getFullYear()} CitySafe. Keeping communities safer.
        </p>
      </div>
    </div>
  );
}
