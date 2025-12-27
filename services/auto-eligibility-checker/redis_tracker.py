"""Tracks processed appointments in Redis."""
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime
import redis
from config import config

logger = logging.getLogger(__name__)


class RedisTracker:
    """Tracks processed appointments in Redis."""
    
    def __init__(self):
        """Initialize Redis connection."""
        try:
            self.redis_client = redis.from_url(
                config.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Connected to Redis successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def _get_appointment_key(self, appointment_id: int) -> str:
        """Get Redis key for appointment tracking."""
        return f"{config.REDIS_APPOINTMENT_KEY_PREFIX}{appointment_id}"
    
    def is_appointment_processed(self, appointment_id: int) -> bool:
        """
        Check if an appointment has already been processed.
        
        Args:
            appointment_id: The appointment ID to check
        
        Returns:
            True if appointment has been processed, False otherwise
        """
        try:
            key = self._get_appointment_key(appointment_id)
            exists = self.redis_client.exists(key)
            return exists > 0
        except Exception as e:
            logger.error(f"Error checking if appointment {appointment_id} is processed: {e}")
            # On error, assume not processed to allow retry
            return False
    
    def get_appointment_status(self, appointment_id: int) -> Optional[Dict[str, Any]]:
        """
        Get the processing status of an appointment.
        
        Args:
            appointment_id: The appointment ID
        
        Returns:
            Dictionary with status info, or None if not found
        """
        try:
            key = self._get_appointment_key(appointment_id)
            data = self.redis_client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Error getting appointment {appointment_id} status: {e}")
            return None
    
    def mark_appointment_processing(
        self,
        appointment_id: int,
        task_id: Optional[str] = None,
    ) -> bool:
        """
        Mark an appointment as being processed (atomic operation).
        
        Uses SETNX to ensure only one process can mark it.
        
        Args:
            appointment_id: The appointment ID
            task_id: Optional task ID if already created
        
        Returns:
            True if successfully marked (was not already processed),
            False if already being processed
        """
        try:
            key = self._get_appointment_key(appointment_id)
            
            status_data = {
                "taskId": task_id or "",
                "status": "processing",
                "createdAt": datetime.utcnow().isoformat(),
            }
            
            # Use SETNX for atomic operation
            result = self.redis_client.setnx(
                key,
                json.dumps(status_data),
            )
            
            if result:
                # Set TTL
                self.redis_client.expire(key, config.REDIS_APPOINTMENT_TTL)
                logger.info(f"Marked appointment {appointment_id} as processing")
                return True
            else:
                logger.debug(f"Appointment {appointment_id} already being processed")
                return False
        
        except Exception as e:
            logger.error(f"Error marking appointment {appointment_id} as processing: {e}")
            return False
    
    def mark_appointment_completed(
        self,
        appointment_id: int,
        task_id: str,
        status: str = "completed",
    ) -> None:
        """
        Mark an appointment as completed.
        
        Args:
            appointment_id: The appointment ID
            task_id: The task ID
            status: Status (default: "completed")
        """
        try:
            key = self._get_appointment_key(appointment_id)
            
            status_data = {
                "taskId": task_id,
                "status": status,
                "createdAt": datetime.utcnow().isoformat(),
                "completedAt": datetime.utcnow().isoformat(),
            }
            
            self.redis_client.setex(
                key,
                config.REDIS_APPOINTMENT_TTL,
                json.dumps(status_data),
            )
            logger.info(
                f"Marked appointment {appointment_id} as {status} "
                f"with task {task_id}"
            )
        
        except Exception as e:
            logger.error(
                f"Error marking appointment {appointment_id} as completed: {e}"
            )
    
    def mark_appointment_error(
        self,
        appointment_id: int,
        error_message: str,
        task_id: Optional[str] = None,
    ) -> None:
        """
        Mark an appointment processing as error (allows retry later).
        
        Args:
            appointment_id: The appointment ID
            error_message: Error message
            task_id: Optional task ID if one was created
        """
        try:
            key = self._get_appointment_key(appointment_id)
            
            status_data = {
                "taskId": task_id or "",
                "status": "error",
                "error": error_message,
                "createdAt": datetime.utcnow().isoformat(),
                "errorAt": datetime.utcnow().isoformat(),
            }
            
            # Use shorter TTL for errors to allow retry sooner
            error_ttl = 60 * 60 * 24  # 1 day
            
            self.redis_client.setex(
                key,
                error_ttl,
                json.dumps(status_data),
            )
            logger.warning(
                f"Marked appointment {appointment_id} as error: {error_message}"
            )
        
        except Exception as e:
            logger.error(
                f"Error marking appointment {appointment_id} as error: {e}"
            )
    
    def should_process_appointment(self, appointment_id: int) -> bool:
        """
        Determine if an appointment should be processed.
        
        An appointment should be processed if:
        - It hasn't been processed before, OR
        - Previous processing resulted in an error (allows retry)
        
        Args:
            appointment_id: The appointment ID
        
        Returns:
            True if appointment should be processed
        """
        status = self.get_appointment_status(appointment_id)
        
        if status is None:
            # Not processed before
            return True
        
        # Allow retry if previous attempt resulted in error
        if status.get("status") == "error":
            logger.info(
                f"Appointment {appointment_id} had previous error, "
                f"allowing retry"
            )
            return True
        
        # Already processed successfully or in progress
        return False
    
    def close(self) -> None:
        """Close Redis connection."""
        try:
            if hasattr(self, "redis_client"):
                self.redis_client.close()
                logger.info("Closed Redis connection")
        except Exception as e:
            logger.error(f"Error closing Redis connection: {e}")

