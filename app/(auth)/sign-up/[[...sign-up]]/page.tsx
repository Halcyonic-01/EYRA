"use client";

import { SignUp } from "@clerk/nextjs";

import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { authAppearance } from "@/lib/auth-appearance";

export default function SignUpPage() {
  return (
    <AuthOverlay>
      <SignUp appearance={authAppearance} signInUrl="/sign-in" fallbackRedirectUrl="/" />
    </AuthOverlay>
  );
}
