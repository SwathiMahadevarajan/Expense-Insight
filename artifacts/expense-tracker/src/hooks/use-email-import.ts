import { useQueryClient } from "@tanstack/react-query";
import {
  useParseEmailTransaction as useGeneratedParse,
  useImportEmailTransactions as useGeneratedImport,
} from "@workspace/api-client-react";

export function useParseEmailTransaction() {
  return useGeneratedParse();
}

export function useImportEmailTransactions() {
  const queryClient = useQueryClient();
  return useGeneratedImport({
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
