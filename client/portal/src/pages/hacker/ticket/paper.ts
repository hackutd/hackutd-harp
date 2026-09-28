// What a ticket is made of, shared by the printer on screen and the image
// export, so both draw the same paper.

export type TicketLine =
  | { kind: "title"; text: string }
  | { kind: "center"; text: string }
  | { kind: "row"; left: string; right: string }
  // Printed double height, the way a thermal head prints emphasis.
  | { kind: "total"; left: string; right: string }
  | { kind: "rule"; char?: string }
  | { kind: "qr"; value: string };

// 80mm paper, scaled down.
export const PAPER_WIDTH = 256;
export const LINE = 18;
export const QR_SIZE = 120;
export const HEIGHTS: Record<TicketLine["kind"], number> = {
  title: LINE,
  center: LINE,
  row: LINE,
  rule: LINE,
  total: LINE * 2,
  qr: QR_SIZE + 16,
};

// The serrated edge the cutter left on the roll last time.
export const TOOTH = 5;
// Blank paper between that old tear and the first line, as a real roll has.
export const LEAD = 14;
// After the last line the printer keeps feeding blank paper, so the text
// clears the cutter before you tear.
export const TAIL = 36;

// Thermal paper is a physical material: bright white with near-black ink.
export const PAPER = "#fbfaf6";
export const INK = "#1f1f22";

export function ticketHeight(lines: TicketLine[]) {
  return (
    TOOTH + LEAD + lines.reduce((sum, l) => sum + HEIGHTS[l.kind], 0) + TAIL
  );
}
