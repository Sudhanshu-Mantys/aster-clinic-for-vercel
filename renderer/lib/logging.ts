/**
 * Log button clicks to Mantys analytics API
 * Uses shared mantys-config for consistent access to client/clinic/ID configuration
 */

import { getClientId, getClinicId, getAccessToken, MANTYS_API_BASE_URL } from "./mantys-config";

export const logButtonClick = async (
  correlation_task_id: string | undefined,
  button_name: string
): Promise<void> => {
  if (!correlation_task_id) {
    console.warn("logButtonClick: correlation_task_id is missing. Skipping log.");
    return;
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    console.warn("logButtonClick: Access token not found in localStorage. Skipping log.");
    return;
  }

  try {
    const CLIENT_ID = getClientId();
    const CLINIC_ID = getClinicId();

    const response = await fetch(`${MANTYS_API_BASE_URL}/v2/eligibilities-dashboard/button-clicks/`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Client-ID": CLIENT_ID,
        "X-Clinic-ID": CLINIC_ID,
      },
      body: JSON.stringify({
        correlation_task_id,
        button_name,
      }),
    });

    if (!response.ok) {
      console.error(
        `Error logging button click: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.error("Network or other error logging button click:", error);
  }
};
