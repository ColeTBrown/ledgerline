"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Tooltip } from "radix-ui";
import { useSettings } from "@/lib/store/settings";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 15_000 },
        },
      }),
  );

  useEffect(() => {
    void useSettings.persist.rehydrate();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <Tooltip.Provider delayDuration={300} skipDelayDuration={100}>
          {children}
        </Tooltip.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
