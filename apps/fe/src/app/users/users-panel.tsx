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
import { useState } from "react";

export function UsersPanel() {
  const queryClient = useQueryClient();
  // Suspense variant: the data is already in the cache from the server
  // prefetch, so this renders on the first pass with no loading state.
  const { data } = useUsersFindAllSuspense();

  // Both mutations refetch the list rather than patching the cache by hand -
  // the shorter path to a correct ui, and the one to start from.
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getUsersFindAllQueryKey() });

  const create = useUsersCreate({ mutation: { onSuccess: invalidate } });
  const remove = useUsersRemove({ mutation: { onSuccess: invalidate } });

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();

  function submit(event: React.FormEvent) {
    event.preventDefault();

    // Normalized first, exactly as CreateUserDto's @Transform does on the
    // server. class-transformer runs before class-validator, so the backend
    // validates the trimmed value - but a @Transform is invisible to the
    // OpenAPI spec, so the generated schema only ever sees the raw string.
    // Skip this and a pasted "  ada@example.com " is rejected here and
    // accepted there.
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
          className="border-border bg-background flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={create.isPending}>
          Add
        </Button>
      </form>

      {/* Client-side rejection, then whatever the backend answered - for
          both mutations: a delete that 404s because another tab got there
          first would otherwise leave the row in place with no explanation. */}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {create.error && (
        <p className="mt-2 text-sm text-red-600">
          {create.error.error.message}
        </p>
      )}
      {remove.error && (
        <p className="mt-2 text-sm text-red-600">
          {remove.error.error.message}
        </p>
      )}

      <ul className="divide-border mt-6 divide-y">
        {data.data.map((user) => (
          <li key={user.id} className="flex items-center justify-between py-3">
            <span className="text-sm">{user.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove.mutate({ id: user.id })}
            >
              Remove
            </Button>
          </li>
        ))}
        {data.data.length === 0 && (
          <li className="text-muted-foreground py-3 text-sm">No users yet.</li>
        )}
      </ul>
    </div>
  );
}
