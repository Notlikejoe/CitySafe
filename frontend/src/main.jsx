import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";
import "./app/leafletFix";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            borderRadius: "16px",
            fontSize: "14px",
            fontFamily: "Inter, sans-serif",
            padding: "12px 16px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          },
          success: { iconTheme: { primary: "#14b8a6", secondary: "#f8fafc" } },
          error: { iconTheme: { primary: "#f87171", secondary: "#f8fafc" } },
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
