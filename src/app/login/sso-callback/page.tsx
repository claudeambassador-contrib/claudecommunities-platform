import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen bg-[#1C1917] flex items-center justify-center">
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/community"
        signUpFallbackRedirectUrl="/community"
      />
    </div>
  );
}
