import type { LucideIcon } from "lucide-react";
import { Bell, CalendarDays, House, ScanLine, User } from "lucide-react";
import { useLayoutEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import dragonfly from "@/assets/mascots/dragonfly.webp";
import jaguar from "@/assets/mascots/jaguar.webp";
import octopus from "@/assets/mascots/octopus.webp";
import raccoon from "@/assets/mascots/raccoon_walk.webp";
import { InstallPromptHost } from "@/components/InstallPromptHost";
import { PushPromptHost } from "@/components/PushPromptHost";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavSection, NavUser } from "@/pages/admin/_shared";
import { cn } from "@/shared/lib/utils";
import { useUserStore } from "@/shared/stores";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", to: "/app", icon: House, end: true },
  { label: "Scan", to: "/app/scan", icon: ScanLine, end: false },
  { label: "Schedule", to: "/app/schedule", icon: CalendarDays, end: false },
  { label: "Notifications", to: "/app/notifications", icon: Bell, end: false },
  { label: "Profile", to: "/app/profile", icon: User, end: false },
];

const SIDEBAR_NAV = NAV_ITEMS.map(({ label, to, icon, end }) => ({
  name: label,
  url: to,
  icon,
  end,
}));

// Uniform inset (rem) applied on every side of the bottom-nav bubble so the
// gap around the active bubble is identical top/bottom/left/right. Matches the
// bar's padding (p-[BOTTOM_NAV_PAD]) and the bubble's inset-y.
const BOTTOM_NAV_PAD = 0.375;

const ROUTE_MASCOTS = [octopus, dragonfly, raccoon, jaguar] as const;

function mascotForPath(pathname: string) {
  const routeKey = pathname.split("/").filter(Boolean).join("/") || "app";
  const hash = [...routeKey].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return ROUTE_MASCOTS[hash % ROUTE_MASCOTS.length];
}

function HackerRouteMascot({ pathname }: { pathname: string }) {
  const mascot = mascotForPath(pathname);
  const isFlying = mascot === dragonfly;

  return (
    <div
      key={pathname}
      aria-hidden
      className="hacker-route-mascot mascot-roam pointer-events-none fixed top-[12%] right-[5%] z-30 w-12 select-none [--mascot-delay:-7s] [--mascot-duration:25s] [--roam-x:calc(clamp(70px,16vw,180px)*-1)] [--roam-y:clamp(45px,13vh,140px)] sm:w-14 md:right-[7%] md:w-16"
    >
      <img
        src={mascot}
        alt=""
        draggable={false}
        className={cn(
          "w-full drop-shadow-[0_0_13px_rgba(246,43,232,0.42)]",
          isFlying
            ? "mascot-hover [--float:12px] [--mascot-bounce-duration:5.5s]"
            : "mascot-waddle [--mascot-bounce-duration:3.4s] [--waddle:7px]",
        )}
      />
    </div>
  );
}

function HackerJaguarRun() {
  return (
    <div
      aria-hidden
      className="hacker-jaguar-lane pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[9999] h-24 overflow-hidden select-none md:bottom-[5%] md:h-32"
    >
      <img
        src={jaguar}
        alt=""
        draggable={false}
        className="hacker-jaguar-run absolute bottom-0 left-0 w-[92px] drop-shadow-[0_0_15px_rgba(33,255,240,0.34)] [--jaguar-delay:-30s] [--jaguar-duration:43s] sm:w-[108px] md:w-[138px]"
      />
    </div>
  );
}

function activeIndex(pathname: string): number {
  return NAV_ITEMS.findIndex((item) =>
    item.end
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(item.to + "/"),
  );
}

function HackerSidebar() {
  const { user } = useUserStore();
  const location = useLocation();

  const userData = {
    name: "Hacker",
    email: user?.email || "",
    avatar: user?.profilePictureUrl || "",
  };

  return (
    <Sidebar
      collapsible="icon"
      className="hacker-zero-sidebar hidden border-white/10 md:flex"
    >
      <SidebarHeader>
        <NavUser user={userData} />
      </SidebarHeader>
      <SidebarContent>
        <NavSection
          label="Menu"
          items={SIDEBAR_NAV}
          currentPath={location.pathname}
        />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

export default function HackerLayout() {
  const location = useLocation();

  const index = activeIndex(location.pathname);
  const hasActive = index >= 0;

  // The application wizard has its own fixed bottom bar, so the mobile tab
  // bar is hidden there to avoid overlap.
  const hideMobileNav = location.pathname.startsWith("/app/apply");

  // Radix dialogs and menus render into document.body rather than inside the
  // layout wrapper. Scope the same hacker theme to those portals while this
  // layout is mounted, then remove it before entering an admin/public route.
  useLayoutEffect(() => {
    document.body.classList.add("hacker-zero-portals");
    return () => document.body.classList.remove("hacker-zero-portals");
  }, []);

  return (
    <SidebarProvider className="hacker-zero-theme min-h-svh bg-[#030409] text-white">
      {/* Onboarding prompts live here, not in providers.tsx, so they never
          appear on the admin portal or the public auth pages. */}
      <InstallPromptHost />
      <PushPromptHost />
      <HackerSidebar />
      <HackerRouteMascot pathname={location.pathname} />
      <HackerJaguarRun />

      {/* Page content */}
      <SidebarInset
        className={cn(
          "zero-hacker-surface bg-[#030409]",
          hideMobileNav ? "pb-0" : "pb-24 md:pb-0",
        )}
      >
        <div key={location.pathname} className="animate-page-enter">
          <Outlet />
        </div>
      </SidebarInset>

      {/* Mobile bottom tab bar */}
      <div
        className={cn(
          "fixed inset-x-4 bottom-4 z-40 md:hidden",
          hideMobileNav && "hidden",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <nav
          className="relative flex rounded-full bg-black/80 shadow-[0_2px_16px_rgba(0,0,0,0.18)] backdrop-blur-sm"
          style={{ padding: `${BOTTOM_NAV_PAD}rem` }}
        >
          {hasActive && (
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-full bg-white/15 transition-all duration-300 ease-out"
              style={{
                top: `${BOTTOM_NAV_PAD}rem`,
                bottom: `${BOTTOM_NAV_PAD}rem`,
                left: `calc(${BOTTOM_NAV_PAD}rem + ${index} * (100% - ${2 * BOTTOM_NAV_PAD}rem) / ${NAV_ITEMS.length})`,
                width: `calc((100% - ${2 * BOTTOM_NAV_PAD}rem) / ${NAV_ITEMS.length})`,
              }}
            />
          )}
          {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 transition-colors active:scale-[0.98]",
                  isActive ? "text-white" : "text-white/60",
                )
              }
            >
              <Icon className="size-5" strokeWidth={1.5} />
              <span className="text-[10px] font-light">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </SidebarProvider>
  );
}
