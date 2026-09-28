import { Download, Eye, Share2 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";
import { toast } from "sonner";

import { HackerPageLoader } from "@/components/HackerPageLoader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getRequest } from "@/shared/lib/api";
import { parseDateOnly } from "@/shared/lib/datetime";
import { useUserStore } from "@/shared/stores";
import type { Application } from "@/types";

import { fetchHackathonConfig, type HackathonConfig } from "../dashboard/api";
import { PrinterButton, TicketPrinter } from "./components/TicketPrinter";
import { QR_SIZE, type TicketLine } from "./paper";
import { renderTicketPNG } from "./ticketImage";

function fullName(application: Application): string {
  const { first_name, last_name } = application.responses;
  return [first_name, last_name]
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .join(" ");
}

function eventDates(config: HackathonConfig | null): string | null {
  const start = parseDateOnly(config?.start_date ?? "");
  if (!start) return null;
  const end = parseDateOnly(config?.end_date ?? "");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return end && end.getTime() !== start.getTime()
    ? `${fmt(start)} - ${fmt(end)}`
    : fmt(start);
}

// Placeholder layout until the real ticket art lands. The lines are
// all that change, the printer and the export both draw from them.
function ticketLines(
  application: Application,
  userId: string,
  config: HackathonConfig | null,
): TicketLine[] {
  const dates = eventDates(config);
  return [
    { kind: "title", text: config?.hackathon_name || "HackUTD" },
    { kind: "center", text: "Admission ticket" },
    { kind: "rule" },
    { kind: "row", left: "Hacker", right: fullName(application) || "-" },
    {
      kind: "row",
      left: "Ticket",
      right: `#${application.id.slice(0, 8)}`,
    },
    ...(dates ? [{ kind: "row", left: "Dates", right: dates } as const] : []),
    { kind: "rule" },
    { kind: "total", left: "Admit", right: "One" },
    { kind: "rule", char: "=" },
    // The same code the scan page shows, so the ticket works at check-in.
    { kind: "qr", value: userId },
    { kind: "center", text: "Show this at check-in" },
  ];
}

export default function TicketPage() {
  const { user } = useUserStore();
  const [application, setApplication] = useState<Application | null>(null);
  const [config, setConfig] = useState<HackathonConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // The rendered image, shown before anything is saved or posted.
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  );
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getRequest<Application>(
        "/applications/me",
        "application",
        controller.signal,
      ),
      fetchHackathonConfig(controller.signal),
    ]).then(([app, cfg]) => {
      if (controller.signal.aborted) return;
      if (app.status === 200 && app.data) setApplication(app.data);
      if (cfg.status === 200 && cfg.data) setConfig(cfg.data);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  if (loading || !user) return <HackerPageLoader />;
  // Only a hacker holding a claimed spot has a ticket to print.
  if (
    application?.status !== "accepted" ||
    application.rsvp_status !== "confirmed"
  ) {
    return <Navigate to="/app" replace />;
  }

  const lines = ticketLines(application, user.id, config);
  const event = config?.hackathon_name || "HackUTD";
  const shareText = `Just got my ticket to ${event}. See you there!`;

  const openPreview = async () => {
    if (!qrRef.current) return;
    setBusy(true);
    try {
      const blob = await renderTicketPNG(lines, qrRef.current);
      const file = new File([blob], "admission-ticket.png", {
        type: "image/png",
      });
      setPreview({ file, url: URL.createObjectURL(file) });
    } catch {
      toast.error("Couldn't make your ticket image. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url;
    a.download = preview.file.name;
    a.click();
  };

  // Phones get the native share sheet with the image attached; desktops,
  // which mostly can't share files, get a prefilled post instead. The image
  // is already rendered, so the share sheet opens straight from the tap.
  const share = async () => {
    if (!preview) return;
    try {
      if (navigator.canShare?.({ files: [preview.file] })) {
        await navigator.share({ files: [preview.file], text: shareText });
      } else {
        window.open(
          `https://x.com/intent/post?text=${encodeURIComponent(shareText)}`,
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch (err) {
      // Closing the share sheet rejects with AbortError; that's not a failure.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        toast.error("Couldn't share your ticket. Please try again.");
      }
    }
  };

  return (
    <div className="animate-page-enter font-satoshi mx-auto flex w-full max-w-md flex-col items-center px-5 pt-6 pb-28">
      <p className="text-[11px] tracking-[0.18em] text-[#dbc4ff] uppercase">
        Spot claimed
      </p>
      {/* Hypik is letters only: no digits or punctuation here. */}
      <h1 className="font-hypik mt-2 text-center text-[clamp(1.75rem,9vw,2.75rem)] leading-none text-white uppercase">
        Your Ticket
      </h1>
      <p className="mt-2 mb-8 text-center text-sm font-light text-white/55">
        Tear it off, save it, and tell everyone you&apos;re coming.
      </p>

      <TicketPrinter
        lines={lines}
        label={`Admission ticket for ${fullName(application) || user.email}`}
        onTear={openPreview}
      />

      <div className="mt-8 flex w-full justify-center border-t border-white/10 pt-6">
        <PrinterButton primary onClick={openPreview} disabled={busy}>
          <Eye aria-hidden className="size-4" />
          Save or post
        </PrinterButton>
      </div>

      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="font-satoshi max-h-[92svh] gap-5 overflow-y-auto border-white/10 bg-[#0B0C15] p-5 text-white sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="text-[11px] font-normal tracking-[0.18em] text-[#dbc4ff] uppercase">
              Your ticket
            </DialogTitle>
            <DialogDescription className="text-sm font-light text-white/55">
              This is the image you&apos;ll save or post.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <img
              src={preview.url}
              alt="Your admission ticket"
              className="aspect-[4/5] w-full rounded-lg border border-white/10"
            />
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <PrinterButton primary onClick={share}>
              <Share2 aria-hidden className="size-4" />
              Post it
            </PrinterButton>
            <PrinterButton onClick={download}>
              <Download aria-hidden className="size-4" />
              Download
            </PrinterButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Source for the exported image; the printer draws its own SVG. */}
      <QRCodeCanvas
        ref={qrRef}
        value={user.id}
        size={QR_SIZE * 4}
        level="M"
        bgColor="transparent"
        fgColor="#1f1f22"
        className="hidden"
      />
    </div>
  );
}
