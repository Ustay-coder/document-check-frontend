"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { TemplateResponse, CustomChecklist } from "@/lib/types";
import { DOC_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface EditTemplateDialogProps {
  template: TemplateResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (template: TemplateResponse) => void;
}

export function EditTemplateDialog({
  template,
  open,
  onOpenChange,
  onUpdated,
}: EditTemplateDialogProps) {
  const t = useTranslations("settings.ruleTemplates");
  const tc = useTranslations("common");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"supplement" | "replace">("supplement");
  const [checklists, setChecklists] = useState<CustomChecklist[]>([]);
  const [crossValidationRules, setCrossValidationRules] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (template) {
      const rules = template.rules;
      setName(template.name);
      setDescription(template.description ?? "");
      setMode(rules?.mode === "replace" ? "replace" : "supplement");
      setChecklists(
        Array.isArray(rules?.phase2_checklists)
          ? (rules.phase2_checklists as CustomChecklist[]).map((c) => ({
              doc_type: c.doc_type,
              checklist_md: c.checklist_md,
            }))
          : [],
      );
      setCrossValidationRules(
        typeof rules?.cross_validation_rules === "string"
          ? (rules.cross_validation_rules as string)
          : "",
      );
      setError("");
    }
  }, [template]);

  function addChecklist() {
    setChecklists((prev) => [...prev, { doc_type: "", checklist_md: "" }]);
  }

  function removeChecklist(index: number) {
    setChecklists((prev) => prev.filter((_, i) => i !== index));
  }

  function updateChecklist(index: number, field: keyof CustomChecklist, value: string) {
    setChecklists((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  const usedDocTypes = checklists.map((c) => c.doc_type);

  const hasContent =
    checklists.some((c) => c.doc_type && c.checklist_md.trim()) ||
    crossValidationRules.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!template) return;
    setError("");
    setLoading(true);

    try {
      const rules: Record<string, unknown> = { mode };

      const validChecklists = checklists.filter(
        (c) => c.doc_type && c.checklist_md.trim(),
      );
      if (validChecklists.length > 0) {
        rules.phase2_checklists = validChecklists;
      }
      if (crossValidationRules.trim()) {
        rules.cross_validation_rules = crossValidationRules;
      }

      const updated = await api.updateTemplate(template.id, {
        name,
        description: description || null,
        rules,
      });
      onUpdated(updated);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to update template");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("edit")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="space-y-2">
            <Label htmlFor="edit-name">{t("name")}</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">{t("templateDescription")}</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>{t("mode")}</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "supplement" | "replace")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="supplement" id="edit-mode-supplement" />
                <Label htmlFor="edit-mode-supplement" className="font-normal">
                  {t("modeSupplement")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="replace" id="edit-mode-replace" />
                <Label htmlFor="edit-mode-replace" className="font-normal">
                  {t("modeReplace")}
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {mode === "supplement" ? t("modeSupplementHint") : t("modeReplaceHint")}
            </p>
          </div>

          <Tabs defaultValue="phase2">
            <TabsList>
              <TabsTrigger value="phase2">{t("phase2Checklists")}</TabsTrigger>
              <TabsTrigger value="cross">{t("crossValidationRules")}</TabsTrigger>
            </TabsList>

            <TabsContent value="phase2" className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">{t("phase2Hint")}</p>

              {checklists.map((item, index) => (
                <div key={index} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <Select
                        value={item.doc_type}
                        onValueChange={(v) => updateChecklist(index, "doc_type", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("docTypePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {DOC_TYPES.filter(
                            (dt) => dt === item.doc_type || !usedDocTypes.includes(dt),
                          ).map((dt) => (
                            <SelectItem key={dt} value={dt}>
                              {t(`docTypes.${dt}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChecklist(index)}
                    >
                      {tc("delete")}
                    </Button>
                  </div>
                  <Textarea
                    value={item.checklist_md}
                    onChange={(e) => updateChecklist(index, "checklist_md", e.target.value)}
                    placeholder={t("checklistPlaceholder")}
                    rows={4}
                  />
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addChecklist}
                disabled={checklists.length >= DOC_TYPES.length}
              >
                {t("addDocType")}
              </Button>
            </TabsContent>

            <TabsContent value="cross" className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">{t("crossValidationHint")}</p>
              <Textarea
                value={crossValidationRules}
                onChange={(e) => setCrossValidationRules(e.target.value)}
                placeholder={t("rulesPlaceholder")}
                rows={6}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || !hasContent || loading}>
              {t("edit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
