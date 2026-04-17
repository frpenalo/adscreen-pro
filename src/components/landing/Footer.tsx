import { useLang } from "@/contexts/LangContext";
import { Link } from "react-router-dom";
import { Globe } from "lucide-react";

const Footer = () => {
  const { lang, setLang, t } = useLang();

  return (
    <footer className="border-t border-border py-8">
      <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
        <span className="text-lg font-bold text-foreground">AdScreenPro</span>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link to="/login" className="hover:text-foreground transition-colors">{t.nav.login}</Link>
          <Link to="/register?role=partner" className="hover:text-foreground transition-colors">{t.nav.partnerRegister}</Link>
          <button
            onClick={() => setLang(lang === "es" ? "en" : "es")}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Globe className="h-4 w-4" />
            {t.footer.language}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 AdScreenPro. {t.footer.rights}</p>
      </div>
    </footer>
  );
};

export default Footer;
