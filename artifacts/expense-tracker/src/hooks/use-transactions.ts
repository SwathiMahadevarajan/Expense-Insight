import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateTransaction as useGeneratedCreate,
  useUpdateTransaction as useGeneratedUpdate,
  useDeleteTransaction as useGeneratedDelete,
} from "@workspace/api-client-react";

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useGeneratedCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/spending-by-category"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/daily-spending"] });
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      },
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useGeneratedUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/spending-by-category"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/daily-spending"] });
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      },
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useGeneratedDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/spending-by-category"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/daily-spending"] });
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      },
    },
  });
}
