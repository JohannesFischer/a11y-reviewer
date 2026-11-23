"use client";

import { useState } from "react";

type Issue = {
  criterion: string;
  severity: "high" | "medium" | "low";
  line: string;
  problem: string;
  fix: string;
};

export default function Home() {
  const [code, setCode] = useState("");
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setIssues(null);

    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setIssues(data.issues);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
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
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Reviewing…" : "Review"}
        </button>
      </form>

      {/* Announces status changes to screen readers */}
      <p aria-live="polite" className="sr-only">
        {loading
          ? "Reviewing code"
          : issues
            ? `${issues.length} issue${issues.length === 1 ? "" : "s"} found`
            : ""}
      </p>

      {error && (
        <p role="alert" className="mt-6 text-red-700">
          {error}
        </p>
      )}

      {issues && (
        <section aria-labelledby="results" className="mt-8">
          <h2 id="results" className="mb-4 text-2xl font-semibold">
            {issues.length === 0
              ? "No issues found 🎉"
              : `Issues (${issues.length})`}
          </h2>
          <ul className="space-y-4">
            {issues.map((issue, i) => (
              <li key={i} className="rounded border p-4">
                <h3 className="font-semibold">
                  {issue.criterion}{" "}
                  <span className="text-sm font-normal">
                    ({issue.severity})
                  </span>
                </h3>
                <pre className="my-2 overflow-x-auto bg-gray-100 p-2 text-sm">
                  <code>{issue.line}</code>
                </pre>
                <p>{issue.problem}</p>
                <p className="mt-2 font-medium">Fix:</p>
                <pre className="overflow-x-auto bg-gray-100 p-2 text-sm">
                  <code>{issue.fix}</code>
                </pre>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
