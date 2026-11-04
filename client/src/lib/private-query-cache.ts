import type { QueryClient } from "@tanstack/react-query";

const PRIVATE_QUERY_PREFIXES: readonly (readonly unknown[])[] = [
  ["profile"],
  ["properties", "mine"],
  ["properties", "deletion-notices"],
  ["properties", "saved"],
  ["properties", "listing-quota"],
  ["property-saved"],
  ["property-management"],
  ["admin"],
  ["moderation"],
];

export function clearPrivateQueryCache(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: ({ queryKey }) =>
      PRIVATE_QUERY_PREFIXES.some((prefix) =>
        prefix.every((key, index) => queryKey[index] === key)
      ),
  });
}
