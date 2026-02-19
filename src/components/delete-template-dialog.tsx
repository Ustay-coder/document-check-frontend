"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { TemplateResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeleteTemplateDialogProps {
  template: TemplateResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (templateId: string) => void;
}

export function DeleteTemplateDialog({
  template,
  open,
  onOpenChange,
  onDeleted,
}: DeleteTemplateDialogProps) {
  const t = useTranslations("settings.ruleTemplates");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!template) return;
    setError("");
    setLoading(true);

    try {
      await api.deleteTemplate(template.id);
      onDeleted(template.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to delete template");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteConfirm")}</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{template?.name}</span>
            <br />
            {t("deleteWarning")}
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {tc("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
