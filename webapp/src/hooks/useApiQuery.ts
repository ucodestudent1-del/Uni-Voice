import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

export function useApiQuery<TData>(
  key: string | readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, Error>, "queryKey" | "queryFn">,
) {
  return useQuery<TData>({
    queryKey: typeof key === "string" ? [key] : key,
    queryFn,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    ...options,
  });
}

