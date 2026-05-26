"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { auth } from "@/lib/firebase";
import api from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Phone, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const router = useRouter();
  const setToken = useAuthStore((state) => state.setToken);
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendTimer > 0) {
      timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendTimer]);

  useEffect(() => {
    // Clear recaptcha on mount (e.g. after logout) and unmount
    clearRecaptcha();
    return () => clearRecaptcha();
  }, []);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
  };

  const clearRecaptcha = () => {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = undefined;
    }
  };

  const requestOTP = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    if (!phoneNumber) return setError("Please enter a valid phone number");

    setLoading(true);
    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      setStep("OTP");
      setResendTimer(60);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp || otp.length < 6) return setError("Please enter a valid 6-digit OTP");
    if (!confirmationResult) return setError("Please request OTP first");

    setLoading(true);
    try {
      // 1. Verify OTP with Firebase
      const result = await confirmationResult.confirm(otp);
      
      // 2. Get ID Token
      const idToken = await result.user.getIdToken();

      // 3. Authenticate with backend
      const { data } = await api.post("/auth/verify-phone", { idToken, username, email });
      
      setToken(data.token);
      await initialize();
      router.push("/chat");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/invalid-verification-code") {
        setError("Invalid OTP. Please try again.");
      } else {
        setError(err.response?.data?.message || "Failed to verify. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 items-center">
          <div className="w-24 h-24 flex items-center justify-center mb-2">
            <Image src="/logo.png" alt="Zyphora Logo" width={96} height={96} className="object-contain rounded-2xl" priority />
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === "PHONE" ? "Enter your phone number" : "Verify your number"}
          </CardTitle>
          <CardDescription className="text-center">
            {step === "PHONE" 
              ? "We'll send an SMS with a confirmation code to verify your identity." 
              : `We sent a 6-digit code to ${phoneNumber}`}
          </CardDescription>
        </CardHeader>
        
        {step === "PHONE" ? (
          <form onSubmit={requestOTP}>
            <CardContent className="space-y-4">
              {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
              
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Your Name (Optional)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Email Address (Optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2 phone-input-container">
                {/* We use global CSS to style react-phone-number-input to match ShadCN */}
                <PhoneInput
                  international
                  defaultCountry="IN"
                  value={phoneNumber}
                  onChange={(val) => setPhoneNumber(val || "")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div id="recaptcha-container"></div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" type="submit" disabled={loading || !phoneNumber}>
                {loading ? "Sending OTP..." : "Continue"}
                {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={verifyOTP}>
            <CardContent className="space-y-4">
              {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
              <div className="space-y-2">
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center tracking-widest text-lg"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button className="w-full" type="submit" disabled={loading || otp.length < 6}>
                {loading ? "Verifying..." : "Verify & Sign In"}
              </Button>
              <div className="text-sm text-center text-muted-foreground flex items-center justify-between w-full">
                <button 
                  type="button" 
                  onClick={() => {
                    clearRecaptcha();
                    setStep("PHONE");
                  }}
                  className="hover:underline text-primary"
                  disabled={loading}
                >
                  Change Number
                </button>
                <button 
                  type="button"
                  onClick={() => requestOTP()}
                  disabled={resendTimer > 0 || loading}
                  className="hover:underline text-primary disabled:opacity-50 disabled:hover:no-underline"
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                </button>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
