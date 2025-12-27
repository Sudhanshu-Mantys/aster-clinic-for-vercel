#!/usr/bin/env python3
"""Main script entry point for auto eligibility checker.

This script runs once per cron execution, fetches appointments,
and creates Mantys eligibility checks for new appointments.
"""
import sys
import time
import logging
from typing import Dict, Any, List
from config import config
from appointment_fetcher import fetch_todays_appointments
from redis_tracker import RedisTracker
from eligibility_processor import process_appointment_for_eligibility
from history_creator import create_eligibility_history_item
from tpa_mapper import extract_tpa_code_from_appointment

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger(__name__)

# Interval between runs in seconds
INTERVAL = 30


class EligibilityCheckerService:
    """Main service for processing appointments and creating eligibility checks."""
    
    def __init__(self):
        """Initialize the service."""
        self.redis_tracker = RedisTracker()
        self.metrics = {
            "appointments_fetched": 0,
            "appointments_processed": 0,
            "eligibility_checks_created": 0,
            "errors": 0,
            "skipped_no_insurance": 0,
            "skipped_already_processed": 0,
            "skipped_no_tpa": 0,
            "skipped_no_id": 0,
        }
    
    def has_insurance_info(self, appointment: Dict[str, Any]) -> bool:
        """
        Check if appointment has insurance/payer information.
        
        Args:
            appointment: Appointment dictionary
        
        Returns:
            True if has insurance info, False otherwise
        """
        # Check for payer/receiver codes or names
        has_code = bool(
            appointment.get("receiver_code")
            or appointment.get("payer_code")
            or appointment.get("receiverCode")
            or appointment.get("payerCode")
        )
        
        has_name = bool(
            appointment.get("receiver_name")
            or appointment.get("payer_name")
            or appointment.get("receiverName")
            or appointment.get("payerName")
        )
        
        return has_code or has_name
    
    def process_appointment(self, appointment: Dict[str, Any]) -> bool:
        """
        Process a single appointment and create eligibility check if needed.
        
        Args:
            appointment: Appointment dictionary
        
        Returns:
            True if successfully processed, False otherwise
        """
        appointment_id = appointment.get("appointment_id") or appointment.get("appointmentId")
        
        if not appointment_id:
            logger.warning("Appointment missing appointment_id, skipping")
            self.metrics["errors"] += 1
            return False
        
        logger.info(f"Processing appointment {appointment_id}")
        
        # Check if already processed
        if not self.redis_tracker.should_process_appointment(appointment_id):
            logger.debug(f"Appointment {appointment_id} already processed, skipping")
            self.metrics["skipped_already_processed"] += 1
            return False
        
        # Check if has insurance info
        if not self.has_insurance_info(appointment):
            logger.debug(f"Appointment {appointment_id} has no insurance info, skipping")
            self.metrics["skipped_no_insurance"] += 1
            return False
        
        # Try to mark as processing (atomic operation)
        if not self.redis_tracker.mark_appointment_processing(appointment_id):
            logger.debug(f"Appointment {appointment_id} already being processed by another instance")
            self.metrics["skipped_already_processed"] += 1
            return False
        
        try:
            # Extract TPA code to pass to history creator
            tpa_code = extract_tpa_code_from_appointment(appointment)
            if not tpa_code:
                logger.warning(f"Appointment {appointment_id} has no valid TPA code")
                self.metrics["skipped_no_tpa"] += 1
                self.redis_tracker.mark_appointment_error(
                    appointment_id,
                    "No valid TPA code found",
                )
                return False
            
            # Process appointment and create Mantys task
            task_id = process_appointment_for_eligibility(appointment)
            
            if not task_id:
                logger.error(f"Failed to create Mantys task for appointment {appointment_id}")
                self.metrics["errors"] += 1
                self.redis_tracker.mark_appointment_error(
                    appointment_id,
                    "Failed to create Mantys task",
                )
                return False
            
            # Create history item so frontend can find and poll it
            history_id = create_eligibility_history_item(
                appointment=appointment,
                task_id=task_id,
                tpa_code=tpa_code,
            )
            
            if not history_id:
                logger.warning(
                    f"Failed to create history item for task {task_id}, "
                    f"but task was created successfully"
                )
                # Don't fail the whole operation if history creation fails
                # The task is still created and stored in Redis
            
            # Mark appointment as completed
            self.redis_tracker.mark_appointment_completed(
                appointment_id,
                task_id,
                status="completed",
            )
            
            logger.info(
                f"Successfully processed appointment {appointment_id}: "
                f"task_id={task_id}, history_id={history_id or 'N/A'}"
            )
            
            self.metrics["appointments_processed"] += 1
            self.metrics["eligibility_checks_created"] += 1
            return True
        
        except Exception as e:
            logger.error(
                f"Error processing appointment {appointment_id}: {e}",
                exc_info=True,
            )
            self.metrics["errors"] += 1
            self.redis_tracker.mark_appointment_error(
                appointment_id,
                f"Error: {str(e)}",
            )
            return False
    
    def run(self) -> int:
        """
        Main execution method.
        
        Returns:
            Exit code (0 for success, non-zero for errors)
        """
        logger.info("Starting auto eligibility checker service")
        
        try:
            # Validate configuration
            config.validate()
            
            # Fetch today's appointments
            logger.info("Fetching today's appointments...")
            appointments = fetch_todays_appointments()
            self.metrics["appointments_fetched"] = len(appointments)
            
            if not appointments:
                logger.info("No appointments found for today")
                self._log_metrics()
                return 0
            
            logger.info(f"Found {len(appointments)} appointments to process")
            
            # Process each appointment
            for appointment in appointments:
                try:
                    self.process_appointment(appointment)
                except Exception as e:
                    logger.error(f"Unexpected error processing appointment: {e}", exc_info=True)
                    self.metrics["errors"] += 1
            
            # Log final metrics
            self._log_metrics()
            
            logger.info("Auto eligibility checker service completed successfully")
            return 0
        
        except Exception as e:
            logger.error(f"Fatal error in service: {e}", exc_info=True)
            self._log_metrics()
            return 1
        
        finally:
            # Clean up
            try:
                self.redis_tracker.close()
            except Exception as e:
                logger.error(f"Error closing Redis connection: {e}")
    
    def _log_metrics(self) -> None:
        """Log processing metrics."""
        logger.info("=" * 60)
        logger.info("Processing Metrics:")
        logger.info(f"  Appointments fetched: {self.metrics['appointments_fetched']}")
        logger.info(f"  Appointments processed: {self.metrics['appointments_processed']}")
        logger.info(f"  Eligibility checks created: {self.metrics['eligibility_checks_created']}")
        logger.info(f"  Skipped (already processed): {self.metrics['skipped_already_processed']}")
        logger.info(f"  Skipped (no insurance): {self.metrics['skipped_no_insurance']}")
        logger.info(f"  Skipped (no TPA): {self.metrics['skipped_no_tpa']}")
        logger.info(f"  Skipped (no ID): {self.metrics['skipped_no_id']}")
        logger.info(f"  Errors: {self.metrics['errors']}")
        logger.info("=" * 60)


def run_once() -> int:
    """Run a single iteration of the eligibility checker."""
    service = EligibilityCheckerService()
    return service.run()


def main() -> None:
    """Main entry point with internal loop."""
    logger.info(f"Starting eligibility checker service (interval: {INTERVAL}s)")
    
    while True:
        try:
            exit_code = run_once()
            if exit_code != 0:
                logger.warning(f"Run completed with exit code {exit_code}")
        except KeyboardInterrupt:
            logger.info("Received interrupt signal, shutting down...")
            break
        except Exception as e:
            logger.error(f"Unexpected error in main loop: {e}", exc_info=True)
        
        logger.debug(f"Sleeping for {INTERVAL} seconds...")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()

