import { kv } from "@vercel/kv";

export const setPendingAccountKey = ({ publicKey, privateKey }) =>
  kv.set(`pending-account-key:${publicKey}`, privateKey, {
    ex: 60 * 60 * 2, // Expire after 2 hours (key request deadline is 1h)
  });

export const persistPendingAccountKeyForFid = ({ publicKey, fid }) => {
  const kvPipeline = kv.pipeline();
  // Assuming the key exists here. It’s fine.
  kvPipeline.renamenx(
    `pending-account-key:${publicKey}`,
    `fid:${fid}:account-key`,
  );
  // We need to persist to remove the set timeout
  kvPipeline.persist(`fid:${fid}:account-key`);
  return kvPipeline.exec();
};

export const getAccountKeyForFid = (fid) => kv.get(`fid:${fid}:account-key`);

export const deleteAccountKeyForFid = (fid) => kv.del(`fid:${fid}:account-key`);
