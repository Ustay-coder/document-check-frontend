"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth";
import { LocaleSwitcher } from "./locale-switcher";
import { Button } from "@/components/ui/button";

export function Header({ locale }: { locale: string }) {
  const t = useTranslations();
  const { user, logout } = useAuthStore();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={`/${locale}/dashboard`} className="text-lg font-semibold">
          {t("common.appName")}
        </Link>
        <div className="flex items-center gap-2">
          {user && (
            <Link href={`/${locale}/settings/rule-templates`}>
              <Button variant="ghost" size="sm">
                {t("settings.ruleTemplates.title")}
              </Button>
            </Link>
          )}
          <LocaleSwitcher locale={locale} />
          {user && (
            <>
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={logout}>
                {t("common.logout")}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
