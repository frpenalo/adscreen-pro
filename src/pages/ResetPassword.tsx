import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/contexts/LangContext";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const inputClass = "w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * /reset-password
 *
 * Supabase redirige aquí con el token de recuperación en el hash de la URL
 * (#access_token=...&type=recovery). El SDK lo detecta automáticamente vía
 * onAuthStateChange con evento PASSWORD_RECOVERY.
 */
const ResetPassword = () => {
  const { t } = useLang();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Escuchar el evento PASSWORD_RECOVERY que Supabase dispara al cargar
    // esta página con un hash de recuperación válido.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t.auth.passwordMismatch);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t.auth.passwordUpdated);
        await supabase.auth.signOut();
        navigate("/login");
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block text-2xl font-bold text-foreground">AdScreenPro</Link>
          <h1 className="mt-4 text-2xl font-bold text-foreground">{t.auth.forgotPassword}</h1>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {!ready ? (
            <div className="flex justify-center py-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground">{t.auth.newPassword}</label>
                </div>
                <div className="relative">
                  <input
                    required
                    minLength={6}
                    type={showPassword ? "text" : "password"}
                    className={inputClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.confirmPassword}</label>
                <input
                  required
                  minLength={6}
                  type={showPassword ? "text" : "password"}
                  className={inputClass}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "..." : t.auth.savePassword}
              </button>
            </form>
          )}
        </div>

        <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          {t.auth.backToLogin}
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;
