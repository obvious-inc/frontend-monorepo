import { css } from "@emotion/react";
import { MainLayout } from "./layouts.js";

const EmptyMainScreen = () => {
  return (
    <div
      css={(t) =>
        css({
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: t.mainHeader.height,
        })
      }
    >
      <p>Pick a channel</p>
    </div>
  );
};

const HomeScreen = () => {
  return (
    <MainLayout>
      <EmptyMainScreen />
    </MainLayout>
  );
};

export default HomeScreen;
