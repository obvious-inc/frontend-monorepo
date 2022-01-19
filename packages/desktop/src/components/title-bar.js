import { TITLE_BAR_HEIGHT } from "../constants/ui";

const TitleBar = () => (
  <div style={{ WebkitAppRegion: "drag", height: TITLE_BAR_HEIGHT }} />
);

export default TitleBar;
