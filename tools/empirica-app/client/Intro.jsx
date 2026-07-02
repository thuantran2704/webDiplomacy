// 3-step consent + demographics intro form for the Diplomacy research study.
// Step 1: Study information (scroll-to-bottom gate).
// Step 2: Legal consent (all 4 checkboxes required).
// Step 3: Demographics.
import { usePlayer } from "@empirica-core/player/classic/react";
import { useState, useRef, useEffect } from "react";
import { createParticipant, saveConsent, logEvent } from "./dataApi.js";

const FORM_VERSION = import.meta.env?.VITE_CONSENT_FORM_VERSION ?? "1.0";

const CHECKBOXES = [
  { name: "dataCollection", label: "I understand my game moves and in-game messages will be recorded for research." },
  { name: "publications",   label: "I consent to my anonymised data being used in published research." },
  { name: "withdrawal",     label: "I understand I can withdraw at any time; data collected up to that point will be retained." },
  { name: "ageVerified",    label: "I am 18 years of age or older (or have obtained parental/guardian consent)." },
];

export function Intro() {
  const player = usePlayer();

  const [step, setStep]           = useState(1);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [participantId, setParticipantId] = useState(null);
  const [apiError, setApiError]   = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [checkboxes, setCheckboxes] = useState({
    dataCollection: false, publications: false, withdrawal: false, ageVerified: false,
  });
  const [checkboxErrors, setCheckboxErrors] = useState({});

  const [demo, setDemo]   = useState({ age: "", gender: "", experience: "", occupation: "" });
  const [ageWarn, setAgeWarn] = useState(false);

  // Sentinel at bottom of Step 1 — enables Next when visible
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (step !== 1 || !sentinelRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setHasScrolled(true); },
      { threshold: 0.5 },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [step]);

  function toggleCheckbox(name) {
    setCheckboxes(prev => ({ ...prev, [name]: !prev[name] }));
    setCheckboxErrors(prev => ({ ...prev, [name]: false }));
  }

  async function submitConsent(e) {
    e.preventDefault();
    const errors = {};
    CHECKBOXES.forEach(({ name }) => { if (!checkboxes[name]) errors[name] = true; });
    if (Object.keys(errors).length) { setCheckboxErrors(errors); return; }

    setSubmitting(true);
    setApiError(null);
    try {
      const { data } = await createParticipant(player.id);
      const pid = data.id;
      setParticipantId(pid);

      await saveConsent({ participantId: pid, formVersion: FORM_VERSION, checkboxes });

      await logEvent({
        type:          "participant.consent",
        participantId: pid,
        payload:       { formVersion: FORM_VERSION, checkboxes, ipHash: null },
      });

      setStep(3);
    } catch {
      setApiError("Unable to connect to study server. Please contact the researcher.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDemoChange(e) {
    const { name, value } = e.target;
    setDemo(prev => ({ ...prev, [name]: value }));
    if (name === "age") setAgeWarn(value !== "" && Number(value) < 18);
  }

  async function submitDemo(e) {
    e.preventDefault();
    setSubmitting(true);
    setApiError(null);
    const demographics = {
      age:        Number(demo.age),
      gender:     demo.gender.trim(),
      experience: Number(demo.experience),
      ...(demo.occupation.trim() ? { occupation: demo.occupation.trim() } : {}),
    };
    try {
      await logEvent({
        type:          "participant.joined",
        participantId,
        payload:       { empiricaPlayerId: player.id, demographics, consentVersion: FORM_VERSION },
      });
      player.set("participantId", participantId);
      player.set("demographics", demographics);
      player.stage.set("ready", true);
    } catch {
      setApiError("Unable to connect to study server. Please contact the researcher.");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", fontFamily: "sans-serif", lineHeight: 1.6 }}>
      {step === 1 && (
        <InfoSheet hasScrolled={hasScrolled} sentinelRef={sentinelRef} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <ConsentStep
          checkboxes={checkboxes} checkboxErrors={checkboxErrors}
          submitting={submitting} apiError={apiError}
          onToggle={toggleCheckbox} onSubmit={submitConsent}
        />
      )}
      {step === 3 && (
        <DemographicsStep
          demo={demo} ageWarn={ageWarn}
          submitting={submitting} apiError={apiError}
          onChange={handleDemoChange} onSubmit={submitDemo}
        />
      )}
    </div>
  );
}

function InfoSheet({ hasScrolled, sentinelRef, onNext }) {
  return (
    <>
      <h2>Study Information Sheet</h2>
      <p>Thank you for your interest in this research study. Please read the following carefully.</p>
      <p>
        <strong>What is the study about?</strong> This study investigates decision-making in
        competitive negotiation settings using the strategy game Diplomacy. You will play with
        other participants and/or AI-controlled players.
      </p>
      <p>
        <strong>What data will be collected?</strong> Your in-game moves, orders, in-game messages,
        and session metadata will be recorded. No personally identifiable information (name, email,
        or raw IP address) is stored.
      </p>
      <p>
        <strong>How will data be used?</strong> De-identified data may be used in academic
        publications and shared with other researchers in anonymised form.
      </p>
      <p>
        <strong>Withdrawal.</strong> Participation is entirely voluntary. You may withdraw at any
        time. Data collected up to that point will be retained in anonymised form.
      </p>
      <p ref={sentinelRef} style={{ color: "#555" }}>
        By clicking "Next" you confirm you have read and understood this information.
      </p>
      <button
        onClick={onNext}
        disabled={!hasScrolled}
        style={{ padding: "8px 24px", marginTop: 8, opacity: hasScrolled ? 1 : 0.45 }}
      >
        Next
      </button>
      {!hasScrolled && (
        <p style={{ color: "#888", fontSize: 13, marginTop: 6 }}>
          Please scroll to the bottom to continue.
        </p>
      )}
    </>
  );
}

function ConsentStep({ checkboxes, checkboxErrors, submitting, apiError, onToggle, onSubmit }) {
  return (
    <>
      <h2>Consent Form</h2>
      <p>Please read and check each statement. All boxes must be checked to continue.</p>
      {apiError && <ApiErrorBanner message={apiError} />}
      <form onSubmit={onSubmit}>
        {CHECKBOXES.map(({ name, label }) => (
          <div key={name} style={{ marginBottom: 14 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={checkboxes[name]}
                onChange={() => onToggle(name)}
                aria-invalid={!!checkboxErrors[name]}
                style={{ marginTop: 4, flexShrink: 0 }}
              />
              <span>{label}</span>
            </label>
            {checkboxErrors[name] && (
              <p role="alert" style={{ color: "#b00020", margin: "4px 0 0 26px", fontSize: 13 }}>
                This field is required to continue.
              </p>
            )}
          </div>
        ))}
        <button type="submit" disabled={submitting} style={{ padding: "8px 24px", marginTop: 8 }}>
          {submitting ? "Saving…" : "I agree — Continue"}
        </button>
      </form>
    </>
  );
}

function DemographicsStep({ demo, ageWarn, submitting, apiError, onChange, onSubmit }) {
  return (
    <>
      <h2>Demographics</h2>
      <p>This helps us understand the study population. Occupation is optional.</p>
      {apiError && <ApiErrorBanner message={apiError} />}
      <form onSubmit={onSubmit}>
        <Field label="Age *" name="age" type="number" min={1} max={120} value={demo.age} onChange={onChange} required />
        {ageWarn && (
          <p role="alert" style={{ color: "#856404", background: "#fff3cd", padding: "8px 12px", borderRadius: 4, marginTop: -10, marginBottom: 10 }}>
            Please confirm you have parental consent (checked above).
          </p>
        )}
        <Field label="Gender *" name="gender" type="text" maxLength={60} value={demo.gender} onChange={onChange} required />
        <Field label="Years of Diplomacy experience *" name="experience" type="number" min={0} max={80} value={demo.experience} onChange={onChange} required />
        <Field label="Occupation (optional)" name="occupation" type="text" maxLength={100} value={demo.occupation} onChange={onChange} />
        <button type="submit" disabled={submitting} style={{ padding: "8px 24px", marginTop: 8 }}>
          {submitting ? "Starting…" : "Enter game"}
        </button>
      </form>
    </>
  );
}

function ApiErrorBanner({ message }) {
  return (
    <p role="alert" style={{ color: "#b00020", background: "#fff0f0", padding: "10px 14px", borderRadius: 4, marginBottom: 12 }}>
      {message}
    </p>
  );
}

function Field({ label, name, type, value, onChange, required, ...rest }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label>
        <div style={{ marginBottom: 4 }}>{label}</div>
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          style={{ width: "100%", padding: "6px 8px", boxSizing: "border-box" }}
          {...rest}
        />
      </label>
    </div>
  );
}

