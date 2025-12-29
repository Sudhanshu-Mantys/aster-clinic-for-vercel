"""Maps appointment insurance data to Mantys TPA codes."""
import re
import json
import logging
from typing import Optional, Dict, Any
import redis
from config import config

logger = logging.getLogger(__name__)

# TPA code pattern: TPA followed by alphanumeric characters
TPA_CODE_PATTERN = re.compile(r"^TPA[0-9A-Z]+$")
# INS code pattern: INS followed by alphanumeric characters
INS_CODE_PATTERN = re.compile(r"^INS[0-9A-Z]+$")
# Other code patterns (D, DHPO, RIYATI)
OTHER_CODE_PATTERN = re.compile(r"^(D|DHPO|RIYATI)[0-9A-Z]*$")

# Redis key prefix for TPA configs
REDIS_TPA_CONFIG_PREFIX = "clinic:tpa"

# In-memory cache for insurance name to TPA code mappings
# Key: insurance_name (normalized), Value: ins_code
_insurance_name_cache: Optional[Dict[str, str]] = None
_cache_clinic_id: Optional[str] = None


def _normalize_insurance_name(name: str) -> str:
    """
    Normalize insurance name for matching.
    
    Args:
        name: Insurance name string
    
    Returns:
        Normalized name (uppercase, stripped)
    """
    return name.strip().upper()


def _load_tpa_configs_from_redis(clinic_id: str) -> Dict[str, str]:
    """
    Load TPA configs from Redis and build insurance name to code mapping.
    
    Args:
        clinic_id: Clinic ID
    
    Returns:
        Dictionary mapping insurance_name -> ins_code
    """
    mapping: Dict[str, str] = {}
    
    try:
        redis_client = redis.from_url(
            config.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        
        # Get all TPA config keys for this clinic
        pattern = f"{REDIS_TPA_CONFIG_PREFIX}:{clinic_id}:*"
        keys = redis_client.keys(pattern)
        
        # Filter out index keys
        config_keys = [key for key in keys if not key.endswith(":index")]
        
        if not config_keys:
            logger.debug(f"No TPA configs found in Redis for clinic {clinic_id}")
            return mapping
        
        # Load all configs
        for key in config_keys:
            try:
                data = redis_client.get(key)
                if data:
                    tpa_config = json.loads(data)
                    ins_code = tpa_config.get("ins_code")
                    
                    if not ins_code:
                        continue
                    
                    # Priority 1: Use insurance_name (from bulk import/mapping API)
                    insurance_name = tpa_config.get("insurance_name")
                    if insurance_name:
                        normalized_name = _normalize_insurance_name(insurance_name)
                        mapping[normalized_name] = ins_code
                    
                    # Priority 2: Use tpa_name as fallback (from form submission)
                    # Only if insurance_name wasn't available
                    if not insurance_name:
                        tpa_name = tpa_config.get("tpa_name")
                        if tpa_name:
                            normalized_name = _normalize_insurance_name(tpa_name)
                            # Only add if not already mapped
                            if normalized_name not in mapping:
                                mapping[normalized_name] = ins_code
                    
                    # Also check ins_payer if available (for additional matching)
                    ins_payer = tpa_config.get("ins_payer")
                    if ins_payer:
                        normalized_payer = _normalize_insurance_name(ins_payer)
                        # Only add if not already mapped (insurance_name/tpa_name takes priority)
                        if normalized_payer not in mapping:
                            mapping[normalized_payer] = ins_code
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Error parsing TPA config from key {key}: {e}")
                continue
        
        redis_client.close()
        logger.info(
            f"Loaded {len(mapping)} insurance name mappings from Redis "
            f"for clinic {clinic_id}"
        )
        
    except Exception as e:
        logger.error(f"Error loading TPA configs from Redis: {e}")
        # Return empty mapping on error, will fall back to hardcoded mappings
    
    return mapping


def _get_insurance_name_mapping(clinic_id: str) -> Dict[str, str]:
    """
    Get insurance name to TPA code mapping, using cache if available.
    
    Args:
        clinic_id: Clinic ID
    
    Returns:
        Dictionary mapping insurance_name -> ins_code
    """
    global _insurance_name_cache, _cache_clinic_id
    
    # Return cached mapping if clinic ID matches
    if _insurance_name_cache is not None and _cache_clinic_id == clinic_id:
        return _insurance_name_cache
    
    # Load from Redis
    _insurance_name_cache = _load_tpa_configs_from_redis(clinic_id)
    _cache_clinic_id = clinic_id
    
    return _insurance_name_cache


# Insurance name to TPA code mappings (fallback if Redis is unavailable)
# These can be extended based on clinic configuration
INSURANCE_NAME_TO_TPA: Dict[str, str] = {
    # Add common mappings here if needed
    # Example: "Neuron": "TPA001",
    # "NextCare": "TPA002",
}


def extract_tpa_code_from_appointment(
    appointment: Dict[str, Any],
    clinic_id: Optional[str] = None,
) -> Optional[str]:
    """
    Extract TPA code from appointment data.
    
    Priority order:
    1. receiver_code (if matches TPA/INS pattern)
    2. payer_code (if matches TPA/INS pattern)
    3. receiver_code (if matches other patterns like D, DHPO, RIYATI)
    4. payer_code (if matches other patterns)
    5. Insurance name mapping from Redis clinic config (from receiver_name, payer_name)
    6. Insurance name mapping from hardcoded fallback
    
    Args:
        appointment: Appointment dictionary
        clinic_id: Optional clinic ID (defaults to config.CLINIC_ID)
    
    Returns:
        TPA code string (e.g., "TPA001", "INS012") or None if not found
    """
    # Use clinic_id from parameter or config
    if clinic_id is None:
        clinic_id = config.CLINIC_ID
    
    # Priority 1: Check receiver_code for TPA/INS pattern
    receiver_code = appointment.get("receiver_code") or appointment.get("receiverCode")
    if receiver_code:
        receiver_code = str(receiver_code).strip()
        if TPA_CODE_PATTERN.match(receiver_code):
            logger.debug(f"Found TPA code from receiver_code: {receiver_code}")
            return receiver_code
        if INS_CODE_PATTERN.match(receiver_code):
            logger.debug(f"Found INS code from receiver_code: {receiver_code}")
            return receiver_code
    
    # Priority 2: Check payer_code for TPA/INS pattern
    payer_code = appointment.get("payer_code") or appointment.get("payerCode")
    if payer_code:
        payer_code = str(payer_code).strip()
        if TPA_CODE_PATTERN.match(payer_code):
            logger.debug(f"Found TPA code from payer_code: {payer_code}")
            return payer_code
        if INS_CODE_PATTERN.match(payer_code):
            logger.debug(f"Found INS code from payer_code: {payer_code}")
            return payer_code
    
    # Priority 3: Check receiver_code for other patterns (D, DHPO, RIYATI)
    if receiver_code and OTHER_CODE_PATTERN.match(receiver_code):
        logger.debug(f"Found other code from receiver_code: {receiver_code}")
        return receiver_code
    
    # Priority 4: Check payer_code for other patterns
    if payer_code and OTHER_CODE_PATTERN.match(payer_code):
        logger.debug(f"Found other code from payer_code: {payer_code}")
        return payer_code
    
    # Priority 5: Try insurance name mapping from Redis clinic config
    receiver_name = appointment.get("receiver_name") or appointment.get("receiverName")
    payer_name = appointment.get("payer_name") or appointment.get("payerName")
    
    # Get mapping from Redis (cached)
    redis_mapping = _get_insurance_name_mapping(clinic_id) if clinic_id else {}
    
    # Check receiver_name first
    if receiver_name:
        receiver_name = str(receiver_name).strip()
        normalized_name = _normalize_insurance_name(receiver_name)
        
        # Try Redis mapping first
        tpa_code = redis_mapping.get(normalized_name)
        if tpa_code:
            logger.debug(
                f"Found TPA code from receiver_name (Redis): "
                f"{receiver_name} -> {tpa_code}"
            )
            return tpa_code
        
        # Fallback to hardcoded mapping
        tpa_code = INSURANCE_NAME_TO_TPA.get(receiver_name)
        if tpa_code:
            logger.debug(
                f"Found TPA code from receiver_name (fallback): "
                f"{receiver_name} -> {tpa_code}"
            )
            return tpa_code
    
    # Check payer_name
    if payer_name:
        payer_name = str(payer_name).strip()
        normalized_name = _normalize_insurance_name(payer_name)
        
        # Try Redis mapping first
        tpa_code = redis_mapping.get(normalized_name)
        if tpa_code:
            logger.debug(
                f"Found TPA code from payer_name (Redis): "
                f"{payer_name} -> {tpa_code}"
            )
            return tpa_code
        
        # Fallback to hardcoded mapping
        tpa_code = INSURANCE_NAME_TO_TPA.get(payer_name)
        if tpa_code:
            logger.debug(
                f"Found TPA code from payer_name (fallback): "
                f"{payer_name} -> {tpa_code}"
            )
            return tpa_code
    
    logger.warning(
        f"Could not extract TPA code from appointment. "
        f"receiver_code: {receiver_code}, payer_code: {payer_code}, "
        f"receiver_name: {receiver_name}, payer_name: {payer_name}"
    )
    return None


def is_valid_tpa_code(tpa_code: Optional[str]) -> bool:
    """
    Check if a TPA code is valid.
    
    Args:
        tpa_code: TPA code to validate
    
    Returns:
        True if valid, False otherwise
    """
    if not tpa_code:
        return False
    
    tpa_code = str(tpa_code).strip()
    
    # Special case: 'BOTH' is a valid TPA code for searching all TPAs
    if tpa_code == "BOTH":
        return True
    
    return (
        TPA_CODE_PATTERN.match(tpa_code) is not None
        or INS_CODE_PATTERN.match(tpa_code) is not None
        or OTHER_CODE_PATTERN.match(tpa_code) is not None
    )

