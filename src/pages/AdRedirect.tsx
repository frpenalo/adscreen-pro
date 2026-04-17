import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AdRedirect() {
  const { adId, screenId } = useParams<{ adId: string; screenId: string }>();

  useEffect(() => {
    if (!adId || !screenId) return;

    const run = async () => {
      // Log the click
      await supabase.from("ad_clicks").insert({
        ad_id: adId,
        screen_id: screenId,
      });

      // Get advertiser website URL
      const { data } = await supabase
        .from("ads")
        .select("advertiser_id, advertisers(website_url)")
        .eq("id", adId)
        .single();

      const websiteUrl = (data?.advertisers as any)?.website_url;

      if (websiteUrl) {
        window.location.href = websiteUrl.startsWith("http")
          ? websiteUrl
          : `https://${websiteUrl}`;
      } else {
        // Fallback if no website configured
        window.location.href = "/";
      }
    };

    run();
  }, [adId, screenId]);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
    </div>
  );
}
