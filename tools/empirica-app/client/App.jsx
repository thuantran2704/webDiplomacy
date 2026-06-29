// Empirica client entry-point — wires intro + stage + exit components.
import { EmpiricaClassic } from "@empirica-core/player/classic";
import { EmpiricaContext } from "@empirica-core/player";
import { Intro } from "./Intro";
import { Stage } from "./Stage";

function ExitSurvey({ player }) {
  return (
    <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Thank you for playing!</h2>
      <p>Your moves and messages have been recorded for research. The session is complete.</p>
    </div>
  );
}

export default function App() {
  return (
    <EmpiricaContext
      introSteps={[Intro]}
      stageComponent={Stage}
      exitSteps={[ExitSurvey]}
    >
      <EmpiricaClassic />
    </EmpiricaContext>
  );
}
