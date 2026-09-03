import { ArrowLeft, ArrowRight, ArrowUpRight, Mail } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { createCode } from "supertokens-auth-react/recipe/passwordless";
import { useSessionContext } from "supertokens-auth-react/recipe/session";
import { redirectToThirdPartyLogin } from "supertokens-auth-react/recipe/thirdparty";

import googleIcon from "@/assets/google_icon.webp";
import logoGlitch from "@/assets/logo_glitch.webp";
import zeroDayTitle from "@/assets/title-login.webp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isGoogleAuthEnabled } from "@/shared/auth";
import { checkEmailAuthMethod } from "@/shared/lib/api";

import { fetchLegalConfig } from "./api";
import MascotField from "./components/MascotField";
import type { LegalConfig } from "./types";

type LoginState = "email" | "sending" | "sent" | "error";

function ZeroDayShell({ children }: { children: ReactNode }) {
  return (
    <main className="zero-login relative isolate min-h-svh overflow-hidden bg-black text-white">
      <div
        aria-hidden
        className="zero-login-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="zero-login-scanlines pointer-events-none absolute inset-0 z-20"
      />
      <MascotField />

      <div className="pointer-events-none absolute inset-x-5 top-5 z-30 flex items-center justify-between font-mono text-[9px] tracking-[0.28em] text-white/45 uppercase sm:inset-x-8 sm:text-[10px] lg:inset-x-12">
        <a
          href="https://zeroday.hackutd.co"
          aria-label="HackUTD Zero Day"
          className="group pointer-events-auto flex translate-y-1 items-center gap-3"
        >
          <ArrowLeft
            aria-hidden
            className="size-5 text-[#21FFF0] transition-transform group-hover:-translate-x-1 sm:size-5"
          />
          <span className="hidden text-[11px] transition-colors group-hover:text-white sm:inline sm:text-xs">
            HackUTD // Secure portal
          </span>
        </a>
        <span>MMXXVI</span>
      </div>

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1500px] flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(390px,480px)]">
        <section className="relative flex shrink-0 flex-col overflow-hidden px-5 pt-12 sm:px-8 sm:pt-14 lg:min-h-svh lg:overflow-visible lg:px-14 lg:pt-24 lg:pb-12 xl:px-20">
          <img
            src={zeroDayTitle}
            alt="HackUTD Zero Day"
            className="zero-login-title relative z-10 max-h-[15svh] w-full max-w-[800px] object-contain object-left-top lg:max-h-none"
          />

          <div className="relative z-10 mt-auto hidden max-w-sm lg:block">
            <div className="border-l border-[#21FFF0]/60 pl-4">
              <p className="font-mono text-[10px] tracking-[0.32em] text-[#21FFF0] uppercase">
                System entry // 2026
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Your gateway to applications, event access, schedules, and
                everything HackUTD 2026.
              </p>
            </div>
            <div className="mt-6">
              <PoweredByHarpLink />
            </div>
          </div>

          <img
            src={logoGlitch}
            alt=""
            aria-hidden
            className="zero-login-hand pointer-events-none absolute right-[2%] -bottom-[12%] hidden w-[min(44vw,650px)] max-w-none opacity-80 lg:block"
          />
        </section>

        <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center border-t border-white/10 px-5 py-5 sm:px-8 sm:py-10 lg:min-h-svh lg:border-t-0 lg:border-l lg:border-white/10 lg:bg-black/20 lg:px-10 lg:py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 right-0 z-0 w-[min(125%,430px)] max-w-none translate-x-[14%] -translate-y-[7%] lg:hidden"
          >
            <img
              src={logoGlitch}
              alt=""
              className="zero-login-hand w-full opacity-60"
            />
          </div>
          <div
            aria-hidden
            className="absolute top-0 left-0 h-px w-20 bg-[#F62BE8] shadow-[0_0_14px_#F62BE8] lg:h-20 lg:w-px"
          />
          <div
            aria-hidden
            className="absolute right-5 bottom-4 font-mono text-[8px] tracking-[0.3em] text-white/25 uppercase [writing-mode:vertical-rl] lg:right-3 lg:bottom-8"
          >
            Identity verification node 01
          </div>
          {children}
          <div className="mt-4 w-full max-w-[420px] sm:mt-6 lg:hidden">
            <PoweredByHarpLink />
          </div>
        </section>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 z-30 hidden -translate-y-1/2 font-mono text-[9px] tracking-[0.4em] text-white/25 uppercase [writing-mode:vertical-rl] lg:block"
      >
        HACKUTD // ZERO DAY
      </div>
    </main>
  );
}

function AccessPanel({ children }: { children: ReactNode }) {
  return (
    <div className="zero-login-panel relative z-10 w-full max-w-[420px] p-px">
      <div className="zero-login-panel-inner px-4 py-5 sm:px-8 sm:py-8">
        {children}
      </div>
    </div>
  );
}

function PoweredByHarpLink() {
  return (
    <a
      href="https://github.com/hackutd/harp"
      target="_blank"
      rel="noreferrer"
      className="zero-harp-link inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase"
    >
      <span className="text-white/35">Powered by</span>
      <span className="text-white/70">HARP</span>
      <ArrowUpRight aria-hidden className="size-3 text-[#21FFF0]/70" />
    </a>
  );
}

export default function Login() {
  const session = useSessionContext();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LoginState>("email");
  const [error, setError] = useState("");
  const [legal, setLegal] = useState<LegalConfig | null>(null);

  // Must run before the redirect below — hooks cannot sit after an early return.
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const res = await fetchLegalConfig(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setLegal(res.data);
      }
      // Deliberately silent: an operator that has published no policies should
      // not greet every visitor with an error toast on the sign-in screen.
    }
    load();
    return () => controller.abort();
  }, []);

  // Redirect if already logged in
  if (!session.loading && session.doesSessionExist) {
    return <Navigate to="/app" replace />;
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");

    // Check if email exists with different auth method
    const checkRes = await checkEmailAuthMethod(email);
    if (checkRes.status === 200 && checkRes.data?.exists) {
      if (checkRes.data.auth_method === "google") {
        setState("error");
        setError(
          "This email is registered with Google. Please use the Google sign-in option instead.",
        );
        return;
      }
    }

    try {
      const response = await createCode({ email });

      if (response.status === "OK") {
        setState("sent");
      } else {
        setState("error");
        setError("Failed to send magic link. Please try again.");
      }
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleGoogleLogin = async () => {
    if (email) {
      const checkRes = await checkEmailAuthMethod(email);
      if (checkRes.status === 200 && checkRes.data?.exists) {
        if (checkRes.data.auth_method === "passwordless") {
          setState("error");
          setError(
            "This email is registered with magic link sign-in. Please use the email option instead.",
          );
          return;
        }
      }
    }

    try {
      await redirectToThirdPartyLogin({ thirdPartyId: "google" });
    } catch (err) {
      setState("error");
      setError(
        err instanceof Error ? err.message : "Failed to initiate Google login",
      );
    }
  };

  const handleReset = () => {
    setState("email");
    setError("");
  };

  // Email sent confirmation screen
  if (state === "sent") {
    return (
      <ZeroDayShell>
        <AccessPanel>
          <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
            <p className="font-mono text-[10px] tracking-[0.28em] text-[#21FFF0] uppercase">
              Link dispatched
            </p>
            <span className="h-1.5 w-1.5 bg-[#21FFF0] shadow-[0_0_10px_#21FFF0]" />
          </div>

          <div className="pt-6 text-center sm:pt-8">
            <span className="mx-auto flex size-12 items-center justify-center border border-[#21FFF0]/50 bg-[#21FFF0]/10 text-[#21FFF0] shadow-[0_0_30px_rgba(33,255,240,0.12)] sm:size-14">
              <Mail aria-hidden className="size-6" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white sm:mt-6 sm:text-3xl">
              Check your inbox.
            </h1>
            <p className="mt-2 text-xs leading-5 text-white/55 sm:mt-3 sm:text-sm sm:leading-6">
              We sent a secure sign-in link to
              <span className="mt-1 block font-medium break-all text-white">
                {email}
              </span>
            </p>
          </div>

          <div className="my-5 border-y border-white/10 py-3 font-mono text-[10px] leading-5 tracking-[0.12em] text-white/45 uppercase sm:my-7 sm:py-4">
            Open the link within 15 minutes to enter the hacker portal.
          </div>

          <Button
            variant="outline"
            className="zero-cut-button h-11 w-full sm:h-12 border-[#21FFF0]/45 bg-transparent text-xs font-medium tracking-[0.18em] text-white uppercase hover:border-[#21FFF0] hover:bg-[#21FFF0]/10 hover:text-white focus-visible:ring-[#21FFF0]/50"
            onClick={handleReset}
          >
            Use a different email
          </Button>
        </AccessPanel>
      </ZeroDayShell>
    );
  }

  // Email input form
  return (
    <ZeroDayShell>
      <AccessPanel>
        <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
          <p className="font-mono text-[10px] tracking-[0.28em] text-[#21FFF0] uppercase">
            Hacker access // 01
          </p>
          <div className="flex items-center gap-1" aria-hidden>
            <span className="h-1 w-5 bg-[#5900FF]" />
            <span className="h-1 w-2 bg-[#F62BE8]" />
            <span className="h-1 w-1 bg-[#21FFF0]" />
          </div>
        </div>

        <div className="pt-4 sm:pt-6">
          <p className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
            Authentication required
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-white sm:mt-2 sm:text-4xl">
            Enter Zero Day.
          </h1>
          <p className="zero-login-blurb mt-2 max-w-sm text-xs leading-5 text-white/55 sm:mt-3 sm:text-sm sm:leading-6">
            Sign in or create your hacker account with a secure magic link.
          </p>
        </div>

        <div className="mt-5 space-y-4 sm:mt-7 sm:space-y-5">
          {state === "error" && error && (
            <Alert
              variant="destructive"
              className="zero-cut-sm border-[#F62BE8]/55 bg-[#F62BE8]/10 text-[#ff9af8]"
            >
              <AlertDescription className="font-mono text-xs leading-5 text-[#ff9af8]">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Magic Link Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block font-mono text-[10px] tracking-[0.2em] text-white/55 uppercase sm:mb-2"
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#21FFF0]/70"
                />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={state === "sending"}
                  className="zero-login-input block h-11 w-full sm:h-12 border border-white/15 bg-white/[0.035] pr-4 pl-11 text-sm text-white transition-colors placeholder:text-white/25 hover:border-white/30 focus:border-[#21FFF0]/80 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="zero-cut-button group h-11 w-full sm:h-12 bg-[#5900FF] text-xs font-semibold tracking-[0.18em] text-white uppercase shadow-[0_0_26px_rgba(89,0,255,0.24)] hover:bg-[#6d1cff] focus-visible:ring-[#21FFF0]/50"
              disabled={!email}
              loading={state === "sending"}
            >
              {state === "sending"
                ? "Sending magic link..."
                : "Send magic link"}
              {state !== "sending" && (
                <ArrowRight
                  aria-hidden
                  className="size-4 transition-transform group-hover:translate-x-1"
                />
              )}
            </Button>
          </form>

          {/* Google OAuth Button (only if enabled) */}
          {isGoogleAuthEnabled && (
            <>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" />
                <span className="font-mono text-[9px] tracking-[0.18em] text-white/30 uppercase">
                  alternate route
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="zero-cut-button h-11 w-full sm:h-12 border-white/20 bg-white/[0.035] text-xs font-medium tracking-[0.12em] text-white uppercase hover:border-[#F62BE8]/70 hover:bg-[#F62BE8]/10 hover:text-white focus-visible:ring-[#F62BE8]/50"
                onClick={handleGoogleLogin}
              >
                <img src={googleIcon} alt="" className="mr-2 h-4 w-4" />
                Continue with Google
              </Button>
            </>
          )}

          {(legal?.terms_url || legal?.privacy_policy_url) && (
            <p className="text-center text-[10px] leading-4 text-white/35 sm:text-[11px] sm:leading-5">
              By continuing, you agree to our{" "}
              {legal.terms_url && (
                <a
                  href={legal.terms_url}
                  target="_blank"
                  rel="noreferrer"
                  className="zero-login-legal-link text-white/60"
                >
                  Terms of Service
                </a>
              )}
              {legal.terms_url && legal.privacy_policy_url && " and "}
              {legal.privacy_policy_url && (
                <a
                  href={legal.privacy_policy_url}
                  target="_blank"
                  rel="noreferrer"
                  className="zero-login-legal-link text-white/60"
                >
                  Privacy Policy
                </a>
              )}
            </p>
          )}
        </div>
      </AccessPanel>
    </ZeroDayShell>
  );
}
