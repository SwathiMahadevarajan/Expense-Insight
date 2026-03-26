import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateNotification as useGeneratedCreate,
  useUpdateNotification as useGeneratedUpdate,
  useDeleteNotification as useGeneratedDelete,
} from "@workspace/api-client-react";

export function useCreateNotification() {
  const queryClient = useQueryClient();
  return useGeneratedCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      },
    },
  });
}

export function useUpdateNotification() {
  const queryClient = useQueryClient();
  return useGeneratedUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      },
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useGeneratedDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      },
    },
  });
}
