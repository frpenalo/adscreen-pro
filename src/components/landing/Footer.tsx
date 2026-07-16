import { useLang } from "@/contexts/LangContext";
import { Link } from "react-router-dom";
import { Globe } from "lucide-react";

const Footer = () => {
  const { lang, setLang, t } = useLang();

  return (
    <footer className="border-t border-border py-10">
      <div className="container flex flex-col items-center justify-between gap-5 md:flex-row">
        <div className="flex flex-col items-center gap-1 md:items-start">
          <span className="text-lg font-bold text-foreground">AdScreenPro</span>
          <span className="text-xs text-muted-foreground">Pantallas en barberías y salones de Raleigh, NC</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link to="/raleigh-local-ads" className="hover:text-foreground transition-colors">Anunciarme</Link>
          <Link to="/register?role=partner" className="hover:text-foreground transition-colors">{t.nav.partnerRegister}</Link>
          <Link to="/login" className="hover:text-foreground transition-colors">{t.nav.login}</Link>
          <button
            onClick={() => setLang(lang === "es" ? "en" : "es")}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Globe className="h-4 w-4" />
            {t.footer.language}
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground md:text-right">
          © 2026 SOFTMEDIA LLC DBA AdScreenPro.<br className="md:hidden" /> {t.footer.rights}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
