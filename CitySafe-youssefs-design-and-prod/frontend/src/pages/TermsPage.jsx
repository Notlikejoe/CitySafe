import { Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-teal-600 font-medium hover:underline mb-6">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-7 w-7 text-teal-600" />
            <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
          </div>
          <p className="text-slate-500 text-sm">Last updated: March 2026</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-8 text-slate-700 text-sm leading-relaxed shadow-sm">
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p>By creating an account and using CitySafe, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">2. Use of the Service</h2>
            <p>CitySafe is a community safety platform designed to help users report local incidents and request emergency assistance. You agree to use this platform responsibly and only for lawful purposes. False or misleading reports are strictly prohibited and may result in account suspension.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">3. User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your credentials. You may not share your account with others. You must provide accurate information when creating your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">4. Emergency Services Disclaimer</h2>
            <p className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              ⚠️ CitySafe is not a replacement for official emergency services. In a life-threatening emergency, always call your local emergency number (e.g., 911, 999) first.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">5. Content and Reports</h2>
            <p>All reports, images, and information submitted must be accurate and relevant to community safety. CitySafe reserves the right to remove any content that violates these terms or is deemed inappropriate.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">6. Limitation of Liability</h2>
            <p>CitySafe provides the platform on an "as is" basis and does not guarantee uninterrupted availability. CitySafe is not liable for any damages arising from use or inability to use the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">7. Changes to Terms</h2>
            <p>We may update these terms from time to time. Continued use of CitySafe after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">8. Contact</h2>
            <p>Questions about these terms? Contact us via the CitySafe GitHub repository or community support channels.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
