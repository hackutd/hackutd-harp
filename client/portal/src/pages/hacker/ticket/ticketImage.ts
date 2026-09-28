import {
  HEIGHTS,
  INK,
  LEAD,
  PAPER,
  PAPER_WIDTH,
  QR_SIZE,
  ticketHeight,
  type TicketLine,
  TOOTH,
} from "./paper";

// A 4:5 portrait, the size Instagram and LinkedIn show uncropped in a feed.
const WIDTH = 1080;
const HEIGHT = 1350;
const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Draws the torn ticket on the portal's night background, the same lines the
// printer printed, so what they download is what they tore off.
export async function renderTicketPNG(
  lines: TicketLine[],
  qr: HTMLCanvasElement,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");

  ctx.fillStyle = "#07070d";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    0,
    WIDTH / 2,
    HEIGHT / 2,
    WIDTH * 0.7,
  );
  glow.addColorStop(0, "rgba(89,0,255,0.45)");
  glow.addColorStop(1, "rgba(89,0,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const height = ticketHeight(lines);
  // Fill most of the frame, whatever the ticket's length.
  const scale = Math.min((HEIGHT * 0.86) / height, (WIDTH * 0.8) / PAPER_WIDTH);
  ctx.save();
  ctx.translate(
    (WIDTH - PAPER_WIDTH * scale) / 2,
    (HEIGHT - height * scale) / 2,
  );
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.scale(scale, scale);

  // Serrated top and bottom, as the cutter leaves it.
  ctx.beginPath();
  for (let x = 0; x <= PAPER_WIDTH; x += 8) {
    ctx.lineTo(x, (x / 8) % 2 ? 0 : TOOTH);
  }
  for (let x = PAPER_WIDTH; x >= 0; x -= 8) {
    ctx.lineTo(x, (x / 8) % 2 ? height : height - TOOTH);
  }
  ctx.closePath();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 24 / scale;
  ctx.shadowOffsetY = 8 / scale;
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.fillStyle = INK;
  ctx.textBaseline = "top";
  const pad = 16;
  const right = PAPER_WIDTH - pad;
  let y = TOOTH + LEAD;
  for (const line of lines) {
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = "left";
    switch (line.kind) {
      case "rule":
        ctx.globalAlpha = 0.7;
        ctx.fillText(
          (line.char ?? "-").repeat(40),
          pad,
          y + 2,
          PAPER_WIDTH - pad * 2,
        );
        ctx.globalAlpha = 1;
        break;
      case "row":
        ctx.fillText(line.left.toUpperCase(), pad, y + 2);
        ctx.textAlign = "right";
        ctx.fillText(line.right.toUpperCase(), right, y + 2, 140);
        break;
      case "total":
        // Double height at normal width, as on the printed paper.
        ctx.save();
        ctx.font = `bold 13px ${FONT}`;
        ctx.scale(1, 2);
        ctx.fillText(line.left.toUpperCase(), pad, y / 2 + 1);
        ctx.textAlign = "right";
        ctx.fillText(line.right.toUpperCase(), right, y / 2 + 1);
        ctx.restore();
        break;
      case "qr":
        ctx.drawImage(
          qr,
          (PAPER_WIDTH - QR_SIZE) / 2,
          y + (HEIGHTS.qr - QR_SIZE) / 2,
          QR_SIZE,
          QR_SIZE,
        );
        break;
      default:
        ctx.font = `${line.kind === "title" ? "bold " : ""}13px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(
          line.text.toUpperCase(),
          PAPER_WIDTH / 2,
          y + 2,
          PAPER_WIDTH - pad * 2,
        );
    }
    y += HEIGHTS[line.kind];
  }
  ctx.restore();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      "image/png",
    ),
  );
}
