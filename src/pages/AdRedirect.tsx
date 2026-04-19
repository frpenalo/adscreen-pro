import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * /r/:adId/:screenId
 *
 * Public redirect route that logs the QR scan into ad_clicks then forwards
 * the user to the correct destination:
 *   - Product ads  → https://regalove.co/products/{handle}?ref={ref_code}
 *                    (GoAffPro credits the partner owning the screen)
 *   - Other ads    → advertiser's website_url
 */
export default function AdRedirect() {
  const { adId, screenId } = useParams<{ adId: string; screenId: string }>();

  useEffect(() => {
    if (!adId || !screenId) return;

    const run = async () => {
      // 1. Log the click (await so it completes before we navigate away)
      await supabase.from("ad_clicks").insert({
        ad_id: adId,
        screen_id: screenId,
      });

      // 2. Load ad (includes product metadata and advertiser website)
      const { data: ad } = await supabase
        .from("ads")
        .select("advertiser_id, metadata, advertisers(website_url)")
        .eq("id", adId)
        .single();

      const metadata = (ad?.metadata ?? {}) as {
        product_id?: string;
        shopify_handle?: string;
        ref_code?: string;
      };

      // 3a. Product ad → Regalove with affiliate ref
      if (metadata.shopify_handle) {
        const handle = metadata.shopify_handle;
        let refCode = metadata.ref_code;

        // Fallback: resolve ref from partner if ad row doesn't carry it
        if (!refCode) {
          const { data: partner } = await supabase
            .from("partners")
            .select("goaffpro_referral_link")
            .eq("id", screenId)
            .single();
          try {
            const link = partner?.goaffpro_referral_link;
            if (link) refCode = new URL(link).searchParams.get("ref") ?? undefined;
          } catch {
            /* ignore */
          }
        }

        const target = refCode
          ? `https://regalove.co/products/${handle}?ref=${refCode}`
          : `https://regalove.co/products/${handle}`;
        window.location.href = target;
        return;
      }

      // 3b. Advertiser ad → advertiser website
      const websiteUrl = (ad?.advertisers as any)?.website_url;
      if (websiteUrl) {
        window.location.href = websiteUrl.startsWith("http")
          ? websiteUrl
          : `https://${websiteUrl}`;
        return;
      }

      // 3c. Fallback
      window.location.href = "/";
    };

    run();
  }, [adId, screenId]);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
    </div>
  );
}
