/**
 * Mantys API Configuration
 * Shared across upload-document, button-clicks, and other Mantys APIs
 * Matches pattern from upload-document API (environment variables with hardcoded fallbacks)
 */

export const MANTYS_API_BASE_URL = "https://prod.api.mantys.org";

/**
 * Get Mantys Client ID
 * Uses environment variable first, falls back to hardcoded value
 */
export const getClientId = (): string => {
  return process.env.NEXT_PUBLIC_MANTYS_CLIENT_ID || "aster-clinic";
};

/**
 * Get Mantys Clinic ID
 * Uses environment variable first, falls back to hardcoded value
 */
export const getClinicId = (): string => {
  return process.env.NEXT_PUBLIC_MANTYS_CLINIC_ID || "92d5da39-36af-4fa2-bde3-3828600d7871";
};

/**
 * Get Mantys Access Token
 * Retrieves from localStorage
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem("stack_access_token");
};
