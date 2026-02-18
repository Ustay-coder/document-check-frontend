"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useParams<{ locale: string }>();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("token", token);
      api.getMe().then((user) => {
        setAuth(token, user);
        router.replace(`/${locale}/dashboard`);
      }).catch(() => {
        router.replace(`/${locale}/auth/login`);
      });
    } else {
      router.replace(`/${locale}/auth/login`);
    }
  }, [searchParams, router, locale, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Authenticating...</p>
    </div>
  );
}
