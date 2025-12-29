"""Configuration management for auto eligibility checker service."""
import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Application configuration."""
    
    # API Configuration
    # IMPORTANT: This should be the deployed Next.js app URL, not localhost!
    API_BASE_URL: str = os.getenv("API_BASE_URL", "")
    
    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    if not REDIS_URL:
        raise ValueError("REDIS_URL environment variable is required")
    
    # Mantys API Configuration
    MANTYS_API_URL: str = os.getenv("MANTYS_API_URL", "https://aster.api.mantys.org")
    MANTYS_API_KEY: str = os.getenv("MANTYS_API_KEY", "")
    MANTYS_CLIENT_ID: str = os.getenv("MANTYS_CLIENT_ID", "aster-clinic")
    MANTYS_CLINIC_ID: str = os.getenv(
        "MANTYS_CLINIC_ID", 
        "92d5da39-36af-4fa2-bde3-3828600d7871"
    )
    
    # Appointment Configuration
    CUSTOMER_SITE_ID: int = int(os.getenv("CUSTOMER_SITE_ID", "31"))
    CLINIC_ID: str = os.getenv(
        "CLINIC_ID",
        "92d5da39-36af-4fa2-bde3-3828600d7871"
    )
    
    # Logging Configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Redis Keys
    REDIS_APPOINTMENT_KEY_PREFIX: str = "auto-check:appointment:"
    REDIS_APPOINTMENT_TTL: int = 60 * 60 * 24 * 7  # 7 days
    
    @classmethod
    def validate(cls) -> None:
        """Validate that all required configuration is present."""
        required_vars = {
            "REDIS_URL": cls.REDIS_URL,
            "API_BASE_URL": cls.API_BASE_URL,
        }
        
        missing = [var for var, value in required_vars.items() if not value]
        if missing:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing)}"
            )
        
        # Warn if API_BASE_URL looks like localhost (won't work on VM/server)
        if cls.API_BASE_URL and ("localhost" in cls.API_BASE_URL or "127.0.0.1" in cls.API_BASE_URL):
            import warnings
            warnings.warn(
                "API_BASE_URL appears to be localhost. This won't work if the cron job "
                "runs on a VM/server. Use your deployed Next.js app URL instead.",
                UserWarning
            )


# Create a singleton instance
config = Config()

