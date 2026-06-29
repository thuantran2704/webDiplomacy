// Empirica intro step — consent + demographics form.
// On submit, triggers seat assignment and redirects to the webDiplomacy board.
import { usePlayer, usePlayers } from "@empirica-core/player/classic/react";
import { useState } from "react";

const FIELDS = [
  { name: "age",          label: "Age",              type: "number" },
  { name: "gender",       label: "Gender",            type: "text"   },
  { name: "experience",   label: "Diplomacy experience (years)", type: "number" },
  { name: "consent",      label: "I consent to participate in this research study", type: "checkbox" },
];

export function Intro() {
  const player = usePlayer();
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.consent) { setError("You must consent to continue."); return; }
    setSubmitting(true);
    try {
      player.set("demographics", form);
      player.stage.set("ready", true);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Welcome — Diplomacy Research Study</h2>
      <p>
        Before you begin, please complete this short form. Your moves and in-game
        messages will be recorded for research purposes.
      </p>
      <form onSubmit={handleSubmit}>
        {FIELDS.map(f => (
          <div key={f.name} style={{ marginBottom: 12 }}>
            <label>
              {f.type === "checkbox" ? (
                <>
                  <input name={f.name} type="checkbox" onChange={handleChange} />{" "}
                  {f.label}
                </>
              ) : (
                <>
                  <div>{f.label}</div>
                  <input name={f.name} type={f.type} onChange={handleChange}
                    style={{ width: "100%", padding: 4 }} />
                </>
              )}
            </label>
          </div>
        ))}
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: "8px 24px" }}>
          {submitting ? "Assigning seat…" : "Start game"}
        </button>
      </form>
    </div>
  );
}
