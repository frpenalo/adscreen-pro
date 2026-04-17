import { useLang } from "@/contexts/LangContext";
import { useState } from "react";

const ContactSection = () => {
  const { t } = useLang();
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  return (
    <section id="contact" className="bg-secondary/40 py-12 md:py-16">
      <div className="container">
        <div className="mx-auto max-w-lg">
          <h2 className="text-center text-3xl font-bold text-foreground md:text-4xl">{t.contact.title}</h2>
          <form className="mt-10 space-y-4" onSubmit={(e) => {
            e.preventDefault();
            const msg = `Hola AdScreenPro! 👋\n\n*Nombre:* ${form.name}\n*Email:* ${form.email}\n\n*Mensaje:*\n${form.message}`;
            window.open(`https://wa.me/19739319718?text=${encodeURIComponent(msg)}`, "_blank");
          }}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t.contact.name}</label>
              <input
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t.contact.namePlaceholder}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t.contact.email}</label>
              <input
                type="email"
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t.contact.emailPlaceholder}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t.contact.message}</label>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={t.contact.messagePlaceholder}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t.contact.send}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
