/**
 * CitySafe API Client
 * Wraps axios with environment-aware switching between real API and mock adapter.
 */
import axios from "axios";
import { mockRequest } from "./mockAdapter";
import toast from "react-hot-toast";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

// ─── Real axios instance ──────────────────────────────────────────────
const axiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 10_000,
    headers: { "Content-Type": "application/json" },
});

axiosInstance.interceptors.request.use((config) => {
    // Attach auth token if available
    const token = localStorage.getItem("cs_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

axiosInstance.interceptors.response.use(
    (res) => res,
    (error) => {
        const message =
            error.response?.data?.error ??
            error.response?.data?.message ??
            error.message ??
            "Something went wrong";
            
        if (error.response?.status === 401 && !USE_MOCK) {
            // Prevent infinite redirect loop if we are trying to login
            if (!error.config?.url?.includes("/auth/login")) {
                localStorage.removeItem("cs_token");
                toast.error("Session expired. Please log in again.");
                setTimeout(() => {
                    if (window.location.pathname !== "/login") {
                        window.location.href = "/login";
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
        return axiosInstance.post(url, data);
    },
    patch: (url, data = {}) => {
        if (USE_MOCK) return mockRequest("PATCH", url, data);
        return axiosInstance.patch(url, data);
    },
    delete: (url) => {
        if (USE_MOCK) return mockRequest("DELETE", url, null);
        return axiosInstance.delete(url);
    },
};

export default client;
