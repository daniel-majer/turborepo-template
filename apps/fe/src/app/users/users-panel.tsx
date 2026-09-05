"use client";

import {
  getUsersFindAllQueryKey,
  useUsersCreate,
  useUsersFindAllSuspense,
  useUsersRemove,
} from "@repo/api-client";
import { UsersCreateBody } from "@repo/api-client/schemas";
import { Button } from "@repo/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";

export function UsersPanel() {
  const queryClient = useQueryClient();
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  const [isNavigating, startTransition] = useTransition();
  const cursor = cursors.at(-1);
  // Read the server-prefetched cache.
  const { data, isFetching } = useUsersFindAllSuspense(
    cursor === undefined ? undefined : { cursor },
  );

  // Refetch the list after either mutation.
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getUsersFindAllQueryKey() });

  const create = useUsersCreate({ mutation: { onSuccess: invalidate } });
  const remove = useUsersRemove({ mutation: { onSuccess: invalidate } });

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const mutationError = create.error ?? remove.error;
  const busy =
    isNavigating || isFetching || create.isPending || remove.isPending;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    create.reset();
    remove.reset();

    // Match CreateUserDto normalization; OpenAPI does not capture @Transform.
    const parsed = UsersCreateBody.safeParse({
      email: email.trim().toLowerCase(),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }

    setError(undefined);
    create.mutate({ data: parsed.data }, { onSuccess: () => setEmail("") });
  }

  return (
    <div className="mt-8">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ada@example.com"
          aria-label="Email"
          aria-invalid={Boolean(error)}
          aria-describedby={error || mutationError ? "users-error" : undefined}
          className="border-border bg-background flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={create.isPending}>
          Add
        </Button>
      </form>

      {(error || mutationError) && (
        <p
          id="users-error"
          role="alert"
          className="text-destructive mt-2 text-sm"
        >
          {error ?? mutationError?.error.message}
          {!error && mutationError?.error.requestId && (
            <span className="block">
              Request: {mutationError.error.requestId}
            </span>
          )}
        </p>
      )}

      <ul className="divide-border mt-6 divide-y">
        {data.data.map((user) => (
          <li key={user.id} className="flex items-center justify-between py-3">
            <span className="text-sm">{user.email}</span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${user.email}`}
              disabled={remove.isPending || isNavigating}
              onClick={() => {
                setError(undefined);
                create.reset();
                remove.mutate({ id: user.id });
              }}
            >
              Remove
            </Button>
          </li>
        ))}
        {data.data.length === 0 && (
          <li className="text-muted-foreground py-3 text-sm">
            {cursor === undefined ? "No users yet." : "No users on this page."}
          </li>
        )}
      </ul>

      <nav
        aria-label="User pages"
        className="mt-4 flex items-center justify-between gap-4"
      >
        <Button
          variant="outline"
          size="sm"
          disabled={cursors.length === 1 || busy}
          onClick={() =>
            startTransition(() => setCursors((pages) => pages.slice(0, -1)))
          }
        >
          Previous
        </Button>
        <output className="text-muted-foreground text-sm">
          {isNavigating ? "Loading page…" : `Page ${cursors.length}`}
        </output>
        <Button
          variant="outline"
          size="sm"
          disabled={
            !data.meta.hasNextPage || data.meta.nextCursor === null || busy
          }
          onClick={() => {
            const nextCursor = data.meta.nextCursor;
            if (nextCursor !== null) {
              startTransition(() =>
                setCursors((pages) => [...pages, nextCursor]),
              );
            }
          }}
        >
          Next
        </Button>
      </nav>
    </div>
  );
}
