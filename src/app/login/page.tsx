import { SignIn } from "@clerk/nextjs";
import { Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

// Auth page — keep it out of the index (FAT audit P3). Links are still followed.
export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#1C1917] flex items-center justify-center px-6 pt-24 pb-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <Globe className="w-10 h-10 text-[#D4836A]" />
          </Link>
          <h1 className="text-3xl font-semibold mb-2 text-[#FAF9F6]">Welcome Back</h1>
          <p className="text-[#A8A29E]">Sign in to your account</p>
        </div>

        <div className="flex justify-center">
          <SignIn
            fallbackRedirectUrl="/community"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-[#2D2926] border border-white/[0.06] shadow-none",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "bg-[#1C1917] border border-white/[0.08] text-[#FAF9F6] hover:bg-[#3D3936]",
                formFieldInput:
                  "bg-[#1C1917] border border-white/[0.08] text-[#FAF9F6] focus:border-[#D4836A]",
                formFieldLabel: "text-[#A8A29E]",
                formButtonPrimary: "bg-[#D4836A] hover:bg-[#E09880] text-[#1C1917]",
                footerActionLink: "text-[#D4836A] hover:text-[#E09880]",
                dividerLine: "bg-white/[0.08]",
                dividerText: "text-[#78716C]",
              },
            }}
          />
        </div>

        <p className="text-center mt-6 text-[#A8A29E] text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#D4836A] hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
