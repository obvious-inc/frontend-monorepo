export const identity = (_) => _;

export const compose =
  (...fns) =>
  (x, ...rest) =>
    fns.reduceRight((v, f) => f(v, ...rest), x);
