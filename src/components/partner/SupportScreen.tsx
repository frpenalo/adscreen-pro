import { useLang } from "@/contexts/LangContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle, Mail } from "lucide-react";

const SupportScreen = () => {
  const { t } = useLang();
  const tP = t.partnerDashboard;

  const faqs = [
    { q: tP.faq1q, a: tP.faq1a },
    { q: tP.faq2q, a: tP.faq2a },
    { q: tP.faq3q, a: tP.faq3a },
    { q: tP.faq4q, a: tP.faq4a },
  ];

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-5 w-5" /> {tP.faqTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-sm text-left">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Mail className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">{tP.contactEmail}</p>
            <p className="text-sm font-medium text-foreground">soporte@adscreenpro.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportScreen;
