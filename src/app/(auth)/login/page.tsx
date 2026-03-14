import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[400px] flex flex-col items-center gap-8">
          <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-[#b8e6d5] to-[#ffe8b8] animate-pulse" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
