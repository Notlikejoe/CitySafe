import { Link } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-teal-600 font-medium hover:underline mb-6">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <Lock className="h-7 w-7 text-teal-600" />
            <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
          </div>
          <p className="text-slate-500 text-sm">Last updated: March 2026</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-8 text-slate-700 text-sm leading-relaxed shadow-sm">
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">1. Information We Collect</h2>
            <p>When you create an account, we collect your User ID and an encrypted version of your password. When you submit reports or SOS requests, we collect the location data and description you provide.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-slate-600">
              <li>To authenticate your account and keep it secure.</li>
              <li>To display your reports and SOS requests on the community map.</li>
              <li>To award CitySafe community points for verified contributions.</li>
              <li>To improve the safety and reliability of the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">3. Location Data</h2>
            <p>Location information is used exclusively for placing reports and SOS requests on the map. We do not track or store continuous location data. You can disable location sharing in your account settings at any time, though some features will not be available without it.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">4. Data Storage</h2>
            <p>Your data is stored securely on the CitySafe backend server. Passwords are never stored in plain text — they are hashed using bcrypt before storage. Authentication tokens (JWTs) are stored in your browser's local storage and are used to verify your identity with the server.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">5. Data Sharing</h2>
            <p>We do not sell or share your personal data with third parties. Reports you submit may be visible to other platform users on the community map if you do not enable the "Anonymous Reports" setting in your preferences.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">6. Your Rights</h2>
            <p>You can cancel any of your pending reports through the application. You can request deletion of your account and associated data by contacting CitySafe administrators.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">7. Cookies & Tracking</h2>
            <p>CitySafe does not use advertising cookies or third-party trackers. The only browser storage used is local storage for your authentication token, which is essential for the app to function.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">8. Contact</h2>
            <p>If you have any questions about this Privacy Policy or how your data is handled, please reach out via the CitySafe GitHub repository.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
