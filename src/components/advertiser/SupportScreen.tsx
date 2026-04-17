import { useLang } from "@/contexts/LangContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle, Mail } from "lucide-react";

const SupportScreen = () => {
  const { t } = useLang();
  const tAd = t.advertiserDashboard;

  const faqs = [
    { q: tAd.faq1q, a: tAd.faq1a },
    { q: tAd.faq2q, a: tAd.faq2a },
    { q: tAd.faq3q, a: tAd.faq3a },
    { q: tAd.faq4q, a: tAd.faq4a },
    { q: tAd.faq5q, a: tAd.faq5a },
  ];

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-5 w-5" /> {tAd.faqTitle}
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
            <p className="text-xs text-muted-foreground">{tAd.contactEmail}</p>
            <p className="text-sm font-medium text-foreground">soporte@adscreenpro.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportScreen;
