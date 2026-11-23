"use client";

import { useState } from "react";
import sample from "../fixtures/signup-card.html";

type Severity = "high" | "medium" | "low";

type Issue = {
  criterion: string;
  severity: Severity;
  line: string;
  problem: string;
  fix: string;
};

type Status = "idle" | "loading" | "done";

const SEVERITIES: Severity[] = ["high", "medium", "low"];

// Badge always shows the word too, so severity isn't conveyed by colour alone (1.4.1)
const severityStyles: Record<Severity, string> = {
  high: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  low: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
};

const borderStyles: Record<Severity, string> = {
  high: "border-l-red-600",
  medium: "border-l-amber-500",
  low: "border-l-sky-600",
};

// The API route appends this marker when the model hit max_tokens
type Truncated = { truncated: true };

function parseLine(line: string): Issue | Truncated | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("```")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null; // skip anything that isn't valid JSON
  }
}

export default function Home() {
  const [code, setCode] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [shown, setShown] = useState<Set<Severity>>(() => new Set(SEVERITIES));

  function toggleSeverity(severity: Severity) {
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    setIssues([]);
    setTruncated(false);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }

      function addLines(lines: string[]) {
        const parsed: Issue[] = [];
        for (const result of lines.map(parseLine)) {
          if (!result) continue;
          if ("truncated" in result) setTruncated(true);
          else parsed.push(result);
        }
        if (parsed.length) setIssues((prev) => [...prev, ...parsed]);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Every complete line is one issue; keep the unfinished tail in the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        addLines(lines);
      }

      addLines([buffer]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setStatus("done");
    }
  }

  const loading = status === "loading";
  const counts = Object.fromEntries(
    SEVERITIES.map((s) => [s, issues.filter((issue) => issue.severity === s).length]),
  ) as Record<Severity, number>;
  // Streamed issues can arrive out of order; sort is stable so ties keep arrival order
  const visible = issues
    .filter((issue) => shown.has(issue.severity))
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

  return (
    <main className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <h1 className="mb-6 text-3xl font-bold">A11y Reviewer</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label htmlFor="code" className="block font-medium">
          Paste a component
        </label>
        <textarea
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={12}
          spellCheck={false}
          className="w-full rounded border p-3 font-mono text-sm"
        />
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Reviewing…" : "Review"}
          </button>
          <button
            type="button"
            onClick={() => setCode(sample)}
            disabled={loading}
            className="rounded border px-4 py-2 disabled:opacity-50"
          >
            Load sample
          </button>
        </div>
      </form>

      {/* Announce start, final count and filter changes only, not every streamed issue */}
      <p aria-live="polite" className="sr-only">
        {loading
          ? "Reviewing code"
          : status === "done" && !error
            ? `${issues.length} issue${issues.length === 1 ? "" : "s"} found${truncated ? ". Review was cut off, some issues may be missing" : ""}${visible.length < issues.length ? `. ${visible.length} shown` : ""}`
            : ""}
      </p>

      {error && (
        <p role="alert" className="mt-6 text-red-700">
          {error}
        </p>
      )}

      {status !== "idle" && !error && (
        <section aria-labelledby="results" aria-busy={loading} className="mt-8">
          <h2 id="results" className="mb-4 text-2xl font-semibold">
            {loading
              ? `Issues so far (${issues.length})`
              : issues.length === 0
                ? "No issues found 🎉"
                : `Issues (${issues.length})`}
          </h2>
          {truncated && (
            <p className="mb-4 rounded border border-amber-500 bg-amber-100 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              The review was cut off before it finished, so some issues may be missing.
            </p>
          )}
          {issues.length > 0 && (
            <fieldset className="mb-4 flex flex-wrap gap-4">
              <legend className="mb-2 font-medium">Show severity</legend>
              {SEVERITIES.map((s) => (
                <label key={s} className="flex items-center gap-2 capitalize">
                  <input
                    type="checkbox"
                    checked={shown.has(s)}
                    onChange={() => toggleSeverity(s)}
                  />
                  {s} ({counts[s]})
                </label>
              ))}
            </fieldset>
          )}
          {issues.length > 0 && visible.length === 0 && (
            <p>No issues match the selected severities.</p>
          )}
          <ul className="space-y-4">
            {visible.map((issue) => (
              <li
                key={issues.indexOf(issue)}
                className={`rounded border border-l-4 p-4 ${borderStyles[issue.severity]}`}
              >
                <h3 className="font-semibold">
                  {issue.criterion}{" "}
                  <span
                    className={`ml-1 rounded px-2 py-0.5 text-sm font-medium capitalize ${severityStyles[issue.severity]}`}
                  >
                    {issue.severity}
                  </span>
                </h3>
                <pre className="my-2 whitespace-pre-wrap break-words bg-gray-100 p-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"><code>{issue.line}</code></pre>
                <p>{issue.problem}</p>
                <p className="mt-2 font-medium">Fix:</p>
                <pre className="whitespace-pre-wrap break-words bg-gray-100 p-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"><code>{issue.fix}</code></pre>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
