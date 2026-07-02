/**
 * Intro.test.jsx — T3.1 through T3.7
 * Covers: scroll gate (Step 1), consent validation (Step 2), Data API calls,
 * demographics (Step 3), age warning, API error banner, returning participant (409).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock Empirica hooks ────────────────────────────────────────────────────────
const mockPlayer = {
  id: "empirica-player-1",
  set: vi.fn(),
  stage: { set: vi.fn() },
};
vi.mock("@empirica-core/player/classic/react", () => ({
  usePlayer: () => mockPlayer,
}));

// ── Mock dataApi module ────────────────────────────────────────────────────────
import * as dataApi from "../dataApi.js";
vi.mock("../dataApi.js", () => ({
  createParticipant: vi.fn(),
  saveConsent:       vi.fn(),
  logEvent:          vi.fn(),
}));

import { Intro } from "../Intro.jsx";

// ── Helpers ────────────────────────────────────────────────────────────────────
const CHECKBOX_LABELS = [
  "I understand my game moves and in-game messages will be recorded for research.",
  "I consent to my anonymised data being used in published research.",
  "I understand I can withdraw at any time",
  "I am 18 years of age or older",
];

async function advancePastStep1() {
  // Simulate the sentinel becoming visible (scroll to bottom)
  act(() => {
    global.IntersectionObserver._instances.forEach(({ observer }) => {
      observer.cb([{ isIntersecting: true }]);
    });
  });
  const nextBtn = await screen.findByRole("button", { name: /next/i });
  await userEvent.click(nextBtn);
}

async function checkAllBoxes() {
  for (const label of CHECKBOX_LABELS) {
    const cb = screen.getByLabelText(new RegExp(label.slice(0, 30), "i"));
    await userEvent.click(cb);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  global.IntersectionObserver._instances = [];
  dataApi.createParticipant.mockResolvedValue({ status: 201, data: { id: "uuid-123" } });
  dataApi.saveConsent.mockResolvedValue({ status: 201, data: {} });
  dataApi.logEvent.mockResolvedValue({ status: 201, data: {} });
});

// ── T3.1 — Step 1: Next disabled until scrolled ────────────────────────────────
describe("T3.1 — Step 1 scroll gate", () => {
  it("renders Step 1 and Next is disabled initially", () => {
    render(<Intro />);
    const btn = screen.getByRole("button", { name: /next/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/please scroll to the bottom/i)).toBeInTheDocument();
  });

  it("enables Next after sentinel becomes visible", async () => {
    render(<Intro />);
    act(() => {
      global.IntersectionObserver._instances.forEach(({ observer }) => {
        observer.cb([{ isIntersecting: true }]);
      });
    });
    const btn = await screen.findByRole("button", { name: /next/i });
    expect(btn).not.toBeDisabled();
  });
});

// ── T3.2 — Step 2: cannot proceed without all boxes checked ───────────────────
describe("T3.2 — Consent validation", () => {
  it("shows inline errors for every unchecked box on submit", async () => {
    render(<Intro />);
    await advancePastStep1();

    const agreeBtn = screen.getByRole("button", { name: /i agree/i });
    await userEvent.click(agreeBtn);

    const errors = await screen.findAllByText(/this field is required to continue/i);
    expect(errors).toHaveLength(4);
    expect(dataApi.createParticipant).not.toHaveBeenCalled();
  });
});

// ── T3.3 — Step 2: all checked → calls Data API → advances ───────────────────
describe("T3.3 — Consent submission", () => {
  it("calls createParticipant, saveConsent, logEvent and advances to Step 3", async () => {
    render(<Intro />);
    await advancePastStep1();
    await checkAllBoxes();

    await userEvent.click(screen.getByRole("button", { name: /i agree/i }));

    await waitFor(() => expect(dataApi.createParticipant).toHaveBeenCalledWith("empirica-player-1"));
    expect(dataApi.saveConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "uuid-123",
        checkboxes: { dataCollection: true, publications: true, withdrawal: true, ageVerified: true },
      })
    );
    expect(dataApi.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "participant.consent", participantId: "uuid-123" })
    );
    // Step 3 heading visible
    await screen.findByRole("heading", { name: /demographics/i });
  });
});

// ── T3.4 — Step 3: age < 18 shows yellow warning ─────────────────────────────
describe("T3.4 — Age warning", () => {
  it("shows yellow warning when age < 18", async () => {
    render(<Intro />);
    await advancePastStep1();
    await checkAllBoxes();
    await userEvent.click(screen.getByRole("button", { name: /i agree/i }));
    await screen.findByRole("heading", { name: /demographics/i });

    const ageInput = screen.getByLabelText(/age/i);
    await userEvent.clear(ageInput);
    await userEvent.type(ageInput, "16");

    expect(await screen.findByText(/please confirm you have parental consent/i)).toBeInTheDocument();
  });

  it("no warning when age >= 18", async () => {
    render(<Intro />);
    await advancePastStep1();
    await checkAllBoxes();
    await userEvent.click(screen.getByRole("button", { name: /i agree/i }));
    await screen.findByRole("heading", { name: /demographics/i });

    const ageInput = screen.getByLabelText(/age/i);
    await userEvent.type(ageInput, "25");

    expect(screen.queryByText(/please confirm you have parental consent/i)).not.toBeInTheDocument();
  });
});

// ── T3.5 — Step 3: submit sends participant.joined + player.set ───────────────
describe("T3.5 — Demographics submission", () => {
  it("logs participant.joined event and sets player attributes", async () => {
    render(<Intro />);
    await advancePastStep1();
    await checkAllBoxes();
    await userEvent.click(screen.getByRole("button", { name: /i agree/i }));
    await screen.findByRole("heading", { name: /demographics/i });

    await userEvent.type(screen.getByLabelText(/age/i), "30");
    await userEvent.type(screen.getByLabelText(/gender/i), "Non-binary");
    await userEvent.type(screen.getByLabelText(/years of diplomacy/i), "5");

    await userEvent.click(screen.getByRole("button", { name: /enter game/i }));

    await waitFor(() =>
      expect(dataApi.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "participant.joined",
          participantId: "uuid-123",
          payload: expect.objectContaining({
            demographics: expect.objectContaining({ age: 30, gender: "Non-binary", experience: 5 }),
          }),
        })
      )
    );
    expect(mockPlayer.set).toHaveBeenCalledWith("participantId", "uuid-123");
    expect(mockPlayer.set).toHaveBeenCalledWith("demographics", expect.objectContaining({ age: 30 }));
    expect(mockPlayer.stage.set).toHaveBeenCalledWith("ready", true);
  });
});

// ── T3.6 — Data API unreachable shows red banner ─────────────────────────────
describe("T3.6 — Data API error", () => {
  it("shows red banner when createParticipant rejects", async () => {
    dataApi.createParticipant.mockRejectedValue(new Error("Network error"));
    render(<Intro />);
    await advancePastStep1();
    await checkAllBoxes();
    await userEvent.click(screen.getByRole("button", { name: /i agree/i }));

    expect(await screen.findByText(/unable to connect to study server/i)).toBeInTheDocument();
    // Still on Step 2 (no advancement)
    expect(screen.queryByRole("heading", { name: /demographics/i })).not.toBeInTheDocument();
  });
});

// ── T3.7 — Returning participant (409 on consent) is allowed through ──────────
describe("T3.7 — Returning participant", () => {
  it("treats 409 on saveConsent as success and advances to Step 3", async () => {
    dataApi.saveConsent.mockResolvedValue({ status: 409, data: { error: "Already consented" } });
    render(<Intro />);
    await advancePastStep1();
    await checkAllBoxes();
    await userEvent.click(screen.getByRole("button", { name: /i agree/i }));

    // Should still advance to demographics (409 is not thrown as error)
    await screen.findByRole("heading", { name: /demographics/i });
    expect(screen.queryByText(/unable to connect/i)).not.toBeInTheDocument();
  });
});
