import { array as arrayUtils } from "@shades/common/utils";
import { subgraphFetch } from "../../nouns-subgraph.js";

export const parseNeynarUsers = async ({ chainId }, users) => {
  const verifiedAddresses = arrayUtils.unique(
    users.flatMap((u) => u.verifications.map((v) => v.toLowerCase())),
  );

  const { delegates } = await subgraphFetch({
    chainId,
    query: `
      query {
        delegates(where: { id_in: [${verifiedAddresses.map((a) => `"${a}"`)}] }) {
          id
        }
      }`,
  });

  return users.map((user) => {
    const account = {
      fid: user.fid,
      username: user.username === `!${user.fid}` ? null : user.username,
      displayName: user["display_name"],
      pfpUrl: user["pfp_url"],
    };

    const verifiedAddresses = user.verifications.map((a) => a.toLowerCase());

    const delegate = delegates.find((d) => verifiedAddresses.includes(d.id));

    if (delegate != null) account.nounerAddress = delegate.id;

    return account;
  });
};
