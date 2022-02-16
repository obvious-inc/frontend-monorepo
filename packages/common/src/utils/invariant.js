const invariant = (condition, message) => {
  if (condition) return;

  const error = new Error(message);

  error.name = "Invariant violation";

  throw error;
};

export default invariant;
