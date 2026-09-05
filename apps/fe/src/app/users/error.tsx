"use client";

/** Keep API failures inside this route; Next requires a client error boundary. */
export default function UsersError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-24">
      <h1 className="text-3xl font-medium tracking-tight">Users</h1>
      <p className="mt-4 text-sm text-red-600">{error.message}</p>
      <p className="text-muted-foreground mt-2 text-sm">
        Is the backend running? <code>bun run dev</code> starts both apps.
      </p>
      <button
        onClick={reset}
        className="border-border mt-6 rounded-md border px-3 py-2 text-sm"
      >
        Try again
      </button>
    </main>
  );
}
