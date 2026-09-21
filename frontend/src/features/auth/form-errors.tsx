export function FormErrors({
  message,
  fields,
}: {
  message: string | null;
  fields: Record<string, string[]>;
}) {
  return (
    <>
      {message ? (
        <p className="form-error" role="alert">
          {message}
        </p>
      ) : null}
      {Object.entries(fields).map(([field, errors]) => (
        <p className="field-error" id={`${field}-error`} key={field}>
          {errors.join(" ")}
        </p>
      ))}
    </>
  );
}
