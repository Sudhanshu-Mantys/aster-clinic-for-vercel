import React from "react";
import type { AppProps } from "next/app";
import { AuthProvider } from "../contexts/AuthContext";
import { QueryProvider } from "../lib/query-client";
import { EligibilityPollingManager } from "../components/EligibilityPollingManager";

import "../styles/globals.css";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <QueryProvider>
      <AuthProvider>
        <EligibilityPollingManager />
        <Component {...pageProps} />
      </AuthProvider>
    </QueryProvider>
  );
}

export default MyApp;
