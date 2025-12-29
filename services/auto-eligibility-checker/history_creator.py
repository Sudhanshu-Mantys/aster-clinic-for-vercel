"""Creates eligibility history items after creating Mantys tasks."""
import logging
from typing import Optional, Dict, Any
import requests
from config import config

logger = logging.getLogger(__name__)


def create_eligibility_history_item(
    appointment: Dict[str, Any],
    task_id: str,
    tpa_code: Optional[str] = None,
) -> Optional[str]:
    """
    Create an eligibility history item via API.
    
    This allows the frontend's EligibilityPollingManager to find and poll the task.
    
    Args:
        appointment: Appointment dictionary
        task_id: Mantys task ID
        tpa_code: Optional TPA code (for insurancePayer field)
    
    Returns:
        History item ID if successful, None otherwise
    """
    url = f"{config.API_BASE_URL}/api/eligibility-history"
    
    # Extract patient information
    patient_id = appointment.get("patient_id") or appointment.get("patientId")
    patient_name = (
        appointment.get("full_name")
        or appointment.get("fullName")
        or appointment.get("patient_name")
        or appointment.get("patientName")
        or ""
    )
    mpi = appointment.get("mpi") or ""
    dob = appointment.get("dob") or appointment.get("dateOfBirth")
    appointment_id = appointment.get("appointment_id") or appointment.get("appointmentId")
    encounter_id = appointment.get("encounter_id") or appointment.get("encounterId")
    
    # Use patient_id as string, fallback to mpi if patient_id not available
    patient_id_str = str(patient_id) if patient_id else mpi
    
    if not patient_id_str:
        logger.warning(
            f"Cannot create history item: no patient_id or mpi for appointment {appointment_id}"
        )
        return None
    
    payload = {
        "clinicId": config.CLINIC_ID,
        "patientId": patient_id_str,
        "taskId": task_id,
        "status": "pending",
        "pollingAttempts": 0,
    }
    
    # Add optional fields
    if patient_name:
        payload["patientName"] = patient_name
    if dob:
        payload["dateOfBirth"] = str(dob)
    if tpa_code:
        payload["insurancePayer"] = tpa_code
    if mpi:
        payload["patientMPI"] = mpi
    if appointment_id:
        payload["appointmentId"] = int(appointment_id)
    if encounter_id:
        payload["encounterId"] = int(encounter_id)
    
    logger.info(
        f"Creating eligibility history item for appointment {appointment_id}, "
        f"task {task_id}, patient {patient_id_str}"
    )
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        history_id = data.get("id")
        
        if not history_id:
            logger.error(f"No id in history item response: {data}")
            return None
        
        logger.info(
            f"Successfully created eligibility history item {history_id} "
            f"for task {task_id}"
        )
        return history_id
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to create eligibility history item: {e}")
        if hasattr(e, "response") and e.response is not None:
            try:
                error_data = e.response.json()
                logger.error(f"Error response: {error_data}")
            except Exception:
                logger.error(f"Error response text: {e.response.text}")
        return None
    except (KeyError, ValueError) as e:
        logger.error(f"Error parsing history API response: {e}")
        return None

