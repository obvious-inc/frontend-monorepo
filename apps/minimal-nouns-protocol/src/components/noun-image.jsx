import { useNounsTokenRead, useDescriptorRead } from "../hooks/contracts.js";

const NounImage = ({ nounId, ...props }) => {
  const { data: seedArray } = useNounsTokenRead("seeds", {
    args: [nounId],
    enabled: nounId != null,
  });
  const { data: base64Svg } = useDescriptorRead("generateSVGImage", {
    args: [
      {
        background: seedArray?.[0],
        body: seedArray?.[1],
        accessory: seedArray?.[2],
        head: seedArray?.[3],
        glasses: seedArray?.[4],
      },
    ],
    enabled: seedArray != null,
  });

  if (base64Svg == null) return null;

  return <img src={`data:image/svg+xml;base64,${base64Svg}`} {...props} />;
};

export default NounImage;
