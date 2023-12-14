export default [].map((item) => ({
  ...item,
  description: item.description ?? item.id,
  aliases: [item.id, ...(item.aliases ?? [])],
  tags: item.tags ?? [],
  category: item.category ?? "Custom",
}));
