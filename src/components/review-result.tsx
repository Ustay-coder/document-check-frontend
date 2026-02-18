"use client";

import { useTranslations } from "next-intl";
import type { ReviewResult, Usage } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const STATUS_ICON: Record<string, string> = {
  pass: "✅",
  warning: "⚠️",
  fail: "❌",
};

interface ReviewResultViewProps {
  result: ReviewResult;
  usage: Usage | null;
  reviewId: string;
  onNewReview: () => void;
}

export function ReviewResultView({
  result,
  usage,
  reviewId,
  onNewReview,
}: ReviewResultViewProps) {
  const t = useTranslations("review");

  function downloadJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `review-${reviewId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const { summary } = result;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-center text-lg font-medium text-green-600">
        ✅ {t("completed")}
      </p>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {summary.passed}
              </p>
              <p className="text-sm text-muted-foreground">{t("passed")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {summary.warnings}
              </p>
              <p className="text-sm text-muted-foreground">{t("warnings")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {summary.failures}
              </p>
              <p className="text-sm text-muted-foreground">{t("failures")}</p>
            </div>
          </div>

          {summary.opinion && (
            <p className="mb-4 text-sm">{summary.opinion}</p>
          )}

          {summary.critical_issues.map((issue, i) => (
            <p key={i} className="mb-1 text-sm text-red-600">
              ❌ {issue}
            </p>
          ))}
          {summary.action_required.map((action, i) => (
            <p key={i} className="mb-1 text-sm text-yellow-600">
              ⚠️ {action}
            </p>
          ))}
        </CardContent>
      </Card>

      {/* Document Details */}
      <Accordion type="single" collapsible>
        <AccordionItem value="documents">
          <AccordionTrigger>{t("documents")}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {result.documents.map((doc, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span>{STATUS_ICON[doc.status]}</span>
                      <span className="font-medium">{doc.doc_type}</span>
                      <span className="text-sm text-muted-foreground">
                        ({doc.filename})
                      </span>
                    </div>

                    {/* Extracted data */}
                    {Object.keys(doc.extracted_data).length > 0 && (
                      <div className="mb-3 rounded bg-muted p-3">
                        {Object.entries(doc.extracted_data).map(
                          ([key, val]) => (
                            <div key={key} className="flex gap-2 text-sm">
                              <span className="font-medium">{key}:</span>
                              <span>{String(val)}</span>
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    {/* Checklist */}
                    {doc.checklist.map((item, j) => (
                      <div key={j} className="mb-1 text-sm">
                        <span>{STATUS_ICON[item.status]}</span>{" "}
                        <span className="font-medium">{item.item}</span>
                        {item.detail && (
                          <span className="text-muted-foreground">
                            {" "}
                            — {item.detail}
                          </span>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Cross-Validation */}
        <AccordionItem value="cross-validation">
          <AccordionTrigger>{t("crossValidation")}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {result.cross_validation.map((item, i) => (
                <div key={i} className="text-sm">
                  <span>{STATUS_ICON[item.status]}</span>{" "}
                  <span className="font-medium">{item.description}</span>
                  {item.details && (
                    <p className="ml-6 text-muted-foreground">
                      {item.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Usage + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          {usage && (
            <>
              <span>
                💰 ${usage.estimated_cost_usd.toFixed(3)}
              </span>
              <span>
                ⏱ {Math.round(usage.duration_seconds)}{t("seconds")}
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadJson}>
            {t("downloadJson")}
          </Button>
        </div>
      </div>

      <Button className="w-full" size="lg" onClick={onNewReview}>
        {t("newReview")}
      </Button>
    </div>
  );
}
