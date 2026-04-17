import { useLang } from "@/contexts/LangContext";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

const CheckEmail = () => {
  const { t } = useLang();

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <Link to="/" className="inline-block text-2xl font-bold text-foreground">AdScreenPro</Link>
        <div className="rounded-2xl border border-border bg-card p-10 space-y-4 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t.auth.checkEmail}</h1>
          <p className="text-muted-foreground">{t.auth.checkEmailDesc}</p>
        </div>
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          {t.auth.backToLogin}
        </Link>
      </div>
    </div>
  );
};

export default CheckEmail;
