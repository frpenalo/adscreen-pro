import { useLang } from "@/contexts/LangContext";
import { Link } from "react-router-dom";

const Navbar = () => {
  const { t } = useLang();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="text-xl font-bold text-foreground">
          AdScreenPro
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          <button onClick={() => scrollTo("prueba-local")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pantallas</button>
          <button onClick={() => scrollTo("how-it-works")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.nav.howItWorks}</button>
          <button onClick={() => scrollTo("pricing")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.nav.pricing}</button>
          <button onClick={() => scrollTo("faq")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</button>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-block">
            {t.nav.login}
          </Link>
          <Link
            to="/register?role=advertiser"
            data-track="cta-nav"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Anunciarme
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
