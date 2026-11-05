"use client";

import { useId, useState } from "react";
import { Trash, X } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { Button, buttonClasses } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Table, Td, Th } from "@/components/ui/Table";
import { passwordProblem } from "@/lib/account";
import {
  NEW_USER_CODES,
  studentRowIssue,
  validateStudentRows,
  type AdminErrorCode,
  type StudentRowField,
} from "@/lib/adminUsers";
import { createStudents, parseStudents, type StudentRow } from "@/lib/api/adminUsers";
import { ApiRequestError, toKnownCode } from "@/lib/api/client";
import { MAX_TOTAL_BYTES } from "@/lib/api/ai";
import type { Group } from "@/types/group";
import type { ManagedUser } from "@/types/user";

const ACCEPT = ".docx,.xlsx,.txt";
const NAME_LENGTH = 60;
const LOGIN_LENGTH = 32;
// Said differently here: the common text for these codes is about quiz questions.
const OWN_ERRORS = ["UNSUPPORTED_FILE", "AI_NOT_CONFIGURED", "AI_FAILED"] as const;

type Row = StudentRow & { key: number };
type RowErrors = Partial<Record<StudentRowField, AdminErrorCode>>;

type BulkStudentsModalProps = {
  existing: readonly ManagedUser[];
  groups: readonly Group[];
  onClose: () => void;
  onAdded: (created: readonly ManagedUser[]) => void;
};

const isKnown = (code: string): code is AdminErrorCode => (NEW_USER_CODES as readonly string[]).includes(code);

/** A file or pasted text goes to the model; its proposal is corrected here, then all are added at once. */
export function BulkStudentsModal({ existing, groups, onClose, onAdded }: BulkStudentsModalProps) {
  const t = useTranslations("admin.bulk");
  const tf = useTranslations("admin.create");
  const te = useTranslations("admin.errors");
  const tcol = useTranslations("admin.columns");
  const tc = useTranslations("common");
  const fileId = useId();
  const textId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<readonly Row[] | null>(null);
  const [groupId, setGroupId] = useState("");
  const [password, setPassword] = useState("");
  const [rowErrors, setRowErrors] = useState<Readonly<Record<number, RowErrors>>>({});
  const [groupError, setGroupError] = useState<AdminErrorCode | null>(null);
  const [passwordError, setPasswordError] = useState<AdminErrorCode | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function message(failure: unknown): string {
    const code = toKnownCode(failure);
    const own = OWN_ERRORS.find((item) => item === code);
    return own ? t(`errors.${own}`) : tc(`apiError.${code}`);
  }

  async function read() {
    setFormError(null);
    if (file && file.size > MAX_TOTAL_BYTES) return setFormError(tc("apiError.FILE_TOO_LARGE"));
    setBusy(true);
    try {
      const proposal = await parseStudents(file, text);
      setRows(proposal.map((row, key) => ({ ...row, key })));
      setRowErrors({});
    } catch (failure) {
      setFormError(message(failure));
    }
    setBusy(false);
  }

  function change(key: number, field: StudentRowField, value: string) {
    setRows((current) => (current ?? []).map((row) => (row.key === key ? { ...row, [field]: value } : row)));
    setRowErrors((current) => ({ ...current, [key]: { ...current[key], [field]: undefined } }));
  }

  function validate(list: readonly Row[]): boolean {
    const found = validateStudentRows(list, existing);
    const problem: AdminErrorCode | null = password === "" ? "FIELD_REQUIRED" : passwordProblem(password);
    setRowErrors(Object.fromEntries(list.map((row, index) => [row.key, found[index]])));
    setGroupError(groupId ? null : "GROUP_REQUIRED");
    setPasswordError(problem);
    return Boolean(groupId) && !problem && found.every((errors) => Object.keys(errors).length === 0);
  }

  async function submit() {
    if (!rows) return;
    setFormError(null);
    if (!validate(rows)) return;
    setBusy(true);
    try {
      const students = rows.map(({ firstName, lastName, login }) => ({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        login: login.trim().toLowerCase(),
      }));
      onAdded(await createStudents({ groupId, password, students }));
    } catch (failure) {
      // The server checks the same rules, and more: its answer shows where it belongs.
      const placed = failure instanceof ApiRequestError && place(failure, rows);
      if (!placed) setFormError(message(failure));
      setBusy(false);
    }
  }

  function place(failure: ApiRequestError, list: readonly Row[]): boolean {
    if (failure.field === "password" && isKnown(failure.code)) {
      setPasswordError(failure.code);
      return true;
    }
    const next: Record<number, RowErrors> = {};
    for (const issue of failure.issues) {
      const where = studentRowIssue(issue.field);
      const row = where ? list[where.index] : undefined;
      if (!where || !row || !isKnown(issue.code)) return false;
      next[row.key] = { ...next[row.key], [where.field]: issue.code };
    }
    setRowErrors(next);
    return failure.issues.length > 0;
  }

  const error = formError ? (
    <p role="alert" className="text-body font-bold text-danger-text">
      {formError}
    </p>
  ) : null;

  if (rows === null) {
    return (
      <Modal
        open
        wide
        onClose={busy ? () => undefined : onClose}
        title={t("title")}
        actions={
          <>
            <Button variant="neutral" disabled={busy} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button variant="success" disabled={busy || (!file && text.trim() === "")} onClick={() => void read()}>
              {busy ? <Spinner label={t("reading")} /> : null}
              {t(busy ? "reading" : "read")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={fileId} className={buttonClasses({ variant: "secondary" })}>
              {t("pickFile")}
            </label>
            <input
              id={fileId}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                event.target.value = "";
                setFormError(null);
              }}
            />
            {file ? (
              <span className="flex min-w-0 items-center gap-3 rounded-md bg-surface px-3">
                <span className="min-w-0 font-bold [overflow-wrap:anywhere]">{file.name}</span>
                <IconButton
                  label={t("removeFile", { name: file.name })}
                  title={t("removeFile", { name: file.name })}
                  disabled={busy}
                  onClick={() => setFile(null)}
                >
                  <X weight="bold" size={22} aria-hidden="true" />
                </IconButton>
              </span>
            ) : (
              <span className="text-body text-ink-muted">{t("fileKinds")}</span>
            )}
          </div>
          {file ? null : (
            <div className="flex flex-col gap-2">
              <label htmlFor={textId} className="text-body font-bold text-ink">
                {t("pasteLabel")}
              </label>
              <textarea
                id={textId}
                value={text}
                rows={8}
                disabled={busy}
                onChange={(event) => {
                  setText(event.target.value);
                  setFormError(null);
                }}
                className="w-full resize-y rounded-md border-2 border-field-border bg-field px-4 py-3 text-body text-on-field focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              />
            </div>
          )}
          {error}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      wide
      onClose={busy ? () => undefined : onClose}
      title={t("title")}
      actions={
        <>
          <Button variant="neutral" disabled={busy} onClick={() => setRows(null)}>
            {t("back")}
          </Button>
          <Button variant="success" disabled={busy || rows.length === 0} onClick={() => void submit()}>
            {t("submit", { count: rows.length })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-4">
          <Select
            label={tf("group")}
            wrapperClassName="w-full max-w-[280px]"
            value={groupId}
            disabled={busy}
            onChange={(event) => {
              setGroupId(event.target.value);
              setGroupError(null);
            }}
            error={groupError ? te(groupError) : undefined}
          >
            <option value="" disabled>
              {tf("groupPick")}
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
          <Input
            label={t("password")}
            value={password}
            disabled={busy}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(null);
            }}
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            wrapperClassName="w-full max-w-[280px]"
            error={passwordError ? te(passwordError) : undefined}
          />
        </div>
        <div className="max-h-[45dvh] overflow-y-auto">
          <Table className="min-w-[640px]">
            <thead>
              <tr>
                <Th>{tf("lastName")}</Th>
                <Th>{tf("firstName")}</Th>
                <Th className="w-2/5">{tf("login")}</Th>
                <Th>
                  <span className="sr-only">{tcol("actions")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key}>
                  {(["lastName", "firstName", "login"] as const).map((field) => {
                    const code = rowErrors[row.key]?.[field];
                    return (
                      <Td key={field} className="px-2 py-2 align-top">
                        <Input
                          hideLabel
                          label={`${tf(field)}, ${index + 1}`}
                          value={row[field]}
                          disabled={busy}
                          maxLength={field === "login" ? LOGIN_LENGTH : NAME_LENGTH}
                          autoComplete="off"
                          autoCapitalize={field === "login" ? "none" : undefined}
                          spellCheck={false}
                          onChange={(event) => change(row.key, field, event.target.value)}
                          error={code ? te(code) : undefined}
                        />
                      </Td>
                    );
                  })}
                  <Td className="px-2 py-2 align-top">
                    <IconButton
                      label={t("removeRow", { number: index + 1 })}
                      title={t("removeRow", { number: index + 1 })}
                      disabled={busy}
                      onClick={() => setRows(rows.filter((item) => item.key !== row.key))}
                    >
                      <Trash weight="bold" size={22} aria-hidden="true" />
                    </IconButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        {error}
      </div>
    </Modal>
  );
}
