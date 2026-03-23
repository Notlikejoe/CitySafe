import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, FileWarning, Camera, ChevronRight, CheckCircle, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { useCreateReport, useCancelReport } from "../hooks/useReports";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import { useGeolocation } from "../hooks/useGeolocation";
import { reportsService } from "../services/reportsService";
import { resolveApiUrl } from "../lib/apiClient";
import toast from "react-hot-toast";

const REPORT_TYPES = [
  { id: "pothole", label: "Pothole", emoji: "🕳️" },
  { id: "flooding", label: "Flooding", emoji: "🌊" },
  { id: "construction", label: "Construction", emoji: "🚧" },
  { id: "fire", label: "Fire", emoji: "🔥" },
  { id: "crime", label: "Crime", emoji: "🚨" },
  { id: "other", label: "Other", emoji: "📍" },
];



export default function ReportPage() {
  const navigate = useNavigate();
  const { mutate: createReport, isPending } = useCreateReport();
  const { mutate: cancelReport, isPending: cancelling } = useCancelReport();
  const { submitOrQueue } = useOfflineQueue();
  const { location, error: geoError, loading: geoLoading } = useGeolocation();

  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [errors, setErrors] = useState({});

  const EMERGENCY_TYPES = ["fire", "crime"];

  const validate = () => {
    const e = {};
    if (!type) e.type = "Please select a report type.";
    if (!location) e.location = geoError ?? "A valid location is required before submitting a report.";
    const minChars = EMERGENCY_TYPES.includes(type) ? 0 : 3;
    if (description.trim().length < minChars)
      e.description = `Please enter at least ${minChars} characters.`;
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    let imageUrl = null;

    if (imageFile) {
      setUploadingImage(true);
      try {
        const uploadResponse = await reportsService.uploadImage(imageFile);
        imageUrl = uploadResponse.data?.imageUrl ?? uploadResponse.imageUrl ?? null;
      } catch (error) {
        setUploadingImage(false);
        toast.error(error.message ?? "Failed to upload image");
        return;
      }
      setUploadingImage(false);
    }

    const payload = { type, description, imageUrl, location };

    // Offline-first: queue the report if we have no connectivity
    const queued = await submitOrQueue("report", payload);
    if (queued) return;

    createReport(
      payload,
      { onSuccess: (data) => setSubmitted(data) }
    );
  };

  if (submitted) {
    const submittedImageUrl = resolveApiUrl(submitted.imageUrl);
    const handleRetract = () => {
      if (!window.confirm("Are you sure you want to retract this report? This cannot be undone.")) return;
      cancelReport(submitted.id, {
        onSuccess: () => {
          setSubmitted(null);
          setType("");
          setDescription("");
          setImageFile(null);
        },
      });
    };

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
              {submittedImageUrl && (
                <img
                  src={submittedImageUrl}
                  alt="Submitted report"
                  className="mt-3 h-40 w-full rounded-xl object-cover border border-slate-200"
                />
              )}
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
              onClick={() => { setSubmitted(null); setType(""); setDescription(""); setImageFile(null); }}
            >
              Report another issue
            </Button>
            {/* Retract button — only visible while status is under_review */}
            {submitted.status === "under_review" && (
              <Button
                variant="ghost"
                className="w-full text-red-500 hover:bg-red-50 hover:text-red-600"
                loading={cancelling}
                onClick={handleRetract}
              >
                <Trash2 className="h-4 w-4" />
                Retract this report
              </Button>
            )}
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

        {/* ── Location (display-only — uses real GPS) ── */}
        <div>
          <p className="block text-sm font-semibold text-slate-700 mb-2">Location</p>
          {geoLoading && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 text-teal-500 shrink-0 animate-spin" aria-hidden="true" />
              Detecting your location…
            </div>
          )}
          {!geoLoading && geoError && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              {geoError}
            </div>
          )}
          {!geoLoading && location && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
              <MapPin className="h-4 w-4 text-teal-600 shrink-0" aria-hidden="true" />
              <div className="text-sm text-teal-800 font-medium">
                Current Location
                <div className="text-xs text-teal-600 font-normal mt-0.5">
                  {location.lat.toFixed(5)}°N, {location.lon.toFixed(5)}°E
                </div>
              </div>
            </div>
          )}
          {errors.location && (
            <p className="text-xs text-red-500 mt-1.5" role="alert">{errors.location}</p>
          )}
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

        {/* ── Image upload ── */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="report-image">
            Upload photo <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Camera className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              id="report-image"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="bg-transparent flex-1 text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-teal-700"
            />
          </div>
          {imageFile && (
            <p className="mt-1.5 text-xs text-slate-500">
              Selected: {imageFile.name}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={isPending || uploadingImage}
          disabled={isPending || uploadingImage || geoLoading || !location}
        >
          {isPending ? "Submitting…" : "Submit Report"}
        </Button>
      </form>
    </div>
  );
}
