"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type { ReviewStatusResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  processing: "secondary",
  completed: "default",
  failed: "destructive",
};

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [reviews, setReviews] = useState<ReviewStatusResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listReviews(50, 0).then((data) => {
      setReviews(data.reviews);
      setTotal(data.total);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <Button onClick={() => router.push(`/${locale}/review/new`)}>
          {t("dashboard.newReview")}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground">{t("dashboard.noReviews")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("dashboard.columns.id")}</TableHead>
              <TableHead>{t("dashboard.columns.status")}</TableHead>
              <TableHead>{t("dashboard.columns.files")}</TableHead>
              <TableHead>{t("dashboard.columns.date")}</TableHead>
              <TableHead>{t("dashboard.columns.cost")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((r) => (
              <TableRow
                key={r.review_id}
                className="cursor-pointer"
                onClick={() => router.push(`/${locale}/review/${r.review_id}`)}
              >
                <TableCell className="font-mono text-sm">
                  {r.review_id.slice(0, 8)}...
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status] || "outline"}>
                    {t(`dashboard.status.${r.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.result?.summary?.total_docs ?? "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {"-"}
                </TableCell>
                <TableCell>
                  {r.usage ? `$${r.usage.estimated_cost_usd.toFixed(3)}` : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
