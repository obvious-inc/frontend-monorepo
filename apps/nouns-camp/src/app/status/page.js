import React from "react";

export const runtime = "edge";

export default function Page() {
  return (
    <>
      <div style={{ padding: "1rem" }}>
        Build version: {process.env.GIT_COMMIT_SHA?.slice(0, 7) ?? "-"}
      </div>
      <div
        dangerouslySetInnerHTML={{
          __html: `<!-- BUILD_GIT_COMMIT_SHA: [${process.env.GIT_COMMIT_SHA}] -->`,
        }}
      />
    </>
  );
}
