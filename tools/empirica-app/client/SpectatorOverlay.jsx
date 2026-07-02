// Absolute overlay that blocks pointer events on the board for spectators.
export function SpectatorOverlay({ visible, controllerName }) {
  if (!visible) return null;
  return (
    <div
      aria-live="polite"
      style={{
        position:      "absolute",
        inset:         0,
        zIndex:        10,
        background:    "rgba(0,0,0,0.15)",
        display:       "flex",
        alignItems:    "center",
        justifyContent:"center",
        pointerEvents: "all",
      }}
    >
      <span
        style={{
          background:   "rgba(255,255,255,0.9)",
          padding:      "10px 24px",
          borderRadius: 8,
          fontSize:     15,
          fontWeight:   500,
        }}
      >
        Spectator mode{controllerName ? ` — watching ${controllerName}` : ""}
      </span>
    </div>
  );
}
