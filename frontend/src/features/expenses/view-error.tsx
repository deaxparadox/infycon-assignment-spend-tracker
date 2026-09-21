import { ApiError } from "@/lib/api/client";

export type ViewFailure = {
  kind: "validation" | "authentication" | "server" | "network";
  message: string;
};

export function classifyViewFailure(error: unknown): ViewFailure {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      const details = Object.values(error.fields).flat().join(" ");
      return {
        kind: "validation",
        message: details || error.message,
      };
    }
    if (error.status === 401) {
      return {
        kind: "authentication",
        message: "Your session has expired. Redirecting to sign in…",
      };
    }
    return {
      kind: "server",
      message: "The server could not complete this request. Please retry.",
    };
  }
  return {
    kind: "network",
    message: "The API could not be reached. Check your connection and retry.",
  };
}

export function ViewError({
  failure,
  onRetry,
}: {
  failure: ViewFailure;
  onRetry: () => void;
}) {
  return (
    <section className={`view-message view-message-${failure.kind}`} role="alert">
      <p>{failure.message}</p>
      {failure.kind === "server" || failure.kind === "network" ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </section>
  );
}
