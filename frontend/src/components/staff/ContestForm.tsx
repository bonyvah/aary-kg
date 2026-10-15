"use client";

import { useHomePath } from "./SessionProvider";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Trash } from "@phosphor-icons/react/ssr";
import { Check, Cross } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/useToast";
import { listDirectory } from "@/lib/api/users";
import { knownCode } from "@/lib/api/client";
import { weightsTotal } from "@/lib/contestScoring";
import { weightValue } from "@/lib/contestForm/reducer";
import { useContestForm } from "@/lib/contestForm/useContestForm";
import { ResourceView, useResource } from "./Resource";

export function ContestForm() {
  const t = useTranslations("contest.form");
  const home = useHomePath();
  const te = useTranslations("contest.errors");
  const tc = useTranslations("common");
  const { state, send, save, saving } = useContestForm();
  const directory = useResource(listDirectory);
  const { toast, show } = useToast();

  useEffect(() => {
    if (!state.saveResult) return;
    show(
      "danger",
      state.saveResult === "invalid" ? t("saveFailed") : tc(`apiError.${knownCode(state.failedCode ?? "UNKNOWN")}`),
    );
    send({ type: "SAVE_RESULT_SEEN" });
  }, [state.saveResult, state.failedCode, show, send, t, tc]);

  const errorFor = (field: string) => {
    const issue = state.issues.find((item) => item.field === field);
    return issue ? te(issue.code) : undefined;
  };

  const total = weightsTotal(state.criteria.map((c) => ({ weight: weightValue(c.weight) || 0 })));
  const totalOk = total === 100;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-surface-raised">
        <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <ButtonLink href={home} variant="secondary">
            {t("back")}
          </ButtonLink>
          <div className="min-w-[200px] flex-1">
            <Input
              hideLabel
              label={t("titleLabel")}
              placeholder={t("titleLabel")}
              value={state.title}
              maxLength={200}
              onChange={(event) => send({ type: "TITLE_CHANGED", value: event.target.value })}
              error={errorFor("title")}
            />
          </div>
          <Button variant="success" disabled={saving} onClick={() => void save()}>
            {t("save")}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-8 p-4 md:p-6">
        <Input
          label={t("descriptionLabel")}
          value={state.description}
          maxLength={1000}
          onChange={(event) => send({ type: "DESCRIPTION_CHANGED", value: event.target.value })}
        />

        <section className="flex flex-col gap-3" aria-labelledby="criteria-title">
          <h2 id="criteria-title" className="text-h2 font-bold">
            {t("criteria.title")}
          </h2>
          <p className="text-body text-ink-muted">{t("criteria.hint")}</p>
          <ul className="flex flex-col gap-4">
            {state.criteria.map((criterion) => (
              <li key={criterion.id} className="grid items-end gap-3 sm:grid-cols-[1fr_140px_auto]">
                <Input
                  label={t("criteria.name")}
                  value={criterion.name}
                  maxLength={100}
                  onChange={(event) => send({ type: "CRITERION_CHANGED", id: criterion.id, field: "name", value: event.target.value })}
                  error={errorFor(`criterion:${criterion.id}:name`)}
                />
                <Input
                  label={t("criteria.weight")}
                  inputMode="numeric"
                  value={criterion.weight}
                  onChange={(event) =>
                    send({ type: "CRITERION_CHANGED", id: criterion.id, field: "weight", value: event.target.value.replace(/\D/g, "").slice(0, 3) })
                  }
                />
                <IconButton label={t("criteria.remove")} onClick={() => send({ type: "CRITERION_REMOVED", id: criterion.id })}>
                  <Icon icon={Trash} weight="bold" />
                </IconButton>
              </li>
            ))}
          </ul>
          <p
            aria-live="polite"
            className={`flex items-center gap-2 text-body font-bold ${totalOk ? "text-success-text" : "text-danger-text"}`}
          >
            {totalOk ? <Check width={20} height={20} /> : <Cross width={20} height={20} />}
            {t("criteria.total", { total })} {totalOk ? t("criteria.totalOk") : t("criteria.totalBad")}
          </p>
          {errorFor("criteria") ? <p className="text-caption font-bold text-danger-text">{errorFor("criteria")}</p> : null}
          <div>
            <Button variant="neutral" onClick={() => send({ type: "CRITERION_ADDED" })}>
              {t("criteria.add")}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="entries-title">
          <h2 id="entries-title" className="text-h2 font-bold">
            {t("entries.title")}
          </h2>
          <ul className="flex flex-col gap-4">
            {state.entries.map((entry) => (
              <li key={entry.id} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  label={t("entries.name")}
                  value={entry.name}
                  maxLength={100}
                  onChange={(event) => send({ type: "ENTRY_CHANGED", id: entry.id, field: "name", value: event.target.value })}
                  error={errorFor(`entry:${entry.id}:name`)}
                />
                <Input
                  label={t("entries.description")}
                  value={entry.description}
                  maxLength={500}
                  onChange={(event) => send({ type: "ENTRY_CHANGED", id: entry.id, field: "description", value: event.target.value })}
                />
                <IconButton label={t("entries.remove")} onClick={() => send({ type: "ENTRY_REMOVED", id: entry.id })}>
                  <Icon icon={Trash} weight="bold" />
                </IconButton>
              </li>
            ))}
          </ul>
          {errorFor("entries") ? <p className="text-caption font-bold text-danger-text">{errorFor("entries")}</p> : null}
          <div>
            <Button variant="neutral" onClick={() => send({ type: "ENTRY_ADDED" })}>
              {t("entries.add")}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3 pb-6" aria-labelledby="jury-title">
          <h2 id="jury-title" className="text-h2 font-bold">
            {t("jury.title")}
          </h2>
          <p className="text-body text-ink-muted">{t("jury.hint")}</p>
          <ResourceView resource={directory} inline>
            {(people) => (
              <ul className="grid gap-1 sm:grid-cols-2">
                {people.map((person) => (
                  <li key={person.id}>
                    <Checkbox
                      label={person.name}
                      hint={person.login}
                      checked={state.juryIds.includes(person.id)}
                      onChange={() => send({ type: "JURY_TOGGLED", userId: person.id })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </ResourceView>
          {errorFor("jury") ? <p className="text-caption font-bold text-danger-text">{errorFor("jury")}</p> : null}
        </section>
      </main>
      {toast}
    </div>
  );
}
