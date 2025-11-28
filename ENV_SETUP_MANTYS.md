# Mantys API Environment Setup

## Quick Setup Guide

To enable Mantys TPA eligibility checks, you need to configure your environment variables.

### Step 1: Create Environment File

Create a file named `.env.local` in the root of your project:

```bash
touch .env.local
```

### Step 2: Add Mantys Configuration

Add the following configuration to your `.env.local` file:

```bash
# Mantys API Configuration
MANTYS_API_URL=https://aster.api.mantys.org
MANTYS_API_KEY=api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab

# Aster Clinic Configuration
CLINIC_ID_ASTER=92d5da39-36af-4fa2-bde3-3828600d7871
DEFAULT_CLINIC=ASTER
```

### Step 3: Replace Placeholder Values

1. **MANTYS_API_URL**: Replace with your actual Mantys API endpoint (if different)
2. **MANTYS_API_KEY**: Replace `your_mantys_api_key_here` with your actual API key from Mantys

### Step 4: Restart Development Server

After creating/updating `.env.local`, restart your development server:

```bash
npm run dev
# or
yarn dev
```

---

## Environment Variables Explained

| Variable | Description | Required |
|----------|-------------|----------|
| `MANTYS_API_URL` | Base URL for Mantys API | Yes |
| `MANTYS_API_KEY` | Your Mantys API authentication key | Yes |
| `CLINIC_ID_AHM` | Aster Hospital Mankhool clinic ID | No (default provided) |
| `CLINIC_ID_AHQ` | Aster Hospital Qusais clinic ID | No (default provided) |
| `DEFAULT_CLINIC` | Default clinic to use (AHM or AHQ) | No (defaults to AHM) |

---

## Getting Your Mantys API Key

1. Contact your Mantys account manager
2. Request API access for production/staging
3. You'll receive:
   - API endpoint URL
   - API key/token
   - Documentation access

---

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env.local` to git**
   - It's already in `.gitignore`
   - Contains sensitive API keys

2. **Use different keys for different environments**
   - Development: Use test/sandbox API keys
   - Production: Use production API keys

3. **Rotate keys regularly**
   - Change API keys periodically
   - Update `.env.local` when keys are rotated

4. **Keep keys confidential**
   - Don't share API keys in chat/email
   - Don't expose in client-side code
   - Only use in server-side API routes

---

## Troubleshooting

### Error: "MANTYS_API_KEY is not configured"

**Solution:** Ensure `.env.local` exists and contains `MANTYS_API_KEY`

### Error: "API request failed with status 401"

**Solution:** Check that your API key is correct and not expired

### Error: "Cannot connect to Mantys API"

**Solutions:**
1. Check your internet connection
2. Verify `MANTYS_API_URL` is correct
3. Confirm Mantys API service is online

### Changes not reflecting

**Solution:** Restart your development server after modifying `.env.local`

---

## Testing the Integration

Once configured, test the integration:

1. Navigate to Dashboard
2. Search for a patient
3. Click on an active insurance card
4. Click "Check Eligibility with Mantys"
5. Fill in the form and submit

You should see:
- Loading state during API call
- Results display with eligibility status
- Patient and policy information
- Copay details

---

## Production Deployment

For production deployment (e.g., Vercel):

### Vercel

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add each variable:
   - `MANTYS_API_URL`
   - `MANTYS_API_KEY`
   - etc.
4. Redeploy your application

### Other Platforms

Refer to your hosting platform's documentation for setting environment variables.

---

## Example Configuration

Here's a complete example `.env.local` file (with placeholder values):

```bash
# Mantys API Configuration
MANTYS_API_URL=https://api.mantys.io
MANTYS_API_KEY=mty_sk_1234567890abcdef

# Aster Clinics Configuration
CLINIC_ID_AHM=2a82dd66-5137-454f-bdc9-07d7c2c6dbbf
CLINIC_ID_AHQ=1a405a0a-f7a1-4ecc-86fb-ce84151ccc5b
DEFAULT_CLINIC=AHM

# Optional: Additional Aster API Configuration
# (Add other environment variables as needed)
```

---

## Need Help?

- Review the main integration guide: `MANTYS_API_INTEGRATION.md`
- Check the API endpoint code: `renderer/pages/api/mantys/eligibility-check.ts`
- Review utility functions: `renderer/lib/mantys-utils.ts`

---

**Last Updated:** November 28, 2025

