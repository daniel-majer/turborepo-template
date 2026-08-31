"use client";

import { Button } from "@repo/ui/components/button";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with your error reporting service.
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
        <Button size="lg" className="mt-8" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
