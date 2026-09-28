import {
  animate,
  type AnimationPlaybackControls,
  motion,
  type MotionValue,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import {
  type ComponentProps,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import { cn } from "@/shared/lib/utils";

import {
  HEIGHTS,
  INK,
  LEAD,
  PAPER,
  PAPER_WIDTH,
  QR_SIZE,
  TAIL,
  ticketHeight,
  type TicketLine,
  TOOTH,
} from "../paper";

type Phase = "idle" | "printing" | "printed" | "torn";
type Piece = {
  key: number;
  lift: number;
  twist: number;
  vx: number;
  vy: number;
};

const TOOTH_WIDTH = 8;
// Between tickets the roll's serrated edge stands a little out of the slot,
// so the idle and torn states still show paper.
const STUB = TOOTH + 9;
// A thermal head burns a whole line at once, then the stepper feeds it out.
const FEED_SPEED = 360;
const BURN_MS = 34;
// The paper leans back slightly as it rises out of the slot.
const LEAN = 9;
// The slot grips the paper: a twist pivots it on the cutter and a pull only
// gives a little, until either one rips it.
const MAX_TWIST = 9;
const GIVE = 10;
const TWIST_TEAR = 90;
const LIFT_TEAR = 70;
const FLICK = 700;
const SNAP_BACK = { type: "spring", stiffness: 700, damping: 34 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

// A hole into the printer reads dark even on the dark case.
const SLOT = "#000";
// From the printer's top edge to the middle of the slot: the paper stands on
// the printer and disappears exactly there.
const SLOT_MIDDLE = 13;

function edge(height: number, tornBottom: boolean) {
  const teeth = Math.ceil(PAPER_WIDTH / TOOTH_WIDTH);
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = Math.min(i * TOOTH_WIDTH, PAPER_WIDTH);
    const up = i % 2 === 1;
    top.push(`${x}px ${up ? 0 : TOOTH}px`);
    bottom.unshift(`${x}px ${tornBottom && !up ? height - TOOTH : height}px`);
  }
  return `polygon(${top.join(", ")}, ${bottom.join(", ")})`;
}

// Zero Day's chamfer, as on the sign-in page.
const NOTCH_SM =
  "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)";

export function TicketPrinter({
  lines,
  label,
  autoPrint = true,
  onTear,
  className,
}: {
  lines: TicketLine[];
  // Read out once printed, e.g. "Admission ticket for Ada Lovelace".
  label: string;
  // Prints once when it first scrolls into view.
  autoPrint?: boolean;
  onTear?: () => void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.15 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const pieceKey = useRef(0);
  const running = useRef<AnimationPlaybackControls[]>([]);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  const height = ticketHeight(lines);

  // How much paper has come out of the slot. Everything still inside the
  // printer sits below the clip, so a line only appears once it's printed.
  const fed = useMotionValue(STUB);
  const inside = useTransform(fed, (f) => height - f);
  const shade = useTransform(fed, [STUB, STUB + 24], [0, 1]);
  const twist = useMotionValue(0);
  const lift = useMotionValue(0);

  const stop = () => {
    running.current.forEach((a) => a.stop());
    running.current = [];
  };
  useEffect(() => stop, []);

  const print = () => {
    stop();
    drag.current = null;
    twist.jump(0);
    lift.jump(0);
    fed.jump(STUB);
    setPhase("printing");
    if (reduceMotion) {
      fed.jump(height);
      setPhase("printed");
      return;
    }
    // One keyframed run: feed out the blank lead, then for every line hold
    // still while the head burns it and feed it out, then run out the tail.
    const values = [STUB];
    const times = [0];
    let position = STUB;
    let time = 0;
    const feed = (px: number) => {
      position += px;
      time += (px / FEED_SPEED) * 1000;
      values.push(position);
      times.push(time);
    };
    const burn = () => {
      time += BURN_MS;
      values.push(position);
      times.push(time);
    };
    feed(TOOTH + LEAD - STUB);
    for (const line of lines) {
      burn();
      feed(HEIGHTS[line.kind]);
    }
    feed(TAIL);
    const run = animate(fed, values, {
      duration: time / 1000,
      times: times.map((t) => t / time),
      ease: "linear",
    });
    running.current = [run];
    run.then(() => setPhase((p) => (p === "printing" ? "printed" : p)));
  };

  const printRef = useRef(print);
  useEffect(() => {
    printRef.current = print;
  });
  useEffect(() => {
    if (autoPrint && inView) printRef.current();
  }, [autoPrint, inView]);

  const tear = (vx: number, vy: number) => {
    stop();
    drag.current = null;
    const piece: Piece = {
      key: pieceKey.current++,
      lift: lift.get(),
      twist: twist.get(),
      vx,
      vy,
    };
    // The torn piece leaves as its own copy, so Reprint works at once.
    flushSync(() => {
      setPhase("torn");
      if (!reduceMotion) setPieces((list) => [...list, piece]);
    });
    fed.jump(STUB);
    twist.jump(0);
    lift.jump(0);
    navigator.vibrate?.(10);
    onTear?.();
  };

  const release = (e: PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    // Twist velocity is in degrees; about 10px of hand travel per degree.
    const vx = twist.getVelocity() * 10;
    const vy = lift.getVelocity();
    if (Math.abs(vx) > FLICK || vy < -FLICK) return tear(vx, vy);
    running.current = [
      animate(twist, 0, SNAP_BACK),
      animate(lift, 0, SNAP_BACK),
    ];
  };

  const printed = phase === "printed";
  const status = {
    idle: "Paper loaded",
    printing: "Printing your ticket",
    printed: "Twist or pull to tear it off",
    torn: "Torn off",
  }[phase];

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex w-[min(340px,100%)] flex-col items-center",
        className,
      )}
    >
      {/* The paper rises into this reserved space, so nothing else moves
          while it prints. */}
      <div
        className="relative z-10 w-full"
        style={{ height: height + 8, marginBottom: -SLOT_MIDDLE }}
      >
        {/* Clipped only below the slot: paper still inside the printer is
            hidden, while a twisted ticket can still swing past the sides. */}
        <div className="absolute inset-0 [clip-path:inset(-100vh_-100vw_0_-100vw)]">
          <Paper
            lines={lines}
            height={height}
            inside={inside}
            twist={twist}
            lift={lift}
            label={printed ? label : undefined}
            hidden={phase === "idle" || phase === "torn"}
            interactive={printed}
            onPointerDown={(e) => {
              if (!printed || drag.current || e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              stop();
              drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || d.id !== e.pointerId) return;
              const dx = e.clientX - d.x;
              const up = d.y - e.clientY;
              twist.set(MAX_TWIST * Math.tanh(dx / 150));
              lift.set(-GIVE * Math.tanh(Math.max(up, 0) / (GIVE * 4)));
              // Rips mid-drag once pulled hard enough, carrying on in the
              // direction of the hand.
              if (Math.abs(dx) > TWIST_TEAR || up > LIFT_TEAR) {
                tear(Math.sign(dx) * 500, up > LIFT_TEAR ? -600 : -200);
              }
            }}
            onPointerUp={release}
            onPointerCancel={release}
          />
          {/* Shade where the paper comes out of the dark of the slot. */}
          <motion.span
            aria-hidden
            style={{ opacity: shade, width: PAPER_WIDTH }}
            className="pointer-events-none absolute bottom-0 left-1/2 h-5 max-w-full -translate-x-1/2 bg-linear-to-t from-black/25 to-transparent"
          />
        </div>
        {/* The slot's front half, drawn over the paper so it goes into the
            slot rather than behind the printer's edge. */}
        <span
          aria-hidden
          style={{ background: SLOT }}
          className="pointer-events-none absolute top-full left-1/2 h-[5px] w-[276px] max-w-[calc(100%-24px)] -translate-x-1/2 rounded-b-full"
        />
        {pieces.map((piece) => (
          <TornPiece
            key={piece.key}
            piece={piece}
            lines={lines}
            height={height}
            onGone={() =>
              setPieces((list) => list.filter((p) => p.key !== piece.key))
            }
          />
        ))}
      </div>

      <Printer busy={phase === "printing"} status={status} />

      <div className="mt-4 flex gap-2">
        <PrinterButton onClick={print}>
          {phase === "idle" ? "Print ticket" : "Reprint"}
        </PrinterButton>
        <PrinterButton onClick={() => tear(-420, -500)} disabled={!printed}>
          Tear off
        </PrinterButton>
      </div>
    </div>
  );
}

// A plain dark case: the slot, one status line, and the LED.
function Printer({ busy, status }: { busy: boolean; status: string }) {
  return (
    <div className="relative h-16 w-full rounded-2xl border border-white/10 bg-[#0B0C15] shadow-[0_0_32px_rgba(89,0,255,0.18)]">
      {/* The slot the paper leaves through. */}
      <div
        aria-hidden
        style={{ background: SLOT }}
        className="absolute top-2 left-1/2 h-2.5 w-[276px] max-w-[calc(100%-24px)] -translate-x-1/2 rounded-full"
      />
      <div className="absolute inset-x-5 bottom-3.5 flex items-center justify-center gap-2">
        {/* Green when ready, pulsing amber while it prints. */}
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full transition-colors duration-150",
            busy ? "animate-pulse bg-[#f5b23d]" : "bg-[#3ddc84]",
          )}
        />
        <p
          className="truncate text-[11px] tracking-[0.14em] text-white/50 uppercase"
          aria-live="polite"
        >
          {status}
        </p>
      </div>
    </div>
  );
}

function Paper({
  lines,
  height,
  inside,
  twist,
  lift,
  x,
  opacity,
  label,
  hidden,
  interactive,
  torn = false,
  ...handlers
}: {
  lines: TicketLine[];
  height: number;
  inside: MotionValue<number>;
  twist: MotionValue<number>;
  lift: MotionValue<number>;
  x?: MotionValue<number>;
  opacity?: MotionValue<number>;
  label?: string;
  hidden?: boolean;
  interactive?: boolean;
  torn?: boolean;
} & Pick<
  ComponentProps<"div">,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"
>) {
  const y = useTransform(() => inside.get() + lift.get());
  return (
    <motion.div
      role={label ? "region" : undefined}
      aria-label={label}
      aria-hidden={hidden || !label || undefined}
      style={{
        x,
        y,
        rotate: twist,
        rotateX: LEAN,
        transformPerspective: 900,
        opacity,
        width: PAPER_WIDTH,
        height,
        marginLeft: -PAPER_WIDTH / 2,
      }}
      className={cn(
        // Pivots on the slot, where the cutter holds it.
        "absolute bottom-0 left-1/2 max-w-full origin-bottom select-none",
        // Outside the clip, so the shadow follows the teeth.
        "[filter:drop-shadow(0_0_0.5px_rgba(0,0,0,0.3))_drop-shadow(0_6px_14px_rgba(89,0,255,0.25))]",
        interactive
          ? "cursor-grab touch-none active:cursor-grabbing"
          : "pointer-events-none",
      )}
      {...handlers}
    >
      <div
        style={{
          clipPath: edge(height, torn),
          background: PAPER,
          color: INK,
          paddingTop: TOOTH + LEAD,
        }}
        className="h-full px-4 font-mono text-[13px] leading-[18px] uppercase"
      >
        {lines.map((line, i) => (
          <Line key={i} line={line} />
        ))}
      </div>
    </motion.div>
  );
}

function Line({ line }: { line: TicketLine }) {
  switch (line.kind) {
    case "rule":
      return (
        <p
          aria-hidden
          className="h-[18px] overflow-hidden whitespace-nowrap opacity-70"
        >
          {(line.char ?? "-").repeat(48)}
        </p>
      );
    case "row":
      return (
        <p className="flex h-[18px] justify-between gap-3 tabular-nums">
          <span className="overflow-hidden text-ellipsis whitespace-pre">
            {line.left}
          </span>
          <span className="truncate">{line.right}</span>
        </p>
      );
    case "total":
      return (
        // Stretched to twice the height at normal width, as thermal
        // printers do, rather than set in a bigger font.
        <p className="flex h-9 items-start justify-between gap-3 font-bold tabular-nums">
          <span className="inline-block origin-top scale-y-200">
            {line.left}
          </span>
          <span className="inline-block origin-top scale-y-200">
            {line.right}
          </span>
        </p>
      );
    case "qr":
      return (
        <div
          className="flex items-center justify-center"
          style={{ height: HEIGHTS.qr }}
        >
          <QRCodeSVG
            value={line.value}
            size={QR_SIZE}
            level="M"
            bgColor="transparent"
            fgColor={INK}
          />
        </div>
      );
    default:
      return (
        <p
          className={cn(
            "h-[18px] truncate text-center",
            line.kind === "title" && "font-bold tracking-[0.2em]",
          )}
        >
          {line.text}
        </p>
      );
  }
}

function TornPiece({
  piece,
  lines,
  height,
  onGone,
}: {
  piece: Piece;
  lines: TicketLine[];
  height: number;
  onGone: () => void;
}) {
  const inside = useMotionValue(0);
  const x = useMotionValue(0);
  const lift = useMotionValue(piece.lift);
  const twist = useMotionValue(piece.twist);
  const opacity = useMotionValue(1);
  const gone = useRef(onGone);

  useEffect(() => {
    gone.current = onGone;
  });

  useEffect(() => {
    // Carries on with the hand that tore it, up and away, then fades.
    const direction = Math.sign(piece.vx) || -1;
    const all = [
      animate(x, piece.vx * 0.25, {
        type: "spring",
        stiffness: 90,
        damping: 18,
        velocity: piece.vx,
      }),
      animate(lift, piece.lift - 90, {
        type: "spring",
        stiffness: 90,
        damping: 18,
        velocity: piece.vy,
      }),
      animate(twist, piece.twist + direction * 8, {
        duration: 0.5,
        ease: EASE_OUT,
      }),
      animate(opacity, 0, { duration: 0.26, delay: 0.14, ease: EASE_OUT }),
    ];
    all[3].then(() => gone.current());
    return () => all.forEach((a) => a.stop());
  }, [piece, x, lift, twist, opacity]);

  return (
    <div className="pointer-events-none absolute inset-0">
      <Paper
        lines={lines}
        height={height}
        inside={inside}
        x={x}
        twist={twist}
        lift={lift}
        opacity={opacity}
        hidden
        torn
      />
    </div>
  );
}

export function PrinterButton({
  onClick,
  disabled,
  children,
  primary,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ clipPath: NOTCH_SM }}
      className={cn(
        "inline-flex h-11 touch-manipulation items-center gap-2 px-5 text-[12px] font-medium tracking-[0.12em] text-white uppercase transition-[scale,opacity,background-color] duration-150 ease-out select-none focus-visible:shadow-[inset_0_0_0_2px_#fff] focus-visible:outline-none active:scale-[0.96] disabled:opacity-40 disabled:active:scale-100 motion-reduce:transition-[opacity]",
        primary
          ? "bg-[#5900FF] hover:bg-[#6D1CFF]"
          : "bg-white/10 hover:bg-white/15",
      )}
    >
      {children}
    </button>
  );
}
