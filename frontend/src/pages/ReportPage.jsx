import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, FileWarning, Camera, ChevronRight, CheckCircle } from "lucide-react";
import { useCreateReport } from "../hooks/useReports";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const REPORT_TYPES = [
  { id: "pothole", label: "Pothole", emoji: "🕳️" },
  { id: "flooding", label: "Flooding", emoji: "🌊" },
  { id: "construction", label: "Construction", emoji: "🚧" },
  { id: "fire", label: "Fire", emoji: "🔥" },
  { id: "crime", label: "Crime", emoji: "🚨" },
  { id: "other", label: "Other", emoji: "📍" },
];

const MOCK_LOCATION = { lat: 25.2048, lon: 55.2708 };

export default function ReportPage() {
  const navigate = useNavigate();
  const { mutate: createReport, isPending } = useCreateReport();

  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [imageRef, setImageRef] = useState("");
  const [submitted, setSubmitted] = useState(null);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!type) e.type = "Please select a report type.";
    if (description.trim().length < 10) e.description = "Please enter at least 10 characters.";
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    createReport(
      { type, description, imageRef: imageRef || null, location: MOCK_LOCATION },
      { onSuccess: (data) => setSubmitted(data) }
    );
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 animate-fade-up">
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Report submitted!</h1>
          <p className="text-slate-500 mt-2 max-w-xs">
            Thanks for making your community safer. Our team will review it shortly.
          </p>
          <div className="mt-6 w-full">
            <Card className="p-4 text-left">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">
                <FileWarning className="h-3.5 w-3.5" /> Report
              </div>
              <div className="font-semibold text-slate-800 capitalize">{submitted.type}</div>
              <div className="text-sm text-slate-500 mt-1">{submitted.description}</div>
              <div className="text-xs text-slate-400 mt-2">
                Status: <span className="font-medium text-teal-600 capitalize">{submitted.status}</span>
              </div>
            </Card>
          </div>
          <div className="mt-4 flex flex-col gap-2 w-full">
            <Button className="w-full" onClick={() => navigate("/dashboard")}>
              View my reports <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" className="w-full"
              onClick={() => { setSubmitted(null); setType(""); setDescription(""); setImageRef(""); }}
            >
              Report another issue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Report an Issue</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Help your community stay safe by reporting what you see. Every report makes a difference. 🙌
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* ── Type picker ── */}
        <fieldset>
          <legend className="block text-sm font-semibold text-slate-700 mb-2">
            What's the issue?
          </legend>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Report type">
            {REPORT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={type === t.id}
                onClick={() => { setType(t.id); setErrors((e) => ({ ...e, type: undefined })); }}
                className={[
                  "flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-2 text-xs font-semibold transition-all",
                  type === t.id
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                ].join(" ")}
              >
                <span className="text-xl" aria-hidden="true">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
          {errors.type && <p className="text-xs text-red-500 mt-1.5" role="alert">{errors.type}</p>}
        </fieldset>

        {/* ── Location (display-only — no interactive input) ── */}
        <div>
          <p className="block text-sm font-semibold text-slate-700 mb-2">Location</p>
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <MapPin className="h-4 w-4 text-teal-500 shrink-0" aria-hidden="true" />
            <div className="text-sm text-slate-600">
              Dubai Marina Area
              <div className="text-xs text-slate-400">Location detected automatically</div>
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="report-description">
            Description
          </label>
          <textarea
            id="report-description"
            rows={4}
            value={description}
            onChange={(e) => { setDescription(e.target.value); setErrors((err) => ({ ...err, description: undefined })); }}
            placeholder="Describe what you see, so our team can review it quickly…"
            className={[
              "w-full rounded-2xl border px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400",
              "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition resize-none",
              errors.description ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50",
            ].join(" ")}
          />
          {errors.description && (
            <p className="text-xs text-red-500 mt-1.5" role="alert">{errors.description}</p>
          )}
        </div>

        {/* ── Image ref ── */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="report-image">
            Photo reference <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Camera className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              id="report-image"
              type="text"
              value={imageRef}
              onChange={(e) => setImageRef(e.target.value)}
              placeholder="Paste an image URL…"
              className="bg-transparent flex-1 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={isPending}>
          {isPending ? "Submitting…" : "Submit Report"}
        </Button>
      </form>
    </div>
  );
}