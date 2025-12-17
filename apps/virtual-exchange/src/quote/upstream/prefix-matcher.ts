export interface IPrefixMatcher<T> {
  match: (value: string) => T[];
}

export const createSortedPrefixMatcher = <T>(
  entries: Array<{ prefix: string; value: T }>,
): IPrefixMatcher<T> => {
  const sorted = [...entries].sort((a, b) => b.prefix.length - a.prefix.length);
  return {
    match: (value: string): T[] => sorted.filter((x) => value.startsWith(x.prefix)).map((x) => x.value),
  };
};
