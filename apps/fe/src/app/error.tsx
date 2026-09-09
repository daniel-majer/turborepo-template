"use client";

import { Button } from "@repo/ui/components/button";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();

  useEffect(() => {
    // Send errors to your reporting service here if needed.
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <span className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
          Error
        </span>
        <h1 className="mt-6 text-3xl font-medium tracking-tight text-balance">
          Something went wrong.
        </h1>
        <p className="text-muted-foreground mt-4 leading-relaxed text-pretty">
          An unexpected error occurred. Try again, or head back home.
        </p>
        {error.digest ? (
          <code className="text-muted-foreground mt-4 font-mono text-xs">
            {error.digest}
          </code>
        ) : null}
        <Button
          size="lg"
          className="mt-8"
          onClick={() => {
            resetQueries();
            retry();
          }}
        >
          Try again
        </Button>
      </div>
    </main>
  );
}
