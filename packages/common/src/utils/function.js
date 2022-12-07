export const identity = (_) => _;

export const compose =
  (...fns) =>
  (x, ...rest) =>
    fns.reduceRight((v, f) => f(v, ...rest), x);

export const waterfall = (promiseCreators) => {
  const responses = [];
  return promiseCreators
    .reduce(
      (previousPromise, createPromise) =>
        previousPromise.then(() =>
          createPromise()
            .then((res) => {
              responses.push(res);
            })
            .catch()
        ),
      Promise.resolve()
    )
    .then(() => responses);
};
