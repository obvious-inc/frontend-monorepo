import { decodeAbiParameters, parseAbiItem } from "viem";

const DAO_PAYER_CONTRACT = "0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d";
const TOKEN_BUYER_CONTRACT = "0x4f2acdc74f6941390d9b1804fabc3e780388cfe5";
const CREATE_STREAM_SIGNATURE =
  "createStream(address,uint256,address,uint256,uint256,uint8,address)";

const decodeCalldataWithSignature = ({ signature, calldata }) => {
  const { name, inputs: inputTypes } = parseAbiItem(`function ${signature}`);
  const inputs = decodeAbiParameters(inputTypes, calldata);

  return {
    name,
    inputs: inputs.map((value, i) => ({
      value,
      type: inputTypes[i]?.type,
    })),
  };
};

export const parse = (transactions) => {
  const predictedStreamContractAddresses = transactions
    .filter((t) => t.signature === CREATE_STREAM_SIGNATURE)
    .map((t) => {
      const { inputs } = decodeCalldataWithSignature({
        signature: t.signature,
        calldata: t.calldata,
      });
      return inputs[6].value.toLowerCase();
    });

  return transactions.map(({ target, signature, calldata, value }) => {
    const hasSignature = (signature || null) != null;
    const isEthTransfer = !hasSignature && calldata === "0x";

    if (isEthTransfer)
      return target.toLowerCase() === TOKEN_BUYER_CONTRACT
        ? { type: "token-buyer-top-up", value }
        : { type: "transfer", target, value };

    if (!hasSignature)
      return { type: "unparsed-function-call", target, calldata, value };

    const { name: functionName, inputs: functionInputs } =
      decodeCalldataWithSignature({ signature, calldata });

    if (signature === CREATE_STREAM_SIGNATURE) {
      return {
        type: "stream",
        receiverAddress: functionInputs[0].value.toLowerCase(),
        tokenAmount: functionInputs[1].value,
        tokenContractAddress: functionInputs[2].value.toLowerCase(),
        startDate: new Date(Number(functionInputs[3].value) * 1000),
        endDate: new Date(Number(functionInputs[4].value) * 1000),
        streamContractAddress: functionInputs[6].value.toLowerCase(),
      };
    }

    if (
      target === DAO_PAYER_CONTRACT &&
      signature === "sendOrRegisterDebt(address,uint256)"
    ) {
      const receiverAddress = functionInputs[0].value.toLowerCase();
      const isStreamFunding = predictedStreamContractAddresses.some(
        (a) => a === receiverAddress
      );
      return {
        type: isStreamFunding ? "stream-funding-via-payer" : "usdc-transfer",
        functionName,
        functionInputs,
      };
    }

    return {
      target,
      type: "function-call",
      functionName,
      functionInputs,
    };
  });
};
