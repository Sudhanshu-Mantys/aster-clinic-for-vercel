"""Fetches appointments from the API."""
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import requests
from config import config

logger = logging.getLogger(__name__)


def format_date(date: datetime) -> str:
    """Format date to MM/DD/YYYY format."""
    return date.strftime("%m/%d/%Y")


def fetch_appointments(
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    customer_site_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch appointments from the API.
    
    Args:
        from_date: Start date for appointment search (defaults to today)
        to_date: End date for appointment search (defaults to today)
        customer_site_id: Customer site ID (defaults to config value)
    
    Returns:
        List of appointment dictionaries
    
    Raises:
        requests.RequestException: If API request fails
    """
    # Use today's date if not provided
    if from_date is None:
        from_date = datetime.now()
    if to_date is None:
        to_date = datetime.now()
    
    if customer_site_id is None:
        customer_site_id = config.CUSTOMER_SITE_ID
    
    from_date_str = format_date(from_date)
    to_date_str = format_date(to_date)
    
    url = f"{config.API_BASE_URL}/api/appointments/today"
    params = {
        "fromDate": from_date_str,
        "toDate": to_date_str,
        "customerSiteId": customer_site_id,
    }
    
    logger.info(
        f"Fetching appointments from {from_date_str} to {to_date_str} "
        f"for customer site {customer_site_id}"
    )
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Check if response has expected structure
        if not isinstance(data, dict):
            logger.error(f"Unexpected response format: {type(data)}")
            return []
        
        # Extract appointments from response
        body = data.get("body", {})
        appointments = body.get("Data", [])
        
        if not isinstance(appointments, list):
            logger.error(f"Appointments data is not a list: {type(appointments)}")
            return []
        
        record_count = body.get("RecordCount", 0)
        logger.info(f"Fetched {len(appointments)} appointments (RecordCount: {record_count})")
        
        return appointments
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch appointments: {e}")
        raise
    except (KeyError, ValueError) as e:
        logger.error(f"Error parsing appointment response: {e}")
        return []


def fetch_todays_appointments(
    customer_site_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Convenience function to fetch today's appointments.
    
    Args:
        customer_site_id: Customer site ID (defaults to config value)
    
    Returns:
        List of appointment dictionaries
    """
    return fetch_appointments(
        from_date=datetime.now(),
        to_date=datetime.now(),
        customer_site_id=customer_site_id,
    )

