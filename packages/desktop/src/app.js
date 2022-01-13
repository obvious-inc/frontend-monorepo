import { render } from "react-dom";
import "./index.css";

const App = () => (
  <>
    <div style={{ WebkitAppRegion: "drag", height: "2.8rem" }} />
    <div
      style={{
        height: "calc(100vh - 2.8rem)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
      }}
    >
      NewShades
    </div>
  </>
);

render(<App />, document.getElementById("app-mount"));
