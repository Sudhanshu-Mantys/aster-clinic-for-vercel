# Mantys API Configuration for Aster Clinic

## ✅ Your API Credentials

Your Mantys API has been configured with the following credentials:

### API Details
- **Base URL**: `https://aster.api.mantys.org`
- **API Key**: `api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab`
- **Clinic ID**: `92d5da39-36af-4fa2-bde3-3828600d7871`

---

## 🚀 Quick Setup (One Command!)

Create your `.env.local` file by copying the template:

```bash
cp .env.local.template .env.local
```

**That's it!** The template already has all your correct credentials.

---

## 📝 Manual Setup (Alternative)

If the copy command doesn't work, create a file named `.env.local` in your project root with this exact content:

```bash
# Mantys API Configuration for Aster Clinic
MANTYS_API_URL=https://aster.api.mantys.org
MANTYS_API_KEY=api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab
CLINIC_ID_ASTER=92d5da39-36af-4fa2-bde3-3828600d7871
DEFAULT_CLINIC=ASTER
```

---

## ✅ Verification

After creating `.env.local`, verify it's correct:

```bash
# Check if file exists
ls -la .env.local

# View contents (be careful - contains API key!)
cat .env.local
```

---

## 🧪 Test the Integration

1. **Restart your development server** (IMPORTANT!):
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

2. **Test in the app**:
   - Go to Dashboard
   - Search for a patient
   - Click "✓ Check Eligibility with Mantys" on an insurance card
   - Fill the form with test data
   - Submit and see results!

---

## 📋 What's Been Configured

### ✅ Application Configuration
- Clinic ID updated in `MantysEligibilityForm.tsx`
- Clinic ID constant updated in `types/mantys.ts`
- All documentation updated with your credentials

### ✅ API Endpoint
- Already configured to use environment variables
- Located at: `renderer/pages/api/mantys/eligibility-check.ts`
- No code changes needed!

### ✅ All Payloads
Every API request will automatically include:
```json
{
  "clinic_id": "92d5da39-36af-4fa2-bde3-3828600d7871",
  // ... other fields
}
```

---

## 🔒 Security Notes

### ⚠️ IMPORTANT: Never Commit API Keys

Your `.env.local` file is already in `.gitignore`, but remember:

- ✅ `.env.local` - Safe (git ignored, contains secrets)
- ✅ `.env.local.template` - Safe (committed, has your credentials for reference)
- ❌ Never paste API keys in public channels
- ❌ Never commit `.env.local` to git

### Production Deployment

For production (e.g., Vercel):
1. Go to Project Settings → Environment Variables
2. Add each variable:
   - `MANTYS_API_URL` = `https://aster.api.mantys.org`
   - `MANTYS_API_KEY` = `api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab`
   - `CLINIC_ID_ASTER` = `92d5da39-36af-4fa2-bde3-3828600d7871`
   - `DEFAULT_CLINIC` = `ASTER`

---

## 📊 Example API Request

When you submit the form, it will send requests like this:

```json
{
  "id_value": "784-1234-1234567-1",
  "phone": "971-50-1234567",
  "tpa_name": "TPA004",
  "id_type": "EMIRATESID",
  "visit_type": "OUTPATIENT",
  "clinic_id": "92d5da39-36af-4fa2-bde3-3828600d7871"
}
```

To Mantys endpoint:
```
POST https://aster.api.mantys.org/eligibility/check
Authorization: Bearer api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab
```

---

## 🐛 Troubleshooting

### "MANTYS_API_KEY is not configured"
**Solution**: Restart your dev server after creating `.env.local`

### "Cannot find .env.local"
**Solution**: Make sure you're in the project root directory when creating the file

### "API request failed with status 401"
**Solution**: Double-check the API key is exactly as shown above (no extra spaces)

### "API request failed with status 404"
**Solution**: Verify the base URL is `https://aster.api.mantys.org` (no trailing slash)

### Still not working?
1. Check `.env.local` exists in project root
2. Verify file contents match exactly
3. Restart dev server
4. Check browser console for error details
5. Check terminal for server-side errors

---

## 🎯 Ready to Test!

Your configuration is complete! Follow these steps:

1. ✅ Copy `.env.local.template` to `.env.local` (or create manually)
2. ✅ Restart your development server
3. ✅ Test with a real patient
4. ✅ View the eligibility results!

---

## 📞 Support

**Mantys API Issues:**
- Contact: Mantys support team
- Your Account: Aster Clinic

**Integration Issues:**
- Check documentation files in the project
- Review console logs for error details
- Verify credentials in `.env.local`

---

**Configuration Date**: November 28, 2025  
**Status**: ✅ Ready to Use  
**API Provider**: Mantys  
**Clinic**: Aster Clinic

