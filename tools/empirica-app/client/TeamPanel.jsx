// Team panel shown alongside the game board.
// Displays the role badge and a chat area placeholder (filled by TASK 5).

const BADGE = {
  controller: { label: "Controller", bg: "green" },
  spectator:  { label: "Spectator",  bg: "#888"  },
  bot:        { label: "Bot",        bg: "#aaa"  },
};

export function TeamPanel({ role, countryName, controllerName }) {
  const badge = BADGE[role] ?? BADGE.spectator;

  return (
    <aside style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>Your Team — {countryName}</h3>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-label={`role-badge-${role}`}
          style={{
            background:   badge.bg,
            color:        "#fff",
            padding:      "2px 12px",
            borderRadius: 12,
            fontSize:     13,
            fontWeight:   600,
          }}
        >
          {badge.label}
        </span>
        {role === "spectator" && controllerName && (
          <span style={{ fontSize: 13, color: "#555" }}>
            Controller: {controllerName}
          </span>
        )}
      </div>

      {/* Intra-team chat — filled by TASK 5 */}
      <div
        data-testid="chat-placeholder"
        style={{
          flex:         1,
          border:       "1px dashed #ccc",
          borderRadius: 8,
          padding:      12,
          color:        "#aaa",
          fontSize:     13,
        }}
      >
        Intra-team chat (coming soon)
      </div>
    </aside>
  );
}
