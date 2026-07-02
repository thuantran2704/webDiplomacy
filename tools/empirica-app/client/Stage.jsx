// Board stage — split layout: board iframe (70 %) + team panel (30 %).
// Spectator overlay blocks board interaction for non-controllers.
// Role changes arrive via SSE from the Data API.
import { usePlayer, useStage, useGame } from "@empirica-core/player/classic/react";
import { useState, useEffect, useCallback } from "react";
import { SpectatorOverlay } from "./SpectatorOverlay.jsx";
import { TeamPanel } from "./TeamPanel.jsx";
import { useSSE } from "./useSSE.js";

const BREAKPOINT_PX  = 1024;
const TOAST_DURATION = 4_000;

export function Stage() {
  const player = usePlayer();
  const stage  = useStage();
  const game   = useGame();

  const boardUrl       = stage?.get("boardUrl") ?? player?.get("boardUrl");
  const rsGameId       = game?.get("rsGameId");
  const countryName    = player?.get("countryName")   ?? "Your country";
  const participantId  = player?.get("participantId") ?? null;
  const myTeamId       = player?.get("teamId")        ?? null;

  const [role, setRole]         = useState(() => player?.get("role") ?? "spectator");
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < BREAKPOINT_PX);
  const [toast, setToast]       = useState(null);

  // Derive initial controller name from sibling players in Empirica.
  const [controllerName, setControllerName] = useState(() => {
    const ctrl = game?.players?.find(
      (p) => p.get("teamId") === myTeamId && p.get("role") === "controller"
    );
    const id = ctrl?.get("participantId");
    return id ? `${id.slice(0, 8)}…` : null;
  });

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < BREAKPOINT_PX);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleSSEEvent = useCallback(({ event, data } = {}) => {
    if (event !== "role-changed") return;
    const { teamId: evTeamId, newControllerId, previousControllerId } = data ?? {};

    // Ignore events for other teams.
    if (myTeamId !== null && evTeamId !== myTeamId) return;

    const newCtrlLabel = newControllerId ? `${newControllerId.slice(0, 8)}…` : null;
    setControllerName(newCtrlLabel);

    if (newControllerId === participantId) {
      setRole("controller");
      setToast("You are now the controller");
    } else if (previousControllerId === participantId) {
      setRole("spectator");
      setToast("Control transferred");
    }
    setTimeout(() => setToast(null), TOAST_DURATION);
  }, [participantId, myTeamId]);

  useSSE(rsGameId, handleSSEEvent);

  if (!boardUrl) {
    return <div style={{ padding: 32 }}>Waiting for game to start…</div>;
  }

  const outerStyle = {
    display:       "flex",
    flexDirection: isNarrow ? "column" : "row",
    height:        "100vh",
    overflow:      "hidden",
  };

  return (
    <div data-layout={isNarrow ? "column" : "row"} style={outerStyle}>
      {/* Board pane — 70 % wide on large screens */}
      <div
        style={{
          flex:     isNarrow ? "1 1 auto" : "0 0 70%",
          position: "relative",
          minHeight: 0,
        }}
      >
        <iframe
          title="Diplomacy board"
          src={boardUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="same-origin"
        />
        <SpectatorOverlay visible={role === "spectator"} controllerName={controllerName} />
      </div>

      {/* Team panel — 30 % wide on large screens */}
      <div
        style={{
          flex:      isNarrow ? "0 0 auto" : "0 0 30%",
          overflowY: "auto",
          borderLeft: isNarrow ? "none" : "1px solid #e0e0e0",
          borderTop:  isNarrow ? "1px solid #e0e0e0" : "none",
        }}
      >
        <TeamPanel
          role={role}
          countryName={countryName}
          controllerName={role === "spectator" ? controllerName : null}
        />
      </div>

      {/* Toast notification for role changes */}
      {toast && (
        <div
          role="status"
          style={{
            position:  "fixed",
            bottom:    24,
            left:      "50%",
            transform: "translateX(-50%)",
            background:"#333",
            color:     "#fff",
            padding:   "8px 20px",
            borderRadius: 8,
            zIndex:    100,
            fontSize:  14,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

