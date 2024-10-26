/**
 * Define a rule, when some of deps changed, check if condition is true, then do the effect.
 * @param ruleName - Rule Name, print log if effect triggered
 * @param condition - return true if need do effect; false if skip the effect.
 * @param effect - Effect same as useEffect
 * @param deps - Dependencies Array, check if changed.
 */
export const useRuleEffect = (
  ruleName: string,
  condition?: () => boolean,
  effect?: () => void | (() => void),
  deps?: any[],
) => {
  const log = useLog();
  useEffect(() => {
    if (condition?.()) {
      log(ruleName);
      return effect?.();
    }
  }, deps);
};
