export default function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);

  return function combination(state, action) {
    let hasChanged = false;

    const nextState = {};

    for (let i = 0; i < reducerKeys.length; i++) {
      const key = reducerKeys[i];
      const reducer = reducers[key];
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);

      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }

    hasChanged = hasChanged || reducerKeys.length !== Object.keys(state).length;

    return hasChanged ? nextState : state;
  };
}
