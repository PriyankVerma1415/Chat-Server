"use client";

import { useState, useRef, FormEvent, KeyboardEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mail, User, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import api from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Ambient floating particles background
const BackgroundParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Ambient ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-neon-purple/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-neon-cyan/20 blur-[120px]" />
      
      {/* Subtle grid */}
      <div className="absolute inset-0 bg-[url('/cyber-grid.svg')] opacity-[0.03] bg-repeat bg-[length:32px_32px]" />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => {
        const size = Math.random() * 4 + 2;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full bg-neon-cyan/40"
            style={{
              width: size,
              height: size,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              boxShadow: "0 0 10px rgba(0, 229, 255, 0.8)",
            }}
            animate={{
              y: [0, -40, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: Math.random() * 5 + 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
};

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
      await api.post("/auth/send-otp", { email, fullName });
      setStep("OTP");
      setResendTimer(300);
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
    <div className="relative flex min-h-screen items-center justify-center p-4 bg-[#070B14] overflow-hidden">
      <BackgroundParticles />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass-panel relative z-10 w-full max-w-md rounded-3xl overflow-hidden"
      >
        {/* Top glowing gradient border effect */}
        <div className="absolute top-0 left-0 right-0 h-1 cyber-gradient opacity-80" />

        <div className="px-8 pt-10 pb-6 flex flex-col items-center">
          <motion.div 
            className="w-20 h-20 flex items-center justify-center mb-6 relative"
            animate={{ 
              boxShadow: ["0px 0px 0px rgba(0,229,255,0)", "0px 0px 20px rgba(0,229,255,0.4)", "0px 0px 0px rgba(0,229,255,0)"]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <div className="absolute inset-0 rounded-2xl bg-linear-to-tr from-neon-cyan/20 to-electric-blue/20 blur-md" />
            <Image src="/nexchat-logo.png" alt="NexChat Logo" width={80} height={80} className="object-contain rounded-2xl relative z-10" priority />
          </motion.div>
          
          <h1 className="text-3xl font-bold tracking-tight text-center font-heading text-white">
            {step === "EMAIL" ? "Welcome to NexChat" : "Authenticate"}
          </h1>
          <p className="text-center text-muted-foreground mt-2 text-sm max-w-[280px]">
            {step === "EMAIL"
              ? "Initialize secure connection sequence."
              : `Awaiting 6-digit access token sent to ${email}`}
          </p>
        </div>

        {step === "EMAIL" ? (
          <motion.form 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onSubmit={requestOTP} 
            className="px-8 pb-8"
          >
            <div className="space-y-4 mb-8">
              {error && (
                <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 p-3 rounded-xl animate-in fade-in flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-neon-cyan transition-colors" />
                <Input
                  type="text"
                  placeholder="Designation / Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-14 pl-12 bg-black/20 border-glass-border focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-white placeholder:text-muted-foreground/70 rounded-xl transition-all"
                  disabled={loading}
                />
              </div>

              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-neon-cyan transition-colors" />
                <Input
                  type="email"
                  placeholder="comm-link@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 pl-12 bg-black/20 border-glass-border focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-white placeholder:text-muted-foreground/70 rounded-xl transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            <Button 
              className="w-full h-14 font-bold text-base cyber-gradient text-[#070B14] hover:opacity-90 neon-box-glow rounded-xl transition-all" 
              type="submit" 
              disabled={loading || !email || !fullName}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> ESTABLISHING LINK...</>
              ) : (
                <><span className="mr-2">INITIALIZE CONNECTION</span> <ArrowRight className="w-5 h-5" /></>
              )}
            </Button>
          </motion.form>
        ) : (
          <motion.form 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={verifyOTP} 
            className="px-8 pb-8"
          >
            <div className="space-y-6 mb-8">
              {error && (
                <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 p-3 rounded-xl animate-in fade-in flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {error}
                </div>
              )}
              {resendTimer === 0 && (
                <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 p-3 rounded-xl text-center animate-in fade-in">
                  Access token expired. Request a new sequence.
                </div>
              )}
              
              <div className="flex justify-between gap-2 px-1">
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
                    className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-black/20 border-glass-border focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan focus:shadow-[0_0_15px_rgba(0,229,255,0.3)] rounded-xl transition-all text-white"
                    disabled={loading || resendTimer === 0}
                  />
                ))}
              </div>
            </div>

            <Button 
              className="w-full h-14 font-bold text-base cyber-gradient text-[#070B14] hover:opacity-90 neon-box-glow rounded-xl transition-all mb-4" 
              type="submit" 
              disabled={loading || resendTimer === 0 || otp.join("").length < 6}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> DECRYPTING...</>
              ) : (
                <><ShieldCheck className="mr-2 h-5 w-5" /> VERIFY ACCESS TOKEN</>
              )}
            </Button>
            
            <div className="text-sm text-muted-foreground flex items-center justify-between w-full px-2">
              <button
                type="button"
                onClick={() => setStep("EMAIL")}
                className="hover:text-neon-cyan transition-colors"
                disabled={loading}
              >
                Abort & Return
              </button>
              <div className="flex items-center space-x-2">
                {resendTimer > 0 && (
                  <span className="font-mono text-electric-blue">{formatTime(resendTimer)}</span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    setOtp(["", "", "", "", "", ""]);
                    requestOTP(e);
                  }}
                  disabled={resendTimer > 0 || loading}
                  className="hover:text-neon-cyan transition-colors disabled:opacity-50 disabled:hover:text-muted-foreground font-medium"
                >
                  Regenerate
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </motion.div>
    </div>
  );
}
