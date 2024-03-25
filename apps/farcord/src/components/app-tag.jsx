import React from "react";
import { fetchAppFid } from "../hooks/hub";
import { fetchUserByFid } from "../hooks/neynar";
import { css } from "@emotion/react";

const AppTag = ({ fid, hash }) => {
  const [app, setApp] = React.useState(null);

  React.useEffect(() => {
    if (!fid || !hash) return;

    async function fetchSigner() {
      const appFid = await fetchAppFid({ fid, hash });
      if (!appFid) return;

      // ignore warpcast for now
      if (Number(appFid) == 9152) return;

      fetchUserByFid(appFid).then((result) => {
        setApp(result);
      });
    }

    fetchSigner();
  }, [fid, hash]);

  if (!app) return <></>;

  return (
    <div>
      <p css={(t) => css({ fontWeight: "bold", color: t.colors.pink })}>
        [@{app?.username}]
      </p>
    </div>
  );
};

export default AppTag;
