"use client";

import { useTranslations } from "next-intl";
import type { ReviewProgress } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

interface ReviewProgressViewProps {
  progress: ReviewProgress;
  fileCount?: number;
}

export function ReviewProgressView({
  progress,
  fileCount,
}: ReviewProgressViewProps) {
  const t = useTranslations("review");

  const phases = [
    { key: "phase1_preprocess", label: t("phase1") },
    { key: "phase2_extraction", label: t("phase2") },
    { key: "phase3_cross_validation", label: t("phase3") },
  ];

  function getPhaseStatus(phaseKey: string) {
    const currentIdx = phases.findIndex((p) => progress.phase.includes(p.key.split("_")[0]));
    const thisIdx = phases.findIndex((p) => p.key === phaseKey);

    if (thisIdx < currentIdx) return "done";
    if (thisIdx === currentIdx) return "active";
    return "pending";
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="space-y-4 pt-6">
        <p className="text-center text-lg font-medium">
          {t("processing", { count: fileCount || "?" })}
        </p>

        <div className="space-y-3">
          {phases.map((phase) => {
            const status = getPhaseStatus(phase.key);
            return (
              <div key={phase.key} className="flex items-center gap-3">
                <span className="w-6 text-center">
                  {status === "done" && "✅"}
                  {status === "active" && "🔄"}
                  {status === "pending" && "⏳"}
                </span>
                <span
                  className={
                    status === "active" ? "font-medium" : "text-muted-foreground"
                  }
                >
                  {phase.label}
                </span>
                {status === "active" &&
                  progress.total_groups > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {progress.completed_groups}/{progress.total_groups}
                    </span>
                  )}
              </div>
            );
          })}
        </div>

        {progress.detail && (
          <p className="text-center text-sm text-muted-foreground">
            {progress.detail}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
