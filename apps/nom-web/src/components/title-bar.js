import { TITLE_BAR_HEIGHT } from "../constants/ui";

const TitleBar = () => (
  <div
    style={{
      WebkitAppRegion: "drag",
      height: TITLE_BAR_HEIGHT,
      width: "100%",
      position: "absolute",
      top: 0,
      left: 0,
    }}
  />
);

export default TitleBar;
