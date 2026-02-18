"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
];

interface FileDropzoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export function FileDropzone({ files, onFilesChange }: FileDropzoneProps) {
  const t = useTranslations("upload");
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files).filter((f) =>
        ACCEPTED_TYPES.includes(f.type),
      );
      onFilesChange([...files, ...dropped]);
    },
    [files, onFilesChange],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selected = Array.from(e.target.files);
        onFilesChange([...files, ...selected]);
      }
    },
    [files, onFilesChange],
  );

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25"
        }`}
      >
        <p className="mb-2 text-lg font-medium">{t("dropzone")}</p>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("dropzoneHint")}
        </p>
        <label>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileInput}
            className="hidden"
          />
          <Button variant="outline" asChild>
            <span>Browse files</span>
          </Button>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">
            {t("filesSelected", { count: files.length })}
          </p>
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded border px-3 py-2 text-sm"
            >
              <span className="truncate">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(i)}
                className="ml-2 h-6 px-2 text-muted-foreground"
              >
                x
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
