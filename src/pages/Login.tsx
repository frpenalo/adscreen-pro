import { useLang } from "@/contexts/LangContext";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Megaphone, Store, Eye, EyeOff } from "lucide-react";

const inputClass = "w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

const Login = () => {
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        navigate("/auth/redirect");
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast.error(error.message);
      else setForgotSent(true);
    } catch {
      toast.error("Error inesperado");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block text-2xl font-bold text-foreground">AdScreenPro</Link>
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            {forgotMode ? t.auth.forgotPassword : t.auth.login}
          </h1>
        </div>

        {forgotMode ? (
          <div className="rounded-2xl border border-border bg-card p-8 space-y-4 shadow-sm">
            {forgotSent ? (
              <p className="text-center text-sm text-muted-foreground">{t.auth.resetLinkSent}</p>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.email}</label>
                  <input required type="email" className={inputClass} value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                </div>
                <button type="submit" disabled={forgotLoading} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                  {forgotLoading ? "..." : t.auth.sendResetLink}
                </button>
              </form>
            )}
            <button type="button" onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(""); }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t.auth.backToLogin}
            </button>
          </div>
        ) : (
        <form onSubmit={handleLogin} className="rounded-2xl border border-border bg-card p-8 space-y-4 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.email}</label>
            <input required type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-foreground">{t.auth.password}</label>
              <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(email); }} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                {t.auth.forgotPassword}
              </button>
            </div>
            <div className="relative">
              <input required type={showPassword ? "text" : "password"} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {loading ? "..." : t.auth.login}
          </button>
        </form>
        )}

        {!forgotMode && <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">¿No tienes cuenta?</p>
          <div className="grid gap-3">
            <Link
              to="/register?role=advertiser"
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-lg hover:border-primary/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Megaphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-foreground">{t.auth.registerAdvertiser}</div>
                <div className="text-xs text-muted-foreground">{t.auth.advertiserDesc}</div>
              </div>
            </Link>
            <Link
              to="/register?role=partner"
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-lg hover:border-primary/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-foreground">{t.auth.registerPartner}</div>
                <div className="text-xs text-muted-foreground">{t.auth.partnerDesc}</div>
              </div>
            </Link>
          </div>
        </div>}

      </div>
    </div>
  );
};

export default Login;
