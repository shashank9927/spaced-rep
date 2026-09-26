"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { History, X } from "lucide-react";
import { toast } from "sonner";
import { undoReview, type UndoReviewResult } from "@/lib/actions";
import type { PendingReviewUndo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { isReviewUndoAvailable } from "@/lib/review-undo";

const STORAGE_KEY = "recallcode:pending-review-undo";

type ReviewUndoContextValue = {
  pendingUndo: PendingReviewUndo | null;
  registerUndo: (value: PendingReviewUndo) => void;
  clearUndo: () => void;
  undoLastReview: () => void;
  undoPending: boolean;
};

const ReviewUndoContext = createContext<ReviewUndoContextValue | null>(null);

function readStoredUndo(): PendingReviewUndo | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingReviewUndo;
    if (!value.reviewLogId || !value.problemId || !value.expectedVersion || !isReviewUndoAvailable(value.expiresAt)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return value;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function ReviewUndoProvider({ children }: { children: ReactNode }) {
  const [pendingUndo, setPendingUndo] = useState<PendingReviewUndo | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [undoPending, startUndoTransition] = useTransition();

  const clearUndo = useCallback(() => {
    setPendingUndo(null);
    setSecondsLeft(0);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const registerUndo = useCallback((value: PendingReviewUndo) => {
    setPendingUndo(value);
    setSecondsLeft(Math.max(0, Math.ceil((value.expiresAt - Date.now()) / 1000)));
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }, []);

  useEffect(() => {
    const stored = readStoredUndo();
    if (stored) {
      const timer = window.setTimeout(() => {
        setPendingUndo(stored);
        setSecondsLeft(Math.max(0, Math.ceil((stored.expiresAt - Date.now()) / 1000)));
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!pendingUndo) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((pendingUndo.expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) clearUndo();
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [clearUndo, pendingUndo]);

  const undoLastReview = useCallback(() => {
    if (!pendingUndo || undoPending) return;
    startUndoTransition(async () => {
      const result: UndoReviewResult = await undoReview({ reviewLogId: pendingUndo.reviewLogId, expectedVersion: pendingUndo.expectedVersion });
      if (!result.ok) {
        clearUndo();
        toast.error(result.error);
        return;
      }
      const restored = pendingUndo;
      clearUndo();
      window.dispatchEvent(new CustomEvent("recallcode:review-undone", { detail: { pending: restored, result } }));
      toast.success("Review undone", { description: "The previous card state was restored." });
    });
  }, [clearUndo, pendingUndo, undoPending]);

  const value = useMemo(() => ({ pendingUndo, registerUndo, clearUndo, undoLastReview, undoPending }), [clearUndo, pendingUndo, registerUndo, undoLastReview, undoPending]);

  return <ReviewUndoContext.Provider value={value}>{children}{pendingUndo && <div role="status" className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-2xl md:inset-x-auto md:bottom-5 md:right-5 md:mx-0"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><History size={16} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-medium">Last review saved</strong><span className="block text-xs text-muted-foreground">Undo available for {formatClock(secondsLeft)}.</span></span><Button type="button" variant="outline" size="sm" disabled={undoPending} onClick={undoLastReview}>{undoPending ? "Undoing…" : "Undo"}</Button><Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss undo" disabled={undoPending} onClick={clearUndo}><X size={15} /></Button></div>}</ReviewUndoContext.Provider>;
}

export function useReviewUndo() {
  const value = useContext(ReviewUndoContext);
  if (!value) throw new Error("useReviewUndo must be used within ReviewUndoProvider");
  return value;
}

function formatClock(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
