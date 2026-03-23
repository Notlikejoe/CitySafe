/**
 * CitySafe API Client
 * Wraps axios with environment-aware switching between real API and mock adapter.
 */
import axios from "axios";
import { mockRequest } from "./mockAdapter";
import toast from "react-hot-toast";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
// Fix frontend API config fallback to correct backend port 4001
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const isFormData = (value) =>
    typeof FormData !== "undefined" && value instanceof FormData;

// ─── Real axios instance ──────────────────────────────────────────────
const axiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 10_000,
    headers: { "Content-Type": "application/json" },
    withCredentials: true, // Allow cookies to be sent and received
});

// The manual Authorization header interceptor has been removed
// because authentication relies on HTTPOnly cookies sent automatically.

axiosInstance.interceptors.response.use(
    (res) => res,
    (error) => {
        let message = "Something went wrong";

        if (!error.response) {
            // Network error (ERR_CONNECTION_REFUSED, offline, CORS, etc.)
            message = "Network Error: Could not connect to the server.";
        } else if (error.response.status >= 500) {
            // Server error 
            message = "Server Error: Backend is experiencing issues.";
        } else if (error.response.status === 401) {
            // Auth error
            message = "Authentication Error: Please log in again.";
        } else {
            // Standard/validation API responses gracefully handled
            message =
                error.response?.data?.error ??
                error.response?.data?.message ??
                error.message ??
                "Something went wrong";
        }
            
        if (error.response?.status === 401 && !USE_MOCK) {
            // Prevent infinite redirect loop if we are trying to login
            if (!error.config?.url?.includes("/auth/login")) {
                // Let the server clear the cookie automatically or handle session expiry
                toast.error("Session expired. Please log in again.");
                setTimeout(() => {
                    if (window.location.pathname !== "/auth") {
                        window.location.href = "/auth";
                    }
                }, 1500);
            }
        }
        
        return Promise.reject(new Error(message));
    }
);

// ─── Unified client ───────────────────────────────────────────────────
const client = {
    get: (url, params = {}) => {
        if (USE_MOCK) return mockRequest("GET", url, null, params);
        return axiosInstance.get(url, { params });
    },
    post: (url, data = {}) => {
        if (USE_MOCK) return mockRequest("POST", url, data);
        if (isFormData(data)) {
            return axiosInstance.post(url, data, { headers: { "Content-Type": undefined } });
        }
        return axiosInstance.post(url, data);
    },
    patch: (url, data = {}) => {
        if (USE_MOCK) return mockRequest("PATCH", url, data);
        if (isFormData(data)) {
            return axiosInstance.patch(url, data, { headers: { "Content-Type": undefined } });
        }
        return axiosInstance.patch(url, data);
    },
    put: (url, data = {}) => {
        if (USE_MOCK) return mockRequest("PUT", url, data);
        if (isFormData(data)) {
            return axiosInstance.put(url, data, { headers: { "Content-Type": undefined } });
        }
        return axiosInstance.put(url, data);
    },
    delete: (url) => {
        if (USE_MOCK) return mockRequest("DELETE", url, null);
        return axiosInstance.delete(url);
    },
};

export const resolveApiUrl = (path = "") => {
    if (!path) return "";
    const trimmed = String(path).trim();

    // Only expand real upload paths or absolute URLs. This prevents arbitrary
    // text fields from being treated as image sources in the UI.
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (!trimmed.startsWith("/uploads/")) return "";

    return `${API_ORIGIN}${trimmed}`;
};

export default client;
