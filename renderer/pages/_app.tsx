import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import { AuthProvider } from "../contexts/AuthContext";
import pollingService from "../services/eligibilityPollingService";

import "../styles/globals.css";

function MyApp({ Component, pageProps }: AppProps) {
  // Initialize background polling service on app mount
  useEffect(() => {
    console.log("[App] Initializing eligibility polling service");
    pollingService.initialize().catch(error => {
      console.error("[App] Error initializing polling service:", error);
    });

    // Cleanup on unmount
    return () => {
      pollingService.shutdown();
    };
  }, []);

  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;
