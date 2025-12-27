# Auto Eligibility Checker Service

A Python script that runs via cron job to automatically fetch appointments and create Mantys eligibility checks for new appointments. The script processes appointments once per execution and exits, letting the frontend app handle status polling automatically.

## Overview

This service:
1. Fetches today's appointments from the API
2. Filters for new appointments that haven't been processed
3. Extracts TPA codes, visit types, and patient IDs from appointment data
4. Creates Mantys eligibility check tasks via API
5. Creates eligibility history items so the frontend can find and poll them
6. Tracks processed appointments in Redis to avoid duplicates

**Status polling is handled automatically by the frontend app** - no separate polling service needed!

## Architecture

```
Cron Job (every minute)
  ↓
Fetch Appointments
  ↓
Filter New Appointments
  ↓
Extract TPA Code, Visit Type, ID
  ↓
Create Mantys Task
  ↓
Create History Item
  ↓
Mark as Processed in Redis
  ↓
Exit

Frontend App (when open)
  ↓
EligibilityPollingManager Component
  ↓
Fetches Active Checks from Redis
  ↓
Polls Each Task Status Every 3s
  ↓
Updates Redis History
```

## Prerequisites

- Python 3.8 or higher
- Redis server (accessible via REDIS_URL)
- Access to the Next.js API (API_BASE_URL)
- Mantys API credentials

## Installation

1. **Navigate to the service directory:**
   ```bash
   cd services/auto-eligibility-checker
   ```

2. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

5. **Edit `.env` file with your configuration:**
   ```bash
   # API Configuration
   # IMPORTANT: Use your deployed Next.js app URL, not localhost!
   # This is the URL where your Next.js API routes are accessible
   # Example: https://your-app.vercel.app or https://your-domain.com
   API_BASE_URL=https://your-deployed-nextjs-app.com
   
   # Redis Configuration
   REDIS_URL=redis://localhost:6379
   
   # Mantys API Configuration
   MANTYS_API_URL=https://aster.api.mantys.org
   MANTYS_API_KEY=your_mantys_api_key_here
   MANTYS_CLIENT_ID=aster-clinic
   MANTYS_CLINIC_ID=92d5da39-36af-4fa2-bde3-3828600d7871
   
   # Appointment Configuration
   CUSTOMER_SITE_ID=31
   CLINIC_ID=92d5da39-36af-4fa2-bde3-3828600d7871
   
   # Logging
   LOG_LEVEL=INFO
   ```

6. **Make the script executable:**
   ```bash
   chmod +x main.py
   ```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `API_BASE_URL` | Base URL for deployed Next.js API (not localhost!) | - | **Yes** |
| `REDIS_URL` | Redis connection string | - | **Yes** |
| `MANTYS_API_URL` | Mantys API base URL | `https://aster.api.mantys.org` | No |
| `MANTYS_API_KEY` | Mantys API key | - | Yes (if using Mantys API directly) |
| `MANTYS_CLIENT_ID` | Mantys client ID | `aster-clinic` | No |
| `MANTYS_CLINIC_ID` | Mantys clinic ID | `92d5da39-36af-4fa2-bde3-3828600d7871` | No |
| `CUSTOMER_SITE_ID` | Customer site ID for appointments | `31` | No |
| `CLINIC_ID` | Clinic ID for eligibility history | `92d5da39-36af-4fa2-bde3-3828600d7871` | No |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARNING, ERROR) | `INFO` | No |

## Deployment

### Setting Up Cron Job

1. **Test the script manually first:**
   ```bash
   cd /path/to/services/auto-eligibility-checker
   source venv/bin/activate
   python main.py
   ```

2. **Edit crontab:**
   ```bash
   crontab -e
   ```

3. **Add cron job (runs every minute):**
   ```bash
   * * * * * cd /path/to/services/auto-eligibility-checker && /path/to/venv/bin/python main.py >> /var/log/eligibility-checker.log 2>&1
   ```

   **Important:** Replace `/path/to/` with your actual paths!

4. **Ensure log directory exists and is writable:**
   ```bash
   sudo mkdir -p /var/log
   sudo chmod 755 /var/log
   ```

5. **Verify cron job is running:**
   ```bash
   crontab -l
   tail -f /var/log/eligibility-checker.log
   ```

### Alternative: Using systemd (Optional)

You can also run this as a systemd service with a timer instead of cron. See systemd documentation for details.

## How It Works

### 1. Appointment Fetching
- Fetches today's appointments from `{API_BASE_URL}/api/appointments/today`
- **Important:** `API_BASE_URL` must be your deployed Next.js application URL
- The API automatically stores patient context in Redis

### 2. Filtering
- Checks Redis to see if appointment has been processed
- Skips appointments without insurance/payer information
- Allows retry for appointments that previously errored

### 3. TPA Code Extraction
Priority order:
1. `receiver_code` (if matches TPA/INS pattern)
2. `payer_code` (if matches TPA/INS pattern)
3. Insurance name mapping (if configured)

### 4. Visit Type Determination
Priority order:
1. `specialisation_name` keywords (DENTAL, OPTICAL, MATERNITY, etc.)
2. `isEmergencyAppointment` flag → EMERGENCY
3. Default: OUTPATIENT

### 5. ID Type & Value
Priority order:
1. Member ID (CARDNUMBER) from insurance data
2. Emirates ID (EMIRATESID) from appointment data
3. DHA Member ID (DHAMEMBERID) if available

### 6. Task Creation
- Creates Mantys task via `/api/mantys/eligibility-check`
- Creates history item via `/api/eligibility-history`
- Marks appointment as processed in Redis

### 7. Status Polling
- **Handled by frontend app automatically!**
- The `EligibilityPollingManager` component finds active checks
- Polls each task status every 3 seconds
- Updates Redis history when status changes

## Redis Keys

### Processed Appointments
- **Key Pattern:** `auto-check:appointment:{appointmentId}`
- **TTL:** 7 days
- **Purpose:** Prevent duplicate processing

### Eligibility History (Created by API)
- `eligibility:history:item:{historyId}` - Full history item
- `eligibility:history:clinic:{clinicId}` - Set of history IDs
- `eligibility:history:task:{taskId}` - History ID by task ID
- `eligibility:history:patient:{patientId}` - Set of history IDs

## Monitoring

The script logs comprehensive metrics at the end of each run:

```
Processing Metrics:
  Appointments fetched: 50
  Appointments processed: 10
  Eligibility checks created: 10
  Skipped (already processed): 30
  Skipped (no insurance): 5
  Skipped (no TPA): 3
  Skipped (no ID): 2
  Errors: 0
```

Check logs regularly:
```bash
tail -f /var/log/eligibility-checker.log
```

## Troubleshooting

### Script fails to start

**Error:** `REDIS_URL environment variable is required`
- **Solution:** Ensure `.env` file exists and contains `REDIS_URL`

**Error:** `Failed to connect to Redis`
- **Solution:** Check Redis is running and `REDIS_URL` is correct
- Test connection: `redis-cli -u $REDIS_URL ping`

### API connection issues

**Error:** `Failed to fetch appointments` or connection timeout
- **Solution:** 
  - Verify `API_BASE_URL` is set to your **deployed** Next.js app URL (not localhost!)
  - If running on a VM, ensure it can reach the deployed URL
  - Test the URL manually: `curl https://your-deployed-app.com/api/appointments/today?fromDate=12/26/2024&toDate=12/26/2024`
  - Check if the Next.js app requires authentication (may need to add API keys/headers)

### No appointments processed

**Check:**
1. Are there appointments for today?
2. Do appointments have insurance/payer information?
3. Are appointments already processed? (check Redis keys)
4. Check logs for specific error messages

### API errors

**Error:** `Failed to create Mantys eligibility check`
- **Solution:** 
  - Check `API_BASE_URL` is correct
  - Verify API is accessible
  - Check API logs for detailed error

**Error:** `Failed to create eligibility history item`
- **Solution:**
  - Task was created successfully, but history creation failed
  - Check API logs
  - Task will still be polled by frontend (stored in `eligibility:task:{taskId}`)

### Duplicate checks created

**Cause:** Multiple script instances running simultaneously
- **Solution:** 
  - Ensure only one cron job is configured
  - The script uses Redis SETNX for atomic operations, but multiple instances can still cause issues
  - Check for duplicate cron entries: `crontab -l`

### Status not updating

**Note:** Status polling is handled by the frontend app, not this script!
- **Solution:**
  - Ensure frontend app is running
  - Check `EligibilityPollingManager` component is active
  - Verify history items are being created (check Redis)

## Development

### Running Locally

```bash
cd services/auto-eligibility-checker
source venv/bin/activate
python main.py
```

### Testing

Test individual components:
```python
from appointment_fetcher import fetch_todays_appointments
from redis_tracker import RedisTracker
from tpa_mapper import extract_tpa_code_from_appointment

# Test appointment fetching
appointments = fetch_todays_appointments()
print(f"Fetched {len(appointments)} appointments")

# Test TPA extraction
for apt in appointments[:5]:
    tpa = extract_tpa_code_from_appointment(apt)
    print(f"Appointment {apt.get('appointment_id')}: TPA={tpa}")
```

### Code Structure

```
services/auto-eligibility-checker/
├── main.py                 # Main entry point
├── config.py               # Configuration management
├── appointment_fetcher.py  # Fetches appointments from API
├── redis_tracker.py        # Tracks processed appointments
├── tpa_mapper.py           # Maps insurance to TPA codes
├── visit_type_mapper.py    # Determines visit type
├── eligibility_processor.py # Creates Mantys tasks
├── history_creator.py      # Creates history items
├── requirements.txt        # Python dependencies
├── .env.example           # Example environment variables
├── .gitignore             # Git ignore file
├── crontab.example        # Example cron configuration
└── README.md              # This file
```

## Security Notes

- Never commit `.env` file to version control
- Use secure Redis connection (rediss://) in production
- Restrict API access appropriately
- Use environment variables for sensitive data
- Review cron job permissions

## Support

For issues or questions:
1. Check logs: `/var/log/eligibility-checker.log`
2. Review this README
3. Check API logs for detailed errors
4. Verify Redis connectivity and data

## License

Part of the Aster Clinics project.

