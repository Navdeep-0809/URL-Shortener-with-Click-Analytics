export function isDuplicateKeyError(error, field) {
  return (
    error?.code === 11000 &&
    (error.keyPattern?.[field] === 1 || Object.hasOwn(error.keyValue ?? {}, field))
  );
}
