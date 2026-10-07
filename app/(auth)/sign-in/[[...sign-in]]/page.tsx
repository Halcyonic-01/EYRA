"use client";

import { SignIn } from "@clerk/nextjs";

import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { authAppearance } from "@/lib/auth-appearance";

export default function SignInPage() {
  return (
    <AuthOverlay>
      <SignIn appearance={authAppearance} signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </AuthOverlay>
  );
}
