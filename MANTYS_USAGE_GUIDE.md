# Mantys Eligibility Check - Quick Usage Guide

## How to Use the New Feature

### Step 1: Search for a Patient

1. Go to the **Dashboard** page
2. Click on the **"Prefill Eligibility Form"** tab
3. Select search type:
   - **Phone Number** (recommended)
   - **Patient ID**
   - **MPI**
4. Enter the search value
5. Click **"Search"**

### Step 2: View Patient Details

Once found, you'll see:
- ✅ Patient information (name, ID, DOB, etc.)
- 📋 List of insurance policies
- Each insurance policy shows:
  - TPA Name
  - Insurance Plan
  - Status (Active/Expired)
  - Expiry Date
  - Policy details (when expanded)

### Step 3: Check Eligibility

1. **Expand** an insurance policy by clicking on it
2. Look for the **"✓ Check Eligibility with Mantys"** button
   - Only shows for **Active** insurance policies
   - Located at the bottom of the expanded insurance details
3. Click the button
4. A **sidebar will slide in from the right** with the eligibility form

### Step 4: Review Pre-filled Form

The Mantys eligibility form will appear in a right-side sidebar with:

✅ **Automatically Pre-filled:**
- Patient's full name
- Phone number
- Emirates ID / Member ID
- Insurance provider (TPA)
- Payer name

⚠️ **May Need Your Input:**
- Visit Type (usually pre-selected)
- Doctor's Name (if required by TPA)
- Additional fields based on selected TPA

### Step 5: Complete Required Fields

Depending on the insurance provider (TPA), you may need to fill:

**Common Fields:**
- ✓ Visit Type (required)
- Doctor's Name (for most TPAs)

**Conditional Fields** (appear based on TPA):
- Service Type (eCare, Lifeline)
- Referral Code (Aafiya)
- POD Details (Daman, Daman Thiqa)
- Maternity Type (NAS, Neuron)
- Visit Category (ADNIC)
- Phone Number (some TPAs)

### Step 6: Submit

1. Review all filled information
2. Click **"Check Eligibility"** button
3. Currently logs payload to console (will submit to Mantys API once integrated)

### Step 7: Close Sidebar

Multiple ways to close:
- Click **"Cancel"** button at the bottom
- Click the **"✕"** button in the top-right corner of the sidebar
- Press **"Escape"** key on your keyboard
- Click on the **dark overlay** outside the sidebar

---

## Visual Flow

```
┌─────────────────────────────────────────┐
│  1. Search for Patient                  │
│  Enter: Phone / Patient ID / MPI        │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  2. Patient Details Displayed           │
│  ✓ Name: John Doe                       │
│  ✓ MPI: 12345678                        │
│  ✓ Phone: +971-50-1234567               │
│                                          │
│  Insurance Details:                      │
│  ┌────────────────────────────────────┐ │
│  │ ▼ Daman - Active ✓                 │ │
│  │   Member ID: 123456                 │ │
│  │   Expires: 2025-12-31               │ │
│  │   [✓ Check Eligibility with Mantys]│ │
│  └────────────────────────────────────┘ │
└─────────────────┬───────────────────────┘
                  │ Click Button
                  ▼
┌──────────────────────────┐  ┌──────────────────────────────────┐
│  Patient Details         │  │ ← Sidebar slides in from right   │
│                          │  │                                   │
│  Insurance still visible │◄─┤  Mantys Eligibility Check    [✕] │
│                          │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                          │  │  📋 Patient Information          │
│                          │  │  Name: John Doe                  │
│                          │  │  Phone: +971-50-1234567          │
│                          │  │  ID: 784-1234-1234567-1          │
│                          │  │  Insurance: Daman (INS026)       │
│                          │  │                                   │
│                          │  │  Insurance Provider: [Daman ▼]   │
│                          │  │  ID Type: [Emirates ID ▼]        │
│                          │  │  Visit Type: [Outpatient ▼]      │
│                          │  │  Doctor: [Select Doctor ▼]       │
│                          │  │  Emirates ID: 784-1234-...       │
│                          │  │                                   │
│                          │  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                          │  │  [✓ Check Eligibility] [Cancel]  │
└──────────────────────────┘  └──────────────────────────────────┘
```

---

## Field Guide by TPA

### Daman (INS026) / Daman Thiqa (TPA023)

**Pre-filled:**
- Name, Phone, Emirates ID, Insurance Provider

**Required:**
- ✓ Visit Type
- ✓ Doctor's Name
- Phone Number

**Optional (if at Medcare/HealthHub):**
- POD (Yes/No)
- POD ID (if POD is Yes)
- Maternity flag
- Chief complaint checkbox

---

### NextCare (TPA002)

**Pre-filled:**
- Name, Phone, Member ID, Insurance Provider

**Required:**
- ✓ Visit Type (Outpatient/Chronic Out/Emergency)
- ✓ ID Type

**If using Policy Number:**
- ✓ Payer Name (select from dropdown)
- ✓ Patient Name

---

### AXA (INS010)

**Pre-filled:**
- Name, Phone, Emirates ID, Insurance Provider

**Required:**
- ✓ Visit Type (Outpatient/Dental/Emergency)

**If Dental selected:**
- Switches to Member ID automatically
- Requires phone number

---

### NAS (TPA004) / Neuron (TPA001)

**Pre-filled:**
- Name, Phone, Emirates ID, Insurance Provider

**Required:**
- ✓ Visit Type

**If Maternity selected:**
- ✓ Maternity Type:
  - Normal Delivery
  - C-Section
  - Prenatal
  - Postnatal

---

### eCare (TPA029)

**Pre-filled:**
- Name, Phone, Emirates ID, Insurance Provider

**Required:**
- ✓ Visit Type
- ✓ Doctor's Name
- ✓ Phone Number
- ✓ Service Type (Consultation GP / Consultation Specialist)

---

### ADNIC (INS017) at Org1

**Pre-filled:**
- Name, Emirates ID, Insurance Provider

**Required:**
- ✓ Visit Type
- ✓ Doctor's Name
- ✓ Visit Category (First Visit / Visit Without Referral)
- ✓ Mobile Number (split into code + 7 digits)

---

### Aafiya (TPA026)

**Pre-filled:**
- Name, Phone, Emirates ID, Insurance Provider

**Required:**
- ✓ Visit Type

**Optional:**
- Referral Code

---

## Tips & Tricks

### 💡 Quick Tips

1. **Multiple Patients Found?**
   - If multiple patients match your search, you'll see a list
   - Click on the correct patient to view their details

2. **No Insurance Showing?**
   - Check if patient has active insurance in the system
   - Only active insurance policies show the eligibility button

3. **Form Fields Disappearing?**
   - This is normal! Fields appear/disappear based on:
     - Selected insurance provider (TPA)
     - ID type selected
     - Visit type selected
     - Organization context

4. **Emirates ID Format?**
   - Auto-formats as you type: XXX-XXXX-XXXXXXX-X
   - Just type the numbers, dashes are added automatically
   - Warning will show if format is incorrect

5. **Can't Find TPA?**
   - Use the search box in the dropdown
   - Type part of the TPA name
   - Supports 50+ insurance providers

6. **Need to Change Data?**
   - You can manually edit pre-filled data if needed
   - System will validate on submission

### ⚠️ Common Issues

**Issue: Button not showing**
- ✓ Check insurance status is "Active"
- ✓ Expand the insurance details first
- ✓ Button only appears for active policies

**Issue: Required field error**
- ✓ Each TPA has different required fields
- ✓ Red asterisk (*) indicates required
- ✓ Submit button will show which fields are missing

**Issue: ID validation error**
- ✓ Emirates ID must be 15 digits (XXX-XXXX-XXXXXXX-X)
- ✓ DHA Member ID format: XXXX-XXX-XXXXXXXXX-XX
- ✓ Member ID is free-form (any format accepted)

---

## Example Scenarios

### Scenario 1: Regular Outpatient Visit (Daman)

1. Search patient by phone: `+971501234567`
2. Patient found: "Ahmed Hassan"
3. Expand Daman insurance (Active)
4. Click "Check Eligibility with Mantys"
5. Form opens pre-filled:
   - Name: Ahmed Hassan
   - Phone: +971501234567
   - Emirates ID: 784-1234-1234567-1
   - Insurance: Daman (INS026)
6. Select:
   - Visit Type: Outpatient
   - Doctor: Dr. Sarah Johnson
7. Click "Check Eligibility"
8. ✅ Done!

---

### Scenario 2: Maternity Visit (NAS)

1. Search patient by MPI: `12345678`
2. Patient found: "Fatima Al Zaabi"
3. Expand NAS insurance (Active)
4. Click "Check Eligibility with Mantys"
5. Form opens pre-filled
6. Select:
   - Visit Type: Maternity
   - Maternity Type: Prenatal (dropdown appears)
   - Doctor: Dr. Emily Chen
7. Click "Check Eligibility"
8. ✅ Done!

---

### Scenario 3: Dental Visit (AXA)

1. Search patient
2. Expand AXA insurance (Active)
3. Click "Check Eligibility with Mantys"
4. Form opens pre-filled
5. Select:
   - Visit Type: Dental
   - Notice: ID Type automatically switches to Member ID
   - Enter phone number (required for dental)
6. Click "Check Eligibility"
7. ✅ Done!

---

## Keyboard Shortcuts

- `Tab` - Navigate between fields
- `Enter` - Select from dropdown (when dropdown is open)
- Type to search in dropdowns (TPA, Doctor, etc.)
- `Esc` - Close sidebar instantly

---

## Need Help?

1. Check the console (F12) for detailed payload information
2. Review the MANTYS_INTEGRATION.md file for technical details
3. Verify patient and insurance data is loaded correctly
4. Check that the TPA is correctly mapped

---

**Ready to Use!** 🚀

Just search for a patient, expand their active insurance, and click the green button!

