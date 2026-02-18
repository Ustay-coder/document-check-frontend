import { Header } from "@/components/header";
import { AuthGuard } from "@/components/auth-guard";

export default async function ReviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <AuthGuard locale={locale}>
      <Header locale={locale} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </AuthGuard>
  );
}
