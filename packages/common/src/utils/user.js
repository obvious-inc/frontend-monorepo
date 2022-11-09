export const compareByOwnerOnlineStatusAndDisplayName = (m1, m2) => {
  if (m1.isOwner !== m2.isOwner) return m1.isOwner ? -1 : 1;

  if (m1.onlineStatus !== m2.onlineStatus)
    return m1.onlineStatus === "online" ? -1 : 1;

  const [name1, name2] = [m1, m2].map((m) => m.displayName?.toLowerCase());

  const [name1IsAddress, name2IsAddress] = [name1, name2].map(
    (n) => n != null && n.startsWith("0x") && n.includes("...")
  );

  if (!name1IsAddress && name2IsAddress) return -1;
  if (name1IsAddress && !name2IsAddress) return 1;

  if (name1 < name2) return -1;
  if (name1 > name2) return 1;
  return 0;
};
