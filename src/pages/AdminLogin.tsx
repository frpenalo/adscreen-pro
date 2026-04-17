import { useLang } from "@/contexts/LangContext";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const inputClass = "w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

const AdminLogin = () => {
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else navigate("/dashboard/admin");
    } catch {
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block text-2xl font-bold text-foreground">AdScreenPro</Link>
          <h1 className="mt-4 text-2xl font-bold text-foreground">{t.auth.adminLogin}</h1>
        </div>
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-8 space-y-4 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.email}</label>
            <input required type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.password}</label>
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
          <div className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="hover:text-foreground transition-colors">{t.auth.backToLogin}</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
