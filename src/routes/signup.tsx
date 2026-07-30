import { createFileRoute, redirect } from "@tanstack/react-router";

const signupSearchSchema = (value: Record<string, unknown>) => ({
  ref: typeof value.ref === "string" ? value.ref : undefined,
});

/** Marketing-friendly /signup?ref=CODE — forwards to the auth page in signup mode. */
export const Route = createFileRoute("/signup")({
  validateSearch: signupSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/auth", search: { ref: search.ref } });
  },
});
