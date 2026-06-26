import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {RouterProvider} from "react-router";

import {ThemeProvider} from "@infinitechat/design-system";

import {ErrorBoundary} from "./app/ErrorBoundary";
import {router} from "./app/router";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {staleTime: 30_000, retry: 1, refetchOnWindowFocus: false},
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
