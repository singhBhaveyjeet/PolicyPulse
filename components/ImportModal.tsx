"use client";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, CloudUpload, FileSpreadsheet, FileText, ShieldCheck, X } from "lucide-react";
import type { ImportRecord, Policy } from "@/lib/types";
import { applyBuild, buildPolicies, type DuplicateMode } from "@/lib/build";
import { downloadRows, readSpreadsheet, type ParsedSheet } from "@/lib/importer";
import { FIELD_KEYS, FIELD_LABELS, REQUIRED_FIELDS, autoMapHeaders, guessInsurerFromName, guessTypeFromName } from "@/lib/normalize";
import { dateLabel, money } from "@/lib/analysis";
import { InlineSpinner } from "./Loading";

export type ImportSummary = { sheets: number; added: number; updated: number; unchanged: number; rejected: number };

type Source = {
  id: string;
  fileName: string;
  sheet: ParsedSheet;
  include: boolean;
  mapping: Record<string, string>;
  defaultInsurer: string;
  defaultType: string;
};

const ready = (s: Source) => REQUIRED_FIELDS.every((f) => s.mapping[f]);

type Props = {
  existing: Policy[];
  onCloseAction: () => void;
  onDoneAction: (policies: Policy[], records: ImportRecord[], summary: ImportSummary) => Promise<void>;
};

type ImportProgress = {
  stage: string;
  filesProcessed: number;
  filesTotal: number;
  worksheets: number;
  rowsProcessed: number;
  validRecords: number;
  invalidRecords: number;
  duplicates: number;
};

const EMPTY_PROGRESS: ImportProgress = {
  stage: "",
  filesProcessed: 0,
  filesTotal: 0,
  worksheets: 0,
  rowsProcessed: 0,
  validRecords: 0,
  invalidRecords: 0,
  duplicates: 0,
};

const yieldToBrowser = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export default function ImportModal({ existing, onCloseAction, onDoneAction }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [activeId, setActiveId] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [problems, setProblems] = useState<string[]>([]);
  const [mode, setMode] = useState<DuplicateMode>("update");
  const [dragging, setDragging] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<ImportSummary | null>(null);

  const current = sources.find((s) => s.id === activeId) ?? sources[0];

  async function handleFiles(files: FileList | File[] | null) {
    const list = Array.from(files ?? []);
    if (!list.length || busy) return;
    setBusy(true);
    setProblems([]);
    setProgress({ ...EMPTY_PROGRESS, stage: "Reading uploaded files", filesTotal: list.length });
    const found: Source[] = [];
    const errs: string[] = [];
    let worksheets = 0;
    for (let index = 0; index < list.length; index++) {
      const f = list[index];
      setProgress((currentProgress) => ({ ...currentProgress, stage: `Reading file and detecting worksheets · ${f.name}` }));
      await yieldToBrowser();
      try {
        const sheets = (await readSpreadsheet(f)).filter((s) => s.rows.length > 0);
        if (!sheets.length) { errs.push(`${f.name}: no data rows found. Column titles should be followed by policy rows.`); continue; }
        worksheets += sheets.length;
        setProgress((currentProgress) => ({ ...currentProgress, worksheets }));
        for (const sheet of sheets) {
          setProgress((currentProgress) => ({ ...currentProgress, stage: `Identifying column headers · ${sheet.name}` }));
          await yieldToBrowser();
          const mapping = autoMapHeaders(sheet.headers);
          found.push({
            id: `${f.name}::${sheet.name}`, fileName: f.name, sheet, mapping,
            include: REQUIRED_FIELDS.every((k) => mapping[k]),
            defaultInsurer: guessInsurerFromName(f.name), defaultType: guessTypeFromName(f.name),
          });
        }
      } catch (error) {
        const detail = error instanceof Error ? ` ${error.message}` : "";
        errs.push(`${f.name}: could not be read. Please use a valid .xlsx, .xls or .csv file.${detail}`);
      } finally {
        setProgress((currentProgress) => ({ ...currentProgress, filesProcessed: index + 1, worksheets }));
      }
    }
    setSources((prev) => {
      const have = new Set(prev.map((s) => s.id));
      return [...prev, ...found.filter((s) => !have.has(s.id))];
    });
    if (found.length && !sources.length) setActiveId(found[0].id);
    setProblems(errs);
    setBusy(false);
    setProgress((currentProgress) => ({ ...currentProgress, stage: "" }));
    if (inputRef.current) inputRef.current.value = "";
  }

  const patch = (id: string, change: Partial<Source>) => setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...change } : s)));
  const remove = (id: string) => setSources((prev) => prev.filter((s) => s.id !== id));

  const options = current && {
    mapping: current.mapping, fileName: current.fileName, sheetName: current.sheet.name,
    defaultInsurer: current.defaultInsurer, defaultType: current.defaultType,
  };
  const dry = useMemo(() => (current && options ? buildPolicies(current.sheet.rows, { ...options, existing }) : null), [current, existing]); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = useMemo(() => (current && options && !dry?.missingRequired.length ? buildPolicies(current.sheet.rows.slice(0, 5), { ...options, existing: [] }) : null), [current, dry]); // eslint-disable-line react-hooks/exhaustive-deps

  const toImport = sources.filter((s) => s.include && ready(s));

  async function runImport() {
    if (busy || !toImport.length) return;
    setBusy(true);
    setProblems([]);
    let policies = existing;
    const records: ImportRecord[] = [];
    const summary: ImportSummary = { sheets: 0, added: 0, updated: 0, unchanged: 0, rejected: 0 };
    let rowsProcessed = 0;
    let validRecords = 0;
    let invalidRecords = 0;
    let duplicates = 0;
    const fileCount = new Set(toImport.map((source) => source.fileName)).size;
    setProgress({ ...EMPTY_PROGRESS, stage: "Preparing policy records", filesProcessed: fileCount, filesTotal: fileCount, worksheets: sources.length });
    try {
      for (let index = 0; index < toImport.length; index++) {
        const s = toImport[index];
        setProgress((currentProgress) => ({ ...currentProgress, stage: `Mapping, validating and checking duplicates · ${s.sheet.name}` }));
        await yieldToBrowser();
        const built = buildPolicies(s.sheet.rows, {
          mapping: s.mapping, fileName: s.fileName, sheetName: s.sheet.name,
          defaultInsurer: s.defaultInsurer, defaultType: s.defaultType, existing: policies,
        });
        rowsProcessed += s.sheet.rows.length;
        validRecords += built.fresh.length + built.matches.length;
        invalidRecords += built.rejected.length;
        duplicates += built.repeatedInFile + built.matches.length;
        setProgress((currentProgress) => ({
          ...currentProgress,
          stage: `Verified records and duplicates · ${s.sheet.name}`,
          rowsProcessed,
          validRecords,
          invalidRecords,
          duplicates,
        }));
        await yieldToBrowser();
        const out = applyBuild(policies, built, mode, s.fileName, s.sheet.name);
        policies = out.policies;
        records.push(out.record);
        summary.sheets++;
        summary.added += out.record.added;
        summary.updated += out.record.updated;
        summary.unchanged += out.record.unchanged;
        summary.rejected += out.record.rejected;
      }
      setProgress((currentProgress) => ({ ...currentProgress, stage: "Saving records to your workspace…" }));
      await yieldToBrowser();
      await onDoneAction(policies, records, summary);
      setProgress((currentProgress) => ({ ...currentProgress, stage: "Import complete" }));
      setCompletedSummary(summary);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "An unexpected error occurred.";
      setProblems((currentProblems) => [...currentProblems, `Import could not be completed: ${detail} Your records were not reported as imported; review the mapping and retry.`]);
      setProgress((currentProgress) => ({ ...currentProgress, stage: "" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onCloseAction(); }}>
      <div className="modal modal-wide" aria-busy={busy} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">
            <div className="hero-icon"><CloudUpload size={20} /></div>
            <div><h2>Add your policy files</h2><p>Excel or CSV from any insurer. PolicyPulse reads, cleans and analyses them.</p></div>
          </div>
          <button className="icon-button" onClick={onCloseAction} aria-label="Close" disabled={busy}><X size={18} /></button>
        </div>

        <div className="notice"><ShieldCheck size={15} /><span><b>Private by design</b> · The source file is read in your browser; imported policy records are saved to your authenticated Supabase workspace.</span></div>

        {completedSummary ? (
          <div className="import-complete">
            <CheckCircle2 size={30} aria-hidden="true" />
            <h3 role="status">Import complete</h3>
            <p>Your policy records were saved to your workspace.</p>
            <div className="import-complete-counts">
              <span><b>{completedSummary.added.toLocaleString("en-IN")}</b> added</span>
              <span><b>{completedSummary.updated.toLocaleString("en-IN")}</b> updated</span>
              <span><b>{completedSummary.unchanged.toLocaleString("en-IN")}</b> unchanged</span>
              <span><b>{completedSummary.rejected.toLocaleString("en-IN")}</b> skipped</span>
            </div>
            {problems.map((problem, index) => <div className="import-warning" key={`${problem}-${index}`} role="alert"><AlertTriangle size={15} />{problem}</div>)}
            <button className="btn primary" onClick={onCloseAction}>Done</button>
          </div>
        ) : <>
        <input ref={inputRef} type="file" multiple accept=".xlsx,.xls,.csv" style={{ display: "none" }} disabled={busy} onChange={(e) => handleFiles(e.target.files)} />

        {!sources.length ? (
          <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}>
            <button className={`dropzone ${dragging ? "dragging" : ""}`} onClick={() => inputRef.current?.click()} disabled={busy}>
              <div className="drop-icon"><CloudUpload size={25} /></div>
              <b>{busy ? progress.stage : "Choose files or drop them here"}</b>
              <span>You can select several files at once. Every sheet inside a workbook is read.</span>
              <div className="filetypes"><em><FileSpreadsheet size={13} /> XLSX</em><em><FileSpreadsheet size={13} /> XLS</em><em><FileText size={13} /> CSV</em></div>
              {busy && <ImportProgress progress={progress} />}
            </button>
          </div>
        ) : (
          <div className="source-tabs">
            {sources.map((s) => (
              <div key={s.id} className={`source-tab ${current?.id === s.id ? "active" : ""} ${ready(s) ? "" : "needs"}`} onClick={() => { if (!busy) setActiveId(s.id); }} aria-disabled={busy}>
                <input type="checkbox" checked={s.include && ready(s)} disabled={busy || !ready(s)} onClick={(e) => e.stopPropagation()} onChange={(e) => patch(s.id, { include: e.target.checked })} aria-label="Include this sheet" />
                <div><b>{s.fileName}</b><span>{s.sheet.name} · {s.sheet.rows.length.toLocaleString("en-IN")} rows{ready(s) ? "" : " · needs mapping"}</span></div>
                <button className="icon-button small" onClick={(e) => { e.stopPropagation(); remove(s.id); }} aria-label="Remove sheet" disabled={busy}><X size={13} /></button>
              </div>
            ))}
            <button className="btn secondary add-more" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? <><InlineSpinner /> Reading…</> : "+ Add more files"}</button>
          </div>
        )}

        {problems.map((p) => <div className="import-warning" key={p} role="alert"><AlertTriangle size={15} />{p}</div>)}
        {busy && sources.length > 0 && <ImportProgress progress={progress} />}

        {current && dry && (
          <div className="mapping-section">
            <div className="mapping-head">
              <div><h3>Match columns for “{current.sheet.name}”</h3><p>Column titles were found on row {current.sheet.headerRow}. Check the suggestions below.</p></div>
              <span>{current.sheet.headers.length} columns</span>
            </div>
            {current.sheet.truncated && <div className="import-warning" role="status"><AlertTriangle size={15} />Only the first 50,000 rows of this sheet are read.</div>}

            <div className="mapping-grid">
              {FIELD_KEYS.map((field) => (
                <label key={field}>
                  {FIELD_LABELS[field]}{REQUIRED_FIELDS.includes(field) && <b className="required"> *</b>}
                  <select value={current.mapping[field] || ""} disabled={busy} onChange={(e) => patch(current.id, { mapping: { ...current.mapping, [field]: e.target.value }, include: true })}>
                    <option value="">Not in this file</option>
                    {current.sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div className="fallbacks">
              <label>Insurer for rows with no insurer column
                <input value={current.defaultInsurer} placeholder="e.g. HDFC ERGO" disabled={busy} onChange={(e) => patch(current.id, { defaultInsurer: e.target.value })} />
              </label>
              <label>Policy type for rows with no type column
                <input value={current.defaultType} placeholder="e.g. Motor" disabled={busy} onChange={(e) => patch(current.id, { defaultType: e.target.value })} />
              </label>
            </div>

            {dry.missingRequired.length > 0 ? (
              <div className="import-warning" role="status"><AlertTriangle size={15} />Match these required fields to continue: {dry.missingRequired.map((f) => FIELD_LABELS[f as (typeof FIELD_KEYS)[number]]).join(", ")}.</div>
            ) : (
              <>
                <div className="chips">
                  <span className="chip good">{dry.fresh.length.toLocaleString("en-IN")} new policies</span>
                  {dry.matches.length > 0 && <span className="chip info">{dry.matches.length.toLocaleString("en-IN")} already in workspace</span>}
                  {dry.repeatedInFile > 0 && <span className="chip info">{dry.repeatedInFile} repeated in file</span>}
                  {dry.rejected.length > 0 && <span className="chip bad">{dry.rejected.length.toLocaleString("en-IN")} rows skipped</span>}
                </div>

                {preview && preview.fresh.length > 0 && (
                  <>
                    <div className="preview-head"><b>How PolicyPulse reads your first rows</b><span>Check the dates and phone numbers look right</span></div>
                    <div className="preview-wrap">
                      <table>
                        <thead><tr><th>Customer</th><th>Policy no.</th><th>Insurer</th><th>Type</th><th>Phone</th><th>Expiry</th><th>Premium</th></tr></thead>
                        <tbody>{preview.fresh.map((p) => (
                          <tr key={p.id}><td>{p.customerName}</td><td>{p.policyNumber}</td><td>{p.insurer}</td><td>{p.policyType}</td><td>{p.phone || "—"}</td><td>{dateLabel(p.expiryDate)}</td><td>{p.premium ? money(p.premium) : "—"}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </>
                )}

                {dry.rejected.length > 0 && (
                  <div className="import-warning stack" role="status">
                    <div><AlertTriangle size={15} /> <b>{dry.rejected.length} rows can’t be imported</b> — for example:</div>
                    <ul>{dry.rejected.slice(0, 4).map((r) => <li key={r.rowNumber}>Row {r.rowNumber}: {r.reason}</li>)}</ul>
                    <button className="text-action" disabled={busy} onClick={() => downloadRows(dry.rejected.map((r) => ({ "Excel row": r.rowNumber, Problem: r.reason, ...r.values })), "Skipped rows", `skipped-rows-${current.fileName.replace(/\.[^.]+$/, "")}.xlsx`)}>Download skipped rows to fix them</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {sources.length > 0 && existing.length > 0 && (
          <div className="radio-row">
            <b>If a policy is already in your workspace</b>
            <label><input type="radio" name="dup" checked={mode === "update"} disabled={busy} onChange={() => setMode("update")} /> Update it with the new file <small>(keeps your follow-up notes; a new expiry date restarts follow-up)</small></label>
            <label><input type="radio" name="dup" checked={mode === "skip"} disabled={busy} onChange={() => setMode("skip")} /> Leave the existing record unchanged</label>
          </div>
        )}

        <div className="modal-footer">
          <span>{sources.length ? `${toImport.length} of ${sources.length} sheet${sources.length === 1 ? "" : "s"} ready to import` : "Required fields are marked with *"}</span>
          <div>
            <button className="btn secondary" onClick={onCloseAction} disabled={busy}>Cancel</button>
            <button className="btn primary" disabled={!toImport.length || busy} onClick={runImport}>{busy ? <><InlineSpinner /> Importing…</> : <><Check size={14} /> Import &amp; analyse</>}</button>
          </div>
        </div>
        </>}
      </div>
    </div>
  );
}

function ImportProgress({ progress }: { progress: ImportProgress }) {
  return (
    <div className="import-progress" role="status" aria-live="polite">
      <div><InlineSpinner /><b>{progress.stage}</b></div>
      <span>{progress.filesProcessed} / {progress.filesTotal} files · {progress.worksheets} worksheets</span>
      {progress.worksheets > 0 && <span>{progress.worksheets.toLocaleString("en-IN")} worksheets detected</span>}
      {progress.rowsProcessed > 0 && (
        <span>{progress.rowsProcessed.toLocaleString("en-IN")} rows processed · {progress.validRecords.toLocaleString("en-IN")} valid · {progress.invalidRecords.toLocaleString("en-IN")} invalid · {progress.duplicates.toLocaleString("en-IN")} duplicates</span>
      )}
    </div>
  );
}
