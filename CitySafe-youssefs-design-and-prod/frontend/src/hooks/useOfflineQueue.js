/**
 * useOfflineQueue — IndexedDB-backed offline submission queue.
 *
 * When the user is offline, SOS/Report submissions are stored in IndexedDB.
 * When the network comes back, they are automatically retried in order.
 */
import { useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import client from "../lib/apiClient";

const DB_NAME = "citysafe_offline";
const STORE_NAME = "pending_submissions";
const DB_VERSION = 1;

function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(STORE_NAME, {
                keyPath: "id",
                autoIncrement: true,
            });
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function enqueue(db, item) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dequeue(db, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function getAllPending(db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function flushQueue(db) {
    const pending = await getAllPending(db);
    if (!pending.length) return;

    toast.loading(`Syncing ${pending.length} offline submission(s)…`, { id: "offline-sync" });

    let successCount = 0;
    for (const item of pending) {
        try {
            if (item.type === "sos") {
                await client.post("/sos", item.payload);
            } else if (item.type === "report") {
                await client.post("/reports", item.payload);
            }
            await dequeue(db, item.id);
            successCount++;
        } catch (err) {
            console.error("[OfflineQueue] Retry failed for item", item.id, err);
        }
    }

    toast.dismiss("offline-sync");
    if (successCount > 0) {
        toast.success(`${successCount} offline submission(s) synced!`);
    }
}

export function useOfflineQueue() {
    const dbRef = useRef(null);

    useEffect(() => {
        openDb().then((db) => {
            dbRef.current = db;
        }).catch((err) => {
            console.error("[OfflineQueue] Failed to open IndexedDB:", err);
        });

        const handleOnline = () => {
            if (dbRef.current) {
                flushQueue(dbRef.current);
            }
        };

        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, []);

    /** Enqueue a submission when offline; returns true if queued, false if online (should submit directly). */
    const submitOrQueue = useCallback(async (type, payload) => {
        if (navigator.onLine) return false; // caller should submit normally

        if (!dbRef.current) {
            toast.error("Cannot queue: storage unavailable. Connect to internet and retry.");
            return true;
        }

        await enqueue(dbRef.current, { type, payload, queuedAt: new Date().toISOString() });
        toast.success(
            `You're offline. Your ${type === "sos" ? "SOS" : "report"} has been saved and will be sent automatically when you reconnect.`,
            { duration: 6000 }
        );
        return true;
    }, []);

    return { submitOrQueue };
}
