/**
 * Stage.test.jsx — T4.1 through T4.7
 * Covers: controller/spectator overlay, role badge, SSE role-changed events,
 * responsive layout, SSE reconnection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

// ── Mock Empirica hooks ────────────────────────────────────────────────────────
import { usePlayer, useStage, useGame } from "@empirica-core/player/classic/react";
vi.mock("@empirica-core/player/classic/react", () => ({
  usePlayer: vi.fn(),
  useStage:  vi.fn(),
  useGame:   vi.fn(),
}));

import { Stage } from "../Stage.jsx";
import { TeamPanel } from "../TeamPanel.jsx";
import { useSSE } from "../useSSE.js";

// ── Helpers ────────────────────────────────────────────────────────────────────
const BOARD_URL = "http://localhost:43000/board.php?gameID=1";

function makePlayer(overrides = {}) {
  const attrs = {
    role:          "controller",
    boardUrl:      null,
    countryName:   "England",
    participantId: "uuid-me-12345678",
    teamId:        5,
    ...overrides,
  };
  return {
    id:    "player-1",
    get:   vi.fn((k) => attrs[k] ?? null),
    set:   vi.fn(),
    stage: { set: vi.fn() },
  };
}

function makeStage(boardUrl = BOARD_URL) {
  return { get: vi.fn((k) => (k === "boardUrl" ? boardUrl : null)) };
}

function makeGame(rsGameId = 5, players = []) {
  return {
    get:     vi.fn((k) => (k === "rsGameId" ? rsGameId : null)),
    players,
  };
}

beforeEach(() => {
  EventSource.reset();
  // Wide viewport by default
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── T4.1 — Controller sees no overlay ─────────────────────────────────────────
describe("T4.1 — Controller: no overlay", () => {
  it("renders the board iframe and no spectator overlay", () => {
    const player = makePlayer({ role: "controller" });
    usePlayer.mockReturnValue(player);
    useStage.mockReturnValue(makeStage());
    useGame.mockReturnValue(makeGame(5, [player]));

    render(<Stage />);
    expect(screen.getByTitle(/diplomacy board/i)).toBeInTheDocument();
    expect(screen.queryByText(/spectator mode/i)).not.toBeInTheDocument();
  });
});

// ── T4.2 — Spectator sees overlay ─────────────────────────────────────────────
describe("T4.2 — Spectator: overlay visible", () => {
  it("shows the spectator mode label over the board", () => {
    usePlayer.mockReturnValue(makePlayer({ role: "spectator" }));
    useStage.mockReturnValue(makeStage());
    useGame.mockReturnValue(makeGame());

    render(<Stage />);
    expect(screen.getByText(/spectator mode/i)).toBeInTheDocument();
  });

  it("overlay element has pointer-events: all", () => {
    usePlayer.mockReturnValue(makePlayer({ role: "spectator" }));
    useStage.mockReturnValue(makeStage());
    useGame.mockReturnValue(makeGame());

    render(<Stage />);
    // The overlay wraps the label text
    const overlay = screen.getByText(/spectator mode/i).closest("div");
    expect(overlay).toHaveStyle({ pointerEvents: "all" });
  });
});

// ── T4.3 — Role badge label ────────────────────────────────────────────────────
describe("T4.3 — Role badge", () => {
  it("shows green Controller badge when role is controller", () => {
    render(<TeamPanel role="controller" countryName="England" controllerName={null} />);
    const badge = screen.getByText("Controller");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ background: "green" });
  });

  it("shows grey Spectator badge when role is spectator", () => {
    render(<TeamPanel role="spectator" countryName="England" controllerName={null} />);
    expect(screen.getByText("Spectator")).toBeInTheDocument();
  });

  it("renders the chat area placeholder", () => {
    render(<TeamPanel role="controller" countryName="England" controllerName={null} />);
    expect(screen.getByTestId("chat-placeholder")).toBeInTheDocument();
  });
});

// ── T4.4 — SSE role-changed removes overlay ────────────────────────────────────
describe("T4.4 — SSE: role-changed removes overlay", () => {
  it("removes spectator overlay when player becomes controller via SSE", async () => {
    const player = makePlayer({ role: "spectator", participantId: "uuid-me-12345678", teamId: 5 });
    usePlayer.mockReturnValue(player);
    useStage.mockReturnValue(makeStage());
    useGame.mockReturnValue(makeGame(5, [player]));

    render(<Stage />);
    expect(screen.getByText(/spectator mode/i)).toBeInTheDocument();

    act(() => {
      EventSource.fireMessage({
        event: "role-changed",
        data: { teamId: 5, newControllerId: "uuid-me-12345678", previousControllerId: "uuid-other" },
      });
    });

    await waitFor(() =>
      expect(screen.queryByText(/spectator mode/i)).not.toBeInTheDocument()
    );
  });

  it("shows toast 'You are now the controller'", async () => {
    const player = makePlayer({ role: "spectator", participantId: "uuid-me-12345678", teamId: 5 });
    usePlayer.mockReturnValue(player);
    useStage.mockReturnValue(makeStage());
    useGame.mockReturnValue(makeGame());

    render(<Stage />);
    act(() => {
      EventSource.fireMessage({
        event: "role-changed",
        data: { teamId: 5, newControllerId: "uuid-me-12345678", previousControllerId: "uuid-other" },
      });
    });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/you are now the controller/i)
    );
  });
});

// ── T4.5 — SSE role-changed adds overlay ──────────────────────────────────────
describe("T4.5 — SSE: role-changed adds overlay", () => {
  it("shows spectator overlay when controller loses control via SSE", async () => {
    const player = makePlayer({ role: "controller", participantId: "uuid-me-12345678", teamId: 5 });
    usePlayer.mockReturnValue(player);
    useStage.mockReturnValue(makeStage());
    useGame.mockReturnValue(makeGame());

    render(<Stage />);
    expect(screen.queryByText(/spectator mode/i)).not.toBeInTheDocument();

    act(() => {
      EventSource.fireMessage({
        event: "role-changed",
        data: { teamId: 5, previousControllerId: "uuid-me-12345678", newControllerId: "uuid-other" },
      });
    });

    await waitFor(() =>
      expect(screen.getByText(/spectator mode/i)).toBeInTheDocument()
    );
  });

  it("shows 'Control transferred' toast", async () => {
    const player = makePlayer({ role: "controller", participantId: "uuid-me-12345678", teamId: 5 });
    usePlayer.mockReturnValue(player);
    useStage.mockReturnValue(makeStage());
    useGame.mockReturnValue(makeGame());

    render(<Stage />);
    act(() => {
      EventSource.fireMessage({
        event: "role-changed",
        data: { teamId: 5, previousControllerId: "uuid-me-12345678", newControllerId: "uuid-other" },
      });
    });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/control transferred/i)
    );
  });
});

// ── T4.6 — Responsive layout ──────────────────────────────────────────────────
describe("T4.6 — Responsive layout", () => {
  it("uses row layout on wide viewport (≥ 1024 px)", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    usePlayer.mockReturnValue(makePlayer());
    useStage.mockReturnValue(makeStage());
    useGame.mockReturnValue(makeGame());

    render(<Stage />);
    const outer = screen.getByTitle(/diplomacy board/i).closest("[data-layout]");
    expect(outer).toHaveAttribute("data-layout", "row");
  });

  it("uses column layout on narrow viewport (< 1024 px)", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    usePlayer.mockReturnValue(makePlayer());
    useStage.mockReturnValue(makeStage());
    useGame.mockReturnValue(makeGame());

    render(<Stage />);
    const outer = screen.getByTitle(/diplomacy board/i).closest("[data-layout]");
    expect(outer).toHaveAttribute("data-layout", "column");
  });
});

// ── T4.7 — SSE reconnection ────────────────────────────────────────────────────
describe("T4.7 — useSSE reconnects on error", () => {
  it("creates a new EventSource after an error (exponential backoff)", async () => {
    vi.useFakeTimers();
    const onEvent = vi.fn();

    renderHook(() => useSSE(5, onEvent));

    expect(EventSource._instances).toHaveLength(1);

    // Simulate a connection error
    act(() => { EventSource.fireError(); });

    // Initial backoff is 1 000 ms — advance past it
    await act(async () => { vi.advanceTimersByTime(1001); });

    expect(EventSource._instances).toHaveLength(2);

    vi.useRealTimers();
  });

  it("does not connect when gameId is null/undefined", () => {
    renderHook(() => useSSE(null, vi.fn()));
    expect(EventSource._instances).toHaveLength(0);
  });
});
