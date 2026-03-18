/**
 * useSocket — Socket.io real-time hook.
 *
 * Connects to the CitySafe backend WebSocket server and provides
 * a subscription function for consumers to listen to specific events.
 *
 * Usage:
 *   const { on, off } = useSocket();
 *   useEffect(() => {
 *     on("sos:new", (data) => console.log(data));
 *     return () => off("sos:new");
 *   }, [on, off]);
 */
import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000";

let sharedSocket = null;
let refCount = 0;

function getSocket() {
    if (!sharedSocket || !sharedSocket.connected) {
        const token = localStorage.getItem("cs_token");
        sharedSocket = io(SOCKET_URL, {
            transports: ["websocket", "polling"],
            auth: token ? { token } : {},
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });
    }
    return sharedSocket;
}

export function useSocket() {
    const socketRef = useRef(null);

    useEffect(() => {
        refCount++;
        socketRef.current = getSocket();

        socketRef.current.on("connect", () => {
            console.log("[Socket] Connected:", socketRef.current.id);
        });
        socketRef.current.on("connect_error", (err) => {
            console.warn("[Socket] Connection error:", err.message);
        });

        return () => {
            refCount--;
            // Only fully disconnect if no other consumers are active
            if (refCount === 0 && sharedSocket) {
                sharedSocket.disconnect();
                sharedSocket = null;
            }
        };
    }, []);

    const on = useCallback((event, handler) => {
        socketRef.current?.on(event, handler);
    }, []);

    const off = useCallback((event, handler) => {
        socketRef.current?.off(event, handler);
    }, []);

    const emit = useCallback((event, data) => {
        socketRef.current?.emit(event, data);
    }, []);

    return { on, off, emit };
}
