import { useState, useEffect, useCallback } from "react";

/**
 * Shared geolocation hook for the whole app.
 * Uses getCurrentPosition so screens start from a single exact fix and can retry on demand.
 */
export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [geoState, setGeoState] = useState("idle");

  const refresh = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setGeoState("error");
      return;
    }

    setError(null);
    setGeoState("loading");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude);
        const lon = Number(pos.coords.longitude);

        // Clamp accepted values to valid world coordinates before any map or API use.
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          setLocation(null);
          setError("Received invalid coordinates from your device.");
          setGeoState("error");
          return;
        }

        setLocation({ lat, lon });
        setError(null);
        setGeoState("ready");
      },
      (err) => {
        setLocation(null);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location access was denied. Please allow location in your browser settings.");
            setGeoState("denied");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location information is unavailable. Please try again.");
            setGeoState("error");
            break;
          case err.TIMEOUT:
            setError("Location request timed out. Please try again.");
            setGeoState("error");
            break;
          default:
            setError("An unknown error occurred while retrieving location.");
            setGeoState("error");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    location,
    error,
    geoState,
    loading: geoState === "idle" || geoState === "loading",
    refresh,
  };
}
