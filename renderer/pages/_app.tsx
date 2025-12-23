import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import { AuthProvider } from "../contexts/AuthContext";
import { QueryProvider } from "../lib/query-client";
import pollingService from "../services/eligibilityPollingService";

import "../styles/globals.css";

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    console.log("[App] Initializing eligibility polling service");
    pollingService.initialize().catch(error => {
      console.error("[App] Error initializing polling service:", error);
    });

    return () => {
      pollingService.shutdown();
    };
  }, []);

  return (
    <QueryProvider>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </QueryProvider>
  );
}

export default MyApp;
