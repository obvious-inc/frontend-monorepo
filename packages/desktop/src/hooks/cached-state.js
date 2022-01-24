const useCachedState = (key, initialState, storage = window.localStorage) => {
  const [cachedState, setState] = useState(() => {
    const initialState_ =
      typeof initialState === "function" ? initialState() : initialState;

    try {
      const cachedState = storage.getItem(key);
      return cachedState == null ? initialState_ : JSON.parse(cachedState);
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setCachedState = (newState_) => {
    try {
      const newState =
        typeof newState_ === "function" ? newState_(cachedState) : newState_;

      setState(newState);
      storage.setItem(key, JSON.stringify(newState));
    } catch (error) {
      console.error(error);
    }
  };

  return [cachedState, setCachedState];
};

export default useCachedState;
