"use client";

import { useState, useRef, FormEvent, KeyboardEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mail, User, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"EMAIL" | "OTP">("EMAIL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  const router = useRouter();
  const setToken = useAuthStore((state) => state.setToken);
  const initialize = useAuthStore((state) => state.initialize);
  
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendTimer > 0) {
      timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const requestOTP = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setError("");

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return setError("Please enter a valid email address.");
    }
    if (!fullName.trim()) {
      return setError("Please enter your full name.");
    }

    setLoading(true);
    try {
      // Call Custom Backend to Send OTP via Resend
      await api.post("/auth/send-otp", { email, fullName });

      setStep("OTP");
      setResendTimer(300);
      // Focus first OTP input after a slight delay to allow rendering
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err: any) {
      console.error("OTP Request Error:", err);
      if (err.response?.status === 429) {
        setError("Too many requests. Please wait a moment and try again.");
      } else {
        setError(err.response?.data?.message || "Failed to send OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value !== "" && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedData) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);

    if (pastedData.length === 6) {
      otpRefs[5].current?.focus();
    } else {
      otpRefs[pastedData.length].current?.focus();
    }
  };

  const verifyOTP = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    
    const otpCode = otp.join("");
    if (otpCode.length < 6) return setError("Please enter a valid 6-digit OTP");

    setLoading(true);
    try {
      // Authenticate with custom backend
      const { data } = await api.post("/auth/verify-otp", { 
        email,
        otp: otpCode,
        fullName 
      });

      setToken(data.token);
      await initialize();
      router.push("/chat");
    } catch (err: any) {
      console.error("Verification Error:", err);
      setError(err.response?.data?.message || "Failed to verify. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border/40 shadow-2xl">
        <CardHeader className="flex flex-col items-center text-center space-y-2 pt-8 pb-6">
          <div className="w-20 h-20 flex items-center justify-center mb-2">
            <Image src="/nexchat-logo.png" alt="NexChat Logo" width={80} height={80} className="object-contain rounded-2xl" priority />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-center">
            {step === "EMAIL" ? "Welcome to NexChat" : "Check your email"}
          </CardTitle>
          <CardDescription className="text-center">
            {step === "EMAIL"
              ? "Enter your details to receive a secure login code."
              : `We sent a 6-digit code to ${email}`}
          </CardDescription>
        </CardHeader>

        {step === "EMAIL" ? (
          <form onSubmit={requestOTP}>
            <CardContent className="space-y-4 px-8 pb-6">
              {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md animate-in fade-in slide-in-from-top-1">{error}</div>}

              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-12 pl-10 bg-background"
                  disabled={loading}
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 pl-10 bg-background"
                  disabled={loading}
                />
              </div>
            </CardContent>
            <CardFooter className="px-8 pb-8">
              <Button className="w-full h-12 font-medium" type="submit" disabled={loading || !email || !fullName}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                  <>Continue <ArrowRight className="ml-2 w-4 h-4" /></>
                )}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={verifyOTP}>
            <CardContent className="space-y-6 px-8 pb-6">
              {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md animate-in fade-in slide-in-from-top-1">{error}</div>}
              {resendTimer === 0 && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md text-center animate-in fade-in">
                  This code is expired, kindly request for a new one.
                </div>
              )}
              <div className="flex justify-between gap-2 px-2">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={otpRefs[index]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="w-12 h-14 text-center text-xl font-bold bg-muted/50 focus:bg-background transition-colors"
                    disabled={loading || resendTimer === 0}
                  />
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 px-8 pb-8">
              <Button className="w-full h-12 font-medium" type="submit" disabled={loading || resendTimer === 0 || otp.join("").length < 6}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  <><ShieldCheck className="mr-2 h-4 w-4" /> Verify & Sign In</>
                )}
              </Button>
              <div className="text-sm text-center text-muted-foreground flex items-center justify-between w-full px-2">
                <button
                  type="button"
                  onClick={() => setStep("EMAIL")}
                  className="hover:text-foreground transition-colors"
                  disabled={loading}
                >
                  Change Email
                </button>
                <div className="flex items-center space-x-1.5">
                  {resendTimer > 0 && (
                    <span className="font-mono">{formatTime(resendTimer)}</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      setOtp(["", "", "", "", "", ""]);
                      requestOTP(e);
                    }}
                    disabled={resendTimer > 0 || loading}
                    className="hover:text-foreground transition-colors disabled:opacity-50 disabled:hover:text-muted-foreground"
                  >
                    Resend
                  </button>
                </div>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
