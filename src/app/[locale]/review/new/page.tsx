"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { TemplateResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropzone } from "@/components/file-dropzone";

export default function NewReviewPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [files, setFiles] = useState<File[]>([]);
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  async function handleStartReview() {
    if (files.length === 0) return;
    setError("");
    setLoading(true);

    try {
      // 1. Get presigned URLs
      const presignRes = await api.presign(
        files.map((f) => f.name),
        selectedTemplate || undefined,
      );

      // 2. Upload files to R2 in parallel
      await Promise.all(
        presignRes.files.map(({ upload_url }, i) =>
          fetch(upload_url, { method: "PUT", body: files[i] }),
        ),
      );

      // 3. Start review
      await api.startReview(presignRes.review_id);

      // 4. Navigate to review detail
      router.push(`/${locale}/review/${presignRes.review_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Upload failed");
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{t("upload.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <FileDropzone files={files} onFilesChange={setFiles} />

        {templates.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("upload.template")}
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">{t("upload.templateNone")}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={files.length === 0 || loading}
          onClick={handleStartReview}
        >
          {loading ? t("upload.uploading") : t("upload.startReview")}
        </Button>
      </CardContent>
    </Card>
  );
}
