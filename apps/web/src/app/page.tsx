"use client";

import { useEffect, useState, type FormEvent } from "react";

type Patient = {
  id: string;
  displayName: string;
  summaryIds: string[];
};

type TriageResult = {
  action: string;
  urgency: string;
  reply: string;
  evidence: Array<{ summaryId: string; quote: string }>;
  reason: string;
};

export default function HomePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TriageResult | null>(null);

  useEffect(() => {
    void fetch("/api/patients")
      .then((res) => res.json())
      .then((data: Patient[]) => {
        setPatients(data);
        if (data[0]) setPatientId(data[0].id);
      })
      .catch(() => setError("Could not load patients."));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    const patient = patients.find((p) => p.id === patientId);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          summaryIds: patient?.summaryIds ?? [],
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Request failed");
        return;
      }
      setResult(body.result as TriageResult);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>Maple</h1>
      <p style={{ marginTop: 0, color: "#57534e" }}>
        Ask a follow-up question about a recent virtual visit.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          Patient
          <select
            aria-label="Patient"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            style={{ padding: "0.5rem", fontSize: "1rem" }}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          Question
          <textarea
            aria-label="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={4}
            required
            style={{ padding: "0.5rem", fontSize: "1rem", fontFamily: "inherit" }}
          />
        </label>

        <button
          type="submit"
          disabled={loading || !patientId}
          style={{
            justifySelf: "start",
            padding: "0.6rem 1.2rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>

      {error ? (
        <p role="alert" style={{ color: "#b91c1c", marginTop: "1.5rem" }}>
          {error}
        </p>
      ) : null}

      {result ? (
        <section style={{ marginTop: "2rem", display: "grid", gap: "0.75rem" }}>
          <div>
            Action: <span data-testid="action">{result.action}</span>
          </div>
          <div>
            Urgency:{" "}
            <span
              data-testid="urgency"
              style={{
                fontWeight: 700,
                color: result.urgency === "emergency" ? "#b91c1c" : "inherit",
              }}
            >
              {result.urgency}
            </span>
          </div>
          <div>
            Reply:
            <p data-testid="reply" style={{ whiteSpace: "pre-wrap" }}>
              {result.reply}
            </p>
          </div>
          <div data-testid="evidence">
            Evidence:
            <ul>
              {result.evidence.map((item, index) => (
                <li key={`${item.summaryId}-${index}`}>
                  <strong>{item.summaryId}</strong>: {item.quote}
                </li>
              ))}
            </ul>
          </div>
          <div>
            Reason: <span data-testid="reason">{result.reason}</span>
          </div>
        </section>
      ) : null}
    </main>
  );
}
