"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type { TemplateResponse, CustomChecklist } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTemplateDialog } from "@/components/create-template-dialog";
import { EditTemplateDialog } from "@/components/edit-template-dialog";
import { DeleteTemplateDialog } from "@/components/delete-template-dialog";

export default function RuleTemplatesPage() {
  const t = useTranslations("settings.ruleTemplates");
  const tc = useTranslations("common");

  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateResponse | null>(null);

  useEffect(() => {
    api
      .listTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(created: TemplateResponse) {
    setTemplates((prev) => [created, ...prev]);
  }

  function handleUpdated(updated: TemplateResponse) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t)),
    );
  }

  function handleDeleted(templateId: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>{t("create")}</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{tc("loading")}</p>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <p className="text-muted-foreground">{t("noTemplates")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("noTemplatesHint")}
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            {t("create")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((tmpl) => (
            <Card key={tmpl.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">{tmpl.name}</CardTitle>
                  {tmpl.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tmpl.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditTarget(tmpl)}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(tmpl)}
                  >
                    {tc("delete")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant={tmpl.rules?.mode === "replace" ? "destructive" : "secondary"}>
                  {tmpl.rules?.mode === "replace" ? t("modeReplace") : t("modeSupplement")}
                </Badge>

                {Array.isArray(tmpl.rules?.phase2_checklists) &&
                  (tmpl.rules.phase2_checklists as CustomChecklist[]).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t("phase2Checklists")}:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(tmpl.rules.phase2_checklists as CustomChecklist[]).map((c) => (
                          <Badge key={c.doc_type} variant="outline">
                            {t(`docTypes.${c.doc_type}`)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {typeof tmpl.rules?.cross_validation_rules === "string" &&
                  tmpl.rules.cross_validation_rules.trim() && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {t("crossValidationRules")}:
                      </p>
                      <p className="whitespace-pre-wrap text-sm line-clamp-3">
                        {tmpl.rules.cross_validation_rules as string}
                      </p>
                    </div>
                  )}

                {!Array.isArray(tmpl.rules?.phase2_checklists) &&
                  typeof tmpl.rules?.cross_validation_rules !== "string" && (
                    <p className="whitespace-pre-wrap text-sm">
                      {JSON.stringify(tmpl.rules, null, 2)}
                    </p>
                  )}

                <p className="text-xs text-muted-foreground">
                  {t("updatedAt")}: {new Date(tmpl.updated_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
      <EditTemplateDialog
        template={editTarget}
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        onUpdated={handleUpdated}
      />
      <DeleteTemplateDialog
        template={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
