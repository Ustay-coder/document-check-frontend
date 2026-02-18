"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { POLL_INTERVAL_MS } from "@/lib/config";
import type { ReviewStatusResponse } from "@/lib/types";
import { ReviewProgressView } from "@/components/review-progress";
import { ReviewResultView } from "@/components/review-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ReviewDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale, id } = useParams<{ locale: string; id: string }>();

  const [review, setReview] = useState<ReviewStatusResponse | null>(null);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function poll() {
      api
        .getReview(id)
        .then((data) => {
          setReview(data);
          if (data.status === "completed" || data.status === "failed") {
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        })
        .catch((err) => {
          setError(err.message || "Failed to fetch review");
          if (intervalRef.current) clearInterval(intervalRef.current);
        });
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  if (error) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-red-600">❌ {error}</p>
          <Button onClick={() => router.push(`/${locale}/dashboard`)}>
            {t("common.back")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!review) {
    return (
      <div className="flex justify-center pt-20">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (review.status === "processing" || review.status === "pending") {
    return (
      <ReviewProgressView
        progress={
          review.progress || {
            phase: "phase1_preprocess",
            detail: "",
            completed_groups: 0,
            total_groups: 0,
          }
        }
        fileCount={review.result?.summary?.total_docs}
      />
    );
  }

  if (review.status === "failed") {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-lg font-medium text-red-600">
            ❌ {t("review.failed")}
          </p>
          <p className="text-sm text-muted-foreground">{review.error}</p>
          <Button onClick={() => router.push(`/${locale}/review/new`)}>
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (review.status === "completed" && review.result) {
    return (
      <ReviewResultView
        result={review.result}
        usage={review.usage}
        reviewId={review.review_id}
        onNewReview={() => router.push(`/${locale}/review/new`)}
      />
    );
  }

  return null;
}
