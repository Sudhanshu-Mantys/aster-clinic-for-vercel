"""Processes appointments and creates Mantys eligibility checks."""
import logging
from typing import Optional, Dict, Any, Tuple
import requests
from config import config
from tpa_mapper import extract_tpa_code_from_appointment, is_valid_tpa_code
from visit_type_mapper import determine_visit_type, is_valid_visit_type

logger = logging.getLogger(__name__)


def determine_id_type_and_value(
    appointment: Dict[str, Any],
    insurance_data: Optional[Dict[str, Any]] = None,
) -> Optional[Tuple[str, str]]:
    """
    Determine ID type and value from appointment and insurance data.
    
    Priority order:
    1. Member ID (CARDNUMBER): From insurance data (tpa_policy_id, insurance_policy_id, policy_number)
    2. Emirates ID (EMIRATESID): From appointment data (nationality_id, uid_value)
    3. DHA Member ID (DHAMEMBERID): If available in patient data
    
    Args:
        appointment: Appointment dictionary
        insurance_data: Optional insurance data dictionary
    
    Returns:
        Tuple of (id_type, id_value) or None if not found
    """
    # Priority 1: Try to get Member ID from insurance data
    if insurance_data:
        # Check tpa_policy_id first
        tpa_policy_id = insurance_data.get("tpa_policy_id") or insurance_data.get("tpaPolicyId")
        if tpa_policy_id and str(tpa_policy_id).strip():
            id_value = str(tpa_policy_id).strip()
            logger.debug(f"Found Member ID from tpa_policy_id: {id_value}")
            return ("CARDNUMBER", id_value)
        
        # Check insurance_policy_id
        insurance_policy_id = (
            insurance_data.get("insurance_policy_id")
            or insurance_data.get("insurancePolicyId")
        )
        if insurance_policy_id and str(insurance_policy_id).strip():
            id_value = str(insurance_policy_id).strip()
            logger.debug(f"Found Member ID from insurance_policy_id: {id_value}")
            return ("CARDNUMBER", id_value)
        
        # Check policy_number
        policy_number = insurance_data.get("policy_number") or insurance_data.get("policyNumber")
        if policy_number and str(policy_number).strip():
            id_value = str(policy_number).strip()
            logger.debug(f"Found Member ID from policy_number: {id_value}")
            return ("CARDNUMBER", id_value)
        
        # Check ins_holderid
        ins_holderid = insurance_data.get("ins_holderid") or insurance_data.get("insHolderId")
        if ins_holderid and str(ins_holderid).strip():
            id_value = str(ins_holderid).strip()
            logger.debug(f"Found Member ID from ins_holderid: {id_value}")
            return ("CARDNUMBER", id_value)
    
    # Priority 2: Try Emirates ID from appointment data
    # Check nationality_id
    nationality_id = appointment.get("nationality_id") or appointment.get("nationalityId")
    if nationality_id and str(nationality_id).strip():
        id_value = str(nationality_id).strip()
        logger.debug(f"Found Emirates ID from nationality_id: {id_value}")
        return ("EMIRATESID", id_value)
    
    # Check uid_value
    uid_value = appointment.get("uid_value") or appointment.get("uidValue")
    if uid_value and str(uid_value).strip():
        id_value = str(uid_value).strip()
        logger.debug(f"Found Emirates ID from uid_value: {id_value}")
        return ("EMIRATESID", id_value)
    
    # Priority 3: Try DHA Member ID (if available)
    # This would need to be in patient data - check common fields
    dha_member_id = (
        appointment.get("dha_member_id")
        or appointment.get("dhaMemberId")
        or appointment.get("member_id")
        or appointment.get("memberId")
    )
    if dha_member_id and str(dha_member_id).strip():
        id_value = str(dha_member_id).strip()
        logger.debug(f"Found DHA Member ID: {id_value}")
        return ("DHAMEMBERID", id_value)
    
    logger.warning("Could not determine ID type and value from appointment data")
    return None


def create_mantys_eligibility_check(
    appointment: Dict[str, Any],
    tpa_code: str,
    visit_type: str,
    id_type: str,
    id_value: str,
) -> Optional[str]:
    """
    Create a Mantys eligibility check task via API.
    
    Args:
        appointment: Appointment dictionary
        tpa_code: TPA code (e.g., "TPA001")
        visit_type: Visit type (e.g., "OUTPATIENT")
        id_type: ID type ("EMIRATESID", "CARDNUMBER", or "DHAMEMBERID")
        id_value: ID value
    
    Returns:
        Task ID if successful, None otherwise
    """
    url = f"{config.API_BASE_URL}/api/mantys/eligibility-check"
    
    # Extract patient metadata
    mpi = appointment.get("mpi") or ""
    patient_id = appointment.get("patient_id") or appointment.get("patientId")
    patient_name = (
        appointment.get("full_name")
        or appointment.get("fullName")
        or appointment.get("patient_name")
        or appointment.get("patientName")
        or ""
    )
    appointment_id = appointment.get("appointment_id") or appointment.get("appointmentId")
    encounter_id = appointment.get("encounter_id") or appointment.get("encounterId")
    
    payload = {
        "id_value": id_value,
        "id_type": id_type,
        "tpa_name": tpa_code,
        "visit_type": visit_type,
    }
    
    # Add optional metadata
    if mpi:
        payload["mpi"] = mpi
    if patient_id:
        payload["patientId"] = str(patient_id)
    if patient_name:
        payload["patientName"] = patient_name
    if appointment_id:
        payload["appointmentId"] = int(appointment_id)
    if encounter_id:
        payload["encounterId"] = int(encounter_id)
    
    logger.info(
        f"Creating Mantys eligibility check for appointment {appointment_id}: "
        f"TPA={tpa_code}, VisitType={visit_type}, IDType={id_type}"
    )
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        task_id = data.get("task_id")
        
        if not task_id:
            logger.error(f"No task_id in response: {data}")
            return None
        
        logger.info(f"Successfully created Mantys task {task_id} for appointment {appointment_id}")
        return task_id
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to create Mantys eligibility check: {e}")
        if hasattr(e, "response") and e.response is not None:
            try:
                error_data = e.response.json()
                logger.error(f"Error response: {error_data}")
            except Exception:
                logger.error(f"Error response text: {e.response.text}")
        return None
    except (KeyError, ValueError) as e:
        logger.error(f"Error parsing Mantys API response: {e}")
        return None


def process_appointment_for_eligibility(
    appointment: Dict[str, Any],
    insurance_data: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Process an appointment and create a Mantys eligibility check.
    
    This function:
    1. Extracts TPA code from appointment
    2. Determines visit type
    3. Determines ID type and value
    4. Creates Mantys task
    
    Args:
        appointment: Appointment dictionary
        insurance_data: Optional insurance data dictionary
    
    Returns:
        Task ID if successful, None otherwise
    """
    # Step 1: Extract TPA code
    tpa_code = extract_tpa_code_from_appointment(appointment)
    if not tpa_code or not is_valid_tpa_code(tpa_code):
        logger.warning(
            f"Appointment {appointment.get('appointment_id')} has no valid TPA code"
        )
        return None
    
    # Step 2: Determine visit type
    visit_type = determine_visit_type(appointment)
    if not is_valid_visit_type(visit_type):
        logger.warning(
            f"Appointment {appointment.get('appointment_id')} has invalid visit type: {visit_type}"
        )
        return None
    
    # Step 3: Determine ID type and value
    id_info = determine_id_type_and_value(appointment, insurance_data)
    if not id_info:
        logger.warning(
            f"Appointment {appointment.get('appointment_id')} has no valid ID"
        )
        return None
    
    id_type, id_value = id_info
    
    # Step 4: Create Mantys task
    task_id = create_mantys_eligibility_check(
        appointment=appointment,
        tpa_code=tpa_code,
        visit_type=visit_type,
        id_type=id_type,
        id_value=id_value,
    )
    
    return task_id

