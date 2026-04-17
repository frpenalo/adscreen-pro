import { useLang } from "@/contexts/LangContext";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Eye, EyeOff } from "lucide-react";

const categories = [
  "Automotriz", "Balloon Artist", "Belleza", "Educación",
  "Entretenimiento", "Restaurante", "Retail", "Salud",
  "Servicios", "Tecnología", "Tienda de Ropa", "Otro",
];

const inputClass = "w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

const Register = () => {
  const { t } = useLang();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const role = (params.get("role") as "advertiser" | "partner") || "advertiser";
  const refCode = params.get("ref") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [phone, setPhone] = useState("");
  const [partnerBusiness, setPartnerBusiness] = useState("");
  const [address, setAddress] = useState("");
  const [addressLat, setAddressLat] = useState<number | undefined>();
  const [addressLng, setAddressLng] = useState<number | undefined>();
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const metadata: Record<string, string> = { role };
      if (role === "advertiser") {
        metadata.customer_name = customerName;
        metadata.business_name = businessName;
        metadata.category = category === "Otro" && customCategory.trim()
          ? customCategory.trim().charAt(0).toUpperCase() + customCategory.trim().slice(1).toLowerCase()
          : category;
        metadata.phone = phone;
        if (refCode) metadata.ref_code = refCode;
      }
      if (role === "partner") {
        metadata.business_name = partnerBusiness;
        metadata.address = address;
        if (addressLat) metadata.lat = String(addressLat);
        if (addressLng) metadata.lng = String(addressLng);
        metadata.contact_name = contactName;
        metadata.contact_email = email;
        metadata.contact_phone = contactPhone;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Cuenta creada. Iniciando sesión...");
        // Auto sign-in after signup
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          toast.error(signInErr.message);
        } else {
          navigate("/auth/redirect");
        }
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const title = role === "advertiser"
    ? t.auth.registerAdvertiser
    : t.auth.registerPartner;

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block text-2xl font-bold text-foreground">AdScreenPro</Link>
          <h1 className="mt-4 text-2xl font-bold text-foreground">{title}</h1>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-8 space-y-4 shadow-sm">
          {role === "advertiser" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.name}</label>
                <input required className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.businessName}</label>
                <input required className={inputClass} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.category}</label>
                <select required className={inputClass} value={category} onChange={(e) => { setCategory(e.target.value); setCustomCategory(""); }}>
                  <option value="">{t.auth.selectCategory}</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {category === "Otro" && (
                  <input
                    required
                    className={`${inputClass} mt-2`}
                    placeholder="Escribe tu categoría..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.phone}</label>
                <input required className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </>
          )}
          {role === "partner" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.businessName}</label>
                <input required className={inputClass} value={partnerBusiness} onChange={(e) => setPartnerBusiness(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.address}</label>
                <AddressAutocomplete
                  value={address}
                  onChange={(val, lat, lng) => { setAddress(val); setAddressLat(lat); setAddressLng(lng); }}
                  placeholder="Ej: 123 Main St, Raleigh, NC"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.contactName}</label>
                <input required className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.contactPhone}</label>
                <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.email}</label>
            <input required type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t.auth.password}</label>
            <div className="relative">
              <input required type={showPassword ? "text" : "password"} minLength={6} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {loading ? "..." : t.auth.register}
          </button>
          <div className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="hover:text-foreground transition-colors">{t.auth.backToLogin}</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
