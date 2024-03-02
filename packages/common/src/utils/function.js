export const identity = (_) => _;

export const compose =
  (...fns) =>
  (x, ...rest) =>
    fns.reduceRight((v, f) => f(v, ...rest), x);

export const pipe =
  (...fns) =>
  (x, ...rest) =>
    fns.reduce((v, f) => f(v, ...rest), x);

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
            .catch(),
        ),
      Promise.resolve(),
    )
    .then(() => responses);
};

export const retryAsync = (
  createPromise,
  { retries = 3, timeout = 1000 } = {},
) =>
  new Promise((resolve, reject) => {
    createPromise().then(resolve, (e) => {
      if (retries < 1) return reject(e);
      setTimeout(() => {
        retryAsync(createPromise, { retries: retries - 1, timeout }).then(
          resolve,
          reject,
        );
      }, timeout);
    });
  });
