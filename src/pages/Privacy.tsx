import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Privacy() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
        <Card>
          <CardContent className="prose prose-sm max-w-none p-6 text-foreground">
            <h2 className="text-lg font-semibold">1. What We Collect</h2>
            <p>We collect the minimum data needed for virtual try-on: your email, profile photos (full body, face, hair, hands/wrist), and product page URLs you choose to try on.</p>

            <h2 className="text-lg font-semibold mt-4">2. How We Use It</h2>
            <p>Photos are used solely for generating virtual try-on results. Product URLs and click events are used for affiliate tracking and cashback. We never sell your data.</p>

            <h2 className="text-lg font-semibold mt-4">3. Storage & Security</h2>
            <p>All photos are stored in a private, encrypted bucket and served only via time-limited signed URLs. Access is restricted to your account.</p>

            <h2 className="text-lg font-semibold mt-4">4. Data Deletion</h2>
            <p>You can delete all your data at any time from the Profile page using the "Delete My Data" button. This permanently removes your photos, try-on history, wallet entries, and profile.</p>

            <h2 className="text-lg font-semibold mt-4">5. Third Parties</h2>
            <p>We may redirect through affiliate networks when you click "Continue via VTO." These networks have their own privacy policies. We only share the click URL, not your personal data.</p>

            <h2 className="text-lg font-semibold mt-4">6. Contact</h2>
            <p>For questions about your data, contact us at privacy@vto.app.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
