export const getTagsText = (tags: Record<string, string>) =>
  Object.entries(tags)
    .sort(([k1], [k2]) => k1.localeCompare(k2))
    .map(([k, v]) => `${k}=${v}`)
    .join('');

export const makeSecretSignerMessage = (
  signer: string,
  reader: string,
  tags: Record<string, string>,
  data: string,
): string => {
  return signer + reader + getTagsText(tags) + data;
};
