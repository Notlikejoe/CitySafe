import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ReportPage from "./ReportPage";

let mockGeolocation = {
  location: { lat: 29.3065, lon: 47.9203 },
  error: null,
  loading: false,
};

const {
  createReportSpy,
  cancelReportSpy,
  submitOrQueueSpy,
  uploadImageSpy,
} = vi.hoisted(() => ({
  createReportSpy: vi.fn(),
  cancelReportSpy: vi.fn(),
  submitOrQueueSpy: vi.fn(),
  uploadImageSpy: vi.fn(),
}));

vi.mock("../hooks/useReports", () => ({
  useCreateReport: () => ({ mutate: createReportSpy, isPending: false }),
  useCancelReport: () => ({ mutate: cancelReportSpy, isPending: false }),
}));

vi.mock("../hooks/useOfflineQueue", () => ({
  useOfflineQueue: () => ({ submitOrQueue: submitOrQueueSpy }),
}));

vi.mock("../hooks/useGeolocation", () => ({
  useGeolocation: () => mockGeolocation,
}));

vi.mock("../services/reportsService", () => ({
  reportsService: {
    uploadImage: uploadImageSpy,
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const renderPage = () => render(
  <MemoryRouter>
    <ReportPage />
  </MemoryRouter>,
);

describe("ReportPage", () => {
  beforeEach(() => {
    mockGeolocation = {
      location: { lat: 29.3065, lon: 47.9203 },
      error: null,
      loading: false,
    };
    createReportSpy.mockReset();
    cancelReportSpy.mockReset();
    submitOrQueueSpy.mockReset();
    uploadImageSpy.mockReset();
    submitOrQueueSpy.mockResolvedValue(false);
    uploadImageSpy.mockResolvedValue({ data: { imageUrl: "/uploads/test-image.png" } });
  });

  test("validates description length for non-emergency reports", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /pothole/i }));
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit report/i }));

    expect(await screen.findByText(/please enter at least 3 characters/i)).toBeInTheDocument();
    expect(createReportSpy).not.toHaveBeenCalled();
  });

  test("uploads the selected image before creating the report", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /fire/i }));
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Smoke reported near the market" },
    });

    const file = new File(["fake-image"], "report.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/upload photo/i), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: /submit report/i }));

    await waitFor(() => {
      expect(uploadImageSpy).toHaveBeenCalledWith(file);
      expect(createReportSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: "fire",
        description: "Smoke reported near the market",
        imageUrl: "/uploads/test-image.png",
        location: { lat: 29.3065, lon: 47.9203 },
      }), expect.any(Object));
    });
  });
});
