// Board stage — embeds the webDiplomacy board for this player's assigned seat.
import { usePlayer, useStage } from "@empirica-core/player/classic/react";

export function Stage() {
  const player = usePlayer();
  const stage  = useStage();
  const boardUrl = stage.get("boardUrl") ?? player.get("boardUrl");

  if (!boardUrl) {
    return <div style={{ padding: 32 }}>Waiting for game to start…</div>;
  }

  return (
    <iframe
      title="Diplomacy board"
      src={boardUrl}
      style={{ width: "100%", height: "90vh", border: "none" }}
      allow="same-origin"
    />
  );
}
