import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateAccount as useGeneratedCreate,
  useUpdateAccount as useGeneratedUpdate,
  useDeleteAccount as useGeneratedDelete,
} from "@workspace/api-client-react";

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useGeneratedCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/summary"] });
      },
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useGeneratedUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/summary"] });
      },
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useGeneratedDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/insights/summary"] });
      },
    },
  });
}
