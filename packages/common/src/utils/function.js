export const identity = (_) => _;

export const compose =
  (...fns) =>
  (x, ...rest) =>
    fns.reduceRight((v, f) => f(v, ...rest), x);

export const waterfall = (promiseCreators) => {
  const responses = [];
  return promiseCreators
    .reduce((previousPromise, createPromise) => {
      if (previousPromise == null) return createPromise();
      return previousPromise
        .then((res) => {
          responses.push(res);
        })
        .catch()
        .then(() => createPromise());
    }, null)
    .then(() => responses);
};
