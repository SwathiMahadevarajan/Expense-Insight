import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateCategory as useGeneratedCreate,
  useUpdateCategory as useGeneratedUpdate,
  useDeleteCategory as useGeneratedDelete,
} from "@workspace/api-client-react";

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useGeneratedCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      },
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useGeneratedUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      },
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useGeneratedDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      },
    },
  });
}
