"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale() {
    const newLocale = locale === "ko" ? "en" : "ko";
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  }

  return (
    <Button variant="ghost" size="sm" onClick={switchLocale}>
      {locale === "ko" ? "EN" : "KR"}
    </Button>
  );
}
