# 🚀 Mantys Integration - Setup Instructions

## Quick Start (2 Minutes!)

### Step 1: Create Configuration File

Choose one method:

**Method A - Copy Template (Recommended)**
```bash
cp .env.local.template .env.local
```

**Method B - Create Manually**
```bash
cat > .env.local << 'EOF'
MANTYS_API_URL=https://aster.api.mantys.org
MANTYS_API_KEY=api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab
CLINIC_ID_ASTER=92d5da39-36af-4fa2-bde3-3828600d7871
DEFAULT_CLINIC=ASTER
EOF
```

### Step 2: Restart Development Server

```bash
# Stop current server (Ctrl+C or Cmd+C)
npm run dev
```

### Step 3: Test It!

1. Open http://localhost:3000 (or your dev URL)
2. Go to Dashboard
3. Search for a patient
4. Click **"✓ Check Eligibility with Mantys"** on an insurance card
5. Fill the form and click **"✓ Check Eligibility"**
6. 🎉 View the results!

---

## ✅ Configuration Summary

Your Mantys API is configured with:

| Setting | Value |
|---------|-------|
| **API URL** | `https://aster.api.mantys.org` |
| **API Key** | `api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab` |
| **Clinic ID** | `92d5da39-36af-4fa2-bde3-3828600d7871` |
| **Clinic Name** | Aster Clinic |

---

## 🧪 Test Cases

Try these test scenarios:

### Test 1: NAS Outpatient
```
Insurance Provider: TPA004 - NAS
ID Type: Emirates ID
Visit Type: OUTPATIENT
Emirates ID: (enter patient's actual ID)
Phone: 971-50-XXXXXXX
```

### Test 2: NextCare
```
Insurance Provider: TPA002 - NextCare
ID Type: Emirates ID
Visit Type: CHRONIC_OUT
Emirates ID: (enter patient's actual ID)
```

### Test 3: Maternity
```
Insurance Provider: TPA004 - NAS
ID Type: Emirates ID
Visit Type: MATERNITY
Maternity Type: Normal Delivery
Emirates ID: (enter patient's actual ID)
Phone: 971-50-XXXXXXX
```

---

## 📁 What's Been Configured

### ✅ Files Updated
- `renderer/types/mantys.ts` - Clinic ID constant
- `renderer/components/MantysEligibilityForm.tsx` - Default clinic ID
- `.env.local.template` - Your credentials template
- All documentation files

### ✅ Files Created
- `renderer/types/mantys.ts` - Type definitions
- `renderer/lib/mantys-utils.ts` - Utility functions
- `renderer/components/MantysResultsDisplay.tsx` - Results UI
- `renderer/pages/api/mantys/eligibility-check.ts` - API endpoint

### 📚 Documentation
- `MANTYS_CONFIGURATION.md` - Your configuration details
- `MANTYS_API_INTEGRATION.md` - Complete technical guide
- `MANTYS_PAYLOAD_REFERENCE.md` - API payload examples
- `MANTYS_USER_GUIDE.md` - End-user instructions
- `SETUP_INSTRUCTIONS.md` - This file

---

## ✨ Features Available

Once configured, you can:

- ✅ Check eligibility for 30+ TPAs
- ✅ View real-time eligibility status
- ✅ See copay and deductible details
- ✅ View network/card type information
- ✅ Read special remarks and requirements
- ✅ Download referral documents
- ✅ Export results (raw JSON)

---

## 🔍 Verification

Verify your setup is working:

1. **Check environment file exists:**
   ```bash
   ls -la .env.local
   ```
   Should show the file in your project root.

2. **Check server logs:**
   After starting dev server, you should see:
   ```
   ✓ Ready on http://localhost:3000
   ```
   No errors about missing MANTYS_API_KEY.

3. **Test the integration:**
   Submit a test eligibility check and watch for:
   - Loading spinner during API call
   - Results display after ~5-10 seconds
   - No error messages

---

## 🐛 Common Issues

### Issue: "MANTYS_API_KEY is not configured"
**Fix**: 
1. Verify `.env.local` exists
2. Restart dev server
3. Check file has correct content

### Issue: "401 Unauthorized"
**Fix**: API key might be incorrect. Verify it's exactly:
```
api_aster_clinic_c3a9d27f5b1248c8a1f0b72d6f8e42ab
```

### Issue: "404 Not Found"
**Fix**: URL might be wrong. Verify it's exactly:
```
https://aster.api.mantys.org
```

### Issue: Form doesn't show results
**Fix**: 
1. Check browser console (F12) for errors
2. Check Network tab for API response
3. Verify patient has active insurance

---

## 🎯 Next Steps

1. ✅ Create `.env.local` file
2. ✅ Restart development server
3. ✅ Test with a real patient
4. ✅ Review the results display
5. ✅ Train staff on how to use it

---

## 📞 Need Help?

**Technical Issues:**
- Check browser console (F12 → Console)
- Check server logs in terminal
- Review `MANTYS_CONFIGURATION.md` for details

**API Issues:**
- Contact Mantys support
- Reference your API key for support tickets

**Integration Questions:**
- Review `MANTYS_API_INTEGRATION.md`
- Check `MANTYS_USER_GUIDE.md` for usage instructions

---

## 🎉 You're All Set!

The Mantys integration is fully configured and ready to use. Just create the `.env.local` file and restart your server!

**Happy eligibility checking! 🏥**

---

**Setup Date:** November 28, 2025  
**Status:** ✅ Configured and Ready  
**Version:** 1.0.0

