"""Maps appointment data to Mantys visit types."""
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Valid visit types
VALID_VISIT_TYPES = {
    "OUTPATIENT",
    "INPATIENT",
    "DENTAL",
    "OPTICAL",
    "MATERNITY",
    "PSYCHIATRY",
    "WELLNESS",
    "CHRONIC_OUT",
    "EMERGENCY",
    "LIFE",
    "TRAVEL_INSURANCE",
}

# Specialisation name keywords to visit type mapping
SPECIALISATION_KEYWORDS = {
    "DENTAL": "DENTAL",
    "DENTIST": "DENTAL",
    "OPTICAL": "OPTICAL",
    "OPTOMETRIST": "OPTICAL",
    "OPHTHALMOLOGIST": "OPTICAL",
    "EYE": "OPTICAL",
    "MATERNITY": "MATERNITY",
    "OBSTETRIC": "MATERNITY",
    "GYNECOLOG": "MATERNITY",
    "PSYCHIATRY": "PSYCHIATRY",
    "PSYCHIATRIST": "PSYCHIATRY",
    "MENTAL": "PSYCHIATRY",
    "WELLNESS": "WELLNESS",
}


def determine_visit_type(appointment: Dict[str, Any]) -> str:
    """
    Determine visit type from appointment data.
    
    Priority order:
    1. Check specialisation_name for keywords
    2. Check visitTypeId if available (would need mapping table)
    3. Check isEmergencyAppointment flag
    4. Default to OUTPATIENT
    
    Args:
        appointment: Appointment dictionary
    
    Returns:
        Visit type string (default: "OUTPATIENT")
    """
    # Priority 1: Check specialisation_name for keywords
    specialisation_name = (
        appointment.get("specialisation_name")
        or appointment.get("specialisationName")
        or appointment.get("specialization_name")
        or appointment.get("specializationName")
    )
    
    if specialisation_name:
        specialisation_upper = str(specialisation_name).upper()
        for keyword, visit_type in SPECIALISATION_KEYWORDS.items():
            if keyword in specialisation_upper:
                logger.debug(
                    f"Determined visit type {visit_type} from "
                    f"specialisation '{specialisation_name}'"
                )
                return visit_type
    
    # Priority 2: Check visitTypeId
    # Note: This would require a mapping table from visitTypeId to visit type
    # For now, we'll skip this as we don't have the mapping
    visit_type_id = appointment.get("visitTypeId") or appointment.get("visit_type_id")
    if visit_type_id:
        logger.debug(f"Found visitTypeId {visit_type_id}, but no mapping available")
        # Could add mapping here if visitTypeId to visit type mapping is available
    
    # Priority 3: Check isEmergencyAppointment flag
    is_emergency = (
        appointment.get("isEmergencyAppointment")
        or appointment.get("is_emergency_appointment")
        or appointment.get("emergency")
    )
    
    if is_emergency:
        # Convert to boolean if it's a string
        if isinstance(is_emergency, str):
            is_emergency = is_emergency.lower() in ("true", "1", "yes")
        
        if is_emergency:
            logger.debug("Determined visit type EMERGENCY from isEmergencyAppointment flag")
            return "EMERGENCY"
    
    # Priority 4: Default to OUTPATIENT
    logger.debug("Using default visit type OUTPATIENT")
    return "OUTPATIENT"


def is_valid_visit_type(visit_type: str) -> bool:
    """
    Check if a visit type is valid.
    
    Args:
        visit_type: Visit type to validate
    
    Returns:
        True if valid, False otherwise
    """
    return visit_type in VALID_VISIT_TYPES

