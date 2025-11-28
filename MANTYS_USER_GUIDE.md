# Mantys Eligibility Check - User Guide

A step-by-step guide for using the Mantys TPA eligibility check feature in Aster Clinics.

---

## 📱 How to Check Eligibility

### Step 1: Search for a Patient

1. Navigate to the **Dashboard**
2. Use the search form to find a patient:
   - Search by **MPI** (Master Patient Index)
   - Search by **Phone Number**
   - Search by **Appointment**

### Step 2: View Patient Details

Once you find the patient, you'll see:
- Patient demographic information
- Active and expired insurance cards

### Step 3: Initiate Eligibility Check

On any **active insurance card**, you'll see a green button:

```
✓ Check Eligibility with Mantys
```

Click this button to open the eligibility check form.

### Step 4: Fill the Eligibility Form

The form will open in a sidebar with pre-filled information:

**Pre-filled Fields:**
- Patient Name
- Phone Number
- Emirates ID (if available)
- Insurance Provider (auto-mapped from card)

**Fields You May Need to Fill:**
1. **Insurance Provider** - Usually pre-selected
2. **ID Type** - Select from:
   - Emirates ID
   - Member ID (Card Number)
   - DHA Member ID
   - Policy Number (for some TPAs)
3. **Visit Type** - Select based on visit:
   - Outpatient
   - Inpatient
   - Emergency
   - Maternity
   - Dental
   - Optical
   - Psychiatry
   - Wellness
4. **ID Number** - Enter the patient's ID
5. **Additional Fields** (if required):
   - Doctor Name
   - Phone Number
   - Service Type
   - Payer Name (for NextCare with Policy Number)

### Step 5: Submit the Check

Click the green **"✓ Check Eligibility"** button.

You'll see a loading spinner while the system contacts Mantys API.

### Step 6: View Results

#### ✅ If Patient is Eligible

You'll see a **green success banner** with:

**Patient Information:**
- Policy Holder Name
- Date of Birth
- Gender
- Member ID
- Emirates ID
- DHA Member ID

**Policy Details:**
- Payer Name (Insurance Company)
- Policy Authority (DOH, DHA, etc.)
- Policy Start Date
- Policy End Date
- Network (Card Type) - e.g., "WN" (Workers Network)
- Policy Number

**Copay & Deductible Details:**

Expandable sections for each category:
- **Outpatient**
- **Inpatient**
- **Maternity**
- **Specialization**

Each section shows a detailed table:

| Service Type | Copay (%) | Deductible (AED) | Set Copay |
|--------------|-----------|------------------|-----------|
| LAB | 20% | 50 | ✓ |
| MEDICINES | 30% | 0 | ✓ |
| PROCEDURE | 0% | 0 | ✓ |
| RADIOLOGY | 20% | 50 | ✓ |
| CONSULTATION | 0% | 20 | - |
| DENTAL | 0% | 0 | ✓ |

**Special Remarks:**

Important requirements and notes:
- Pre-approval requirements
- Waiting periods
- Referral requirements
- Coverage limitations

Example:
> ⚠️ Pre-approval required for aggregate net amount 700.0 AED or above
> 
> ⚠️ Pre-approval required for: Acute Drugs, C.T Scan, Child Vaccinations
> 
> ⚠️ No referral required for specialist consultation

**Referral Documents:**

Downloadable documents including:
- Member Eligibility - Main Page
- Member Eligibility - Details Modal
- Consultation/Claim Form

Click any document to download or view.

#### ❌ If Patient is Not Eligible

You'll see a **red error banner** explaining:
- Patient is not eligible
- Possible reasons (if provided)
- Next steps

---

## 🎯 Common Scenarios

### Scenario 1: Routine Outpatient Visit

1. Patient: Ahmed Hassan
2. Insurance: NAS (TPA004)
3. Visit Type: Outpatient
4. ID Type: Emirates ID
5. Result: Eligible with 20% copay on LAB/RADIOLOGY

**Action:** Proceed with consultation, apply copay as shown

---

### Scenario 2: Maternity Visit

1. Patient: Sarah Johnson
2. Insurance: NAS (TPA004)
3. Visit Type: Maternity
4. Maternity Type: Inpatient (C-Section)
5. Result: Eligible with 0% copay

**Action:** Proceed with maternity care, no copay

---

### Scenario 3: Emergency Visit

1. Patient: Mohammed Ali
2. Insurance: Mednet (TPA036)
3. Visit Type: Emergency
4. Result: Eligible

**Action:** Proceed with emergency care

---

### Scenario 4: NextCare with Policy Number

1. Patient: Emily Chen
2. Insurance: NextCare (TPA002)
3. ID Type: Policy Number
4. Visit Type: Chronic Out
5. Payer: Adamjee Ins Co Ltd
6. Result: Eligible

**Action:** Proceed with chronic care consultation

---

## 🔍 Understanding the Results

### Eligibility Status

- **✅ Eligible** (Green) - Patient can receive services
- **❌ Not Eligible** (Red) - Patient cannot receive services

### Network Types

Common network codes:
- **WN** - Workers Network
- **GN** - General Network
- **SN** - Standard Network
- **PN** - Premium Network

### Copay vs Deductible

**Copay (%):**
- Percentage of the bill the patient pays
- Example: 20% copay on 1000 AED = 200 AED patient pays

**Deductible (AED):**
- Fixed amount the patient pays
- Example: 50 AED deductible = 50 AED patient pays regardless of bill

**Should Set Copay:**
- ✓ = Apply this copay/deductible
- - = Don't apply

### Policy Authority

- **DOH** - Department of Health (Abu Dhabi)
- **DHA** - Dubai Health Authority
- **Other** - Other emirates or federal

---

## 💡 Tips & Best Practices

### 1. Pre-Check Before Appointment

Check eligibility before the patient's appointment to:
- Confirm coverage
- Know copay amounts in advance
- Identify pre-approval requirements

### 2. Save Important Information

Note down:
- Member ID
- Network type
- Copay percentages
- Pre-approval requirements

### 3. Check Special Remarks

Always read the special remarks for:
- Pre-approval requirements
- Referral requirements
- Waiting periods
- Coverage limitations

### 4. Keep Documents Handy

Download referral documents:
- Show to patient for transparency
- Keep in patient file
- Use for billing reference

### 5. Multiple Insurances

If patient has multiple insurance cards:
- Check each one separately
- Compare coverage
- Use the one with best coverage for this visit

---

## ⚠️ Important Notes

### Required Information

Always have ready:
- Patient's Emirates ID or Member ID
- Patient's phone number
- Visit type/reason
- Insurance card information

### When to Check

Check eligibility:
- ✅ Before scheduled appointments
- ✅ During patient registration
- ✅ For emergency visits
- ✅ When changing insurance

Don't check:
- ❌ For already verified recent visits
- ❌ Multiple times in same day (unless insurance changed)

### Pre-Approval Requirements

If special remarks mention pre-approval:
1. Note the threshold amount
2. Note which services require pre-approval
3. Obtain pre-approval before service if needed
4. Document pre-approval reference number

### Expired Policies

If you see:
> Policy End Date: 2024-12-31 (expired)

- Don't proceed with insurance billing
- Ask patient for updated insurance
- Consider self-pay option

---

## 🐛 Troubleshooting

### "Patient not found"
- ✓ Verify Emirates ID is correct
- ✓ Try Member ID instead
- ✓ Check if insurance is active
- ✓ Confirm patient has coverage with this TPA

### "Invalid Emirates ID format"
- ✓ Format must be: 784-1234-1234567-1
- ✓ Exactly 15 digits with dashes
- ✓ No letters allowed

### "This field is required"
- ✓ Fill all fields marked with red asterisk (*)
- ✓ Some fields appear based on TPA selection

### "API Error"
- ✓ Check your internet connection
- ✓ Try again in a moment
- ✓ Contact IT if persists

### Form is slow
- ✓ Normal - API calls take 5-15 seconds
- ✓ Wait for the response
- ✓ Don't click submit multiple times

---

## 📞 Getting Help

### Technical Issues
Contact IT Support with:
- Patient MPI
- TPA name
- Error message (if any)
- Screenshot of issue

### Insurance Questions
Contact the TPA directly using phone numbers on insurance card

### Training
Request additional training from your supervisor

---

## ✅ Quick Checklist

Before checking eligibility:
- [ ] Patient record is open
- [ ] Insurance card is visible
- [ ] Insurance is active (not expired)
- [ ] Have patient's Emirates ID or Member ID
- [ ] Know the visit type

After receiving results:
- [ ] Note eligibility status
- [ ] Record copay amounts
- [ ] Check special remarks
- [ ] Note pre-approval requirements
- [ ] Download claim form if needed
- [ ] Explain copay to patient

---

## 📊 Example Results Interpretation

### Example 1: Simple Outpatient

```
✅ Patient is Eligible
Network: WN (Workers Network)
Copay: 20% on LAB, 30% on MEDICINES
Deductible: 20 AED on CONSULTATION

Action: 
- Charge 20 AED for consultation
- Add 20% copay on any lab tests
- Add 30% copay on any medicines prescribed
```

### Example 2: Pre-Approval Required

```
✅ Patient is Eligible
Network: GN (General Network)
Copay: 0% on most services

⚠️ Special Remarks:
- Pre-approval required for amounts above 700 AED
- Pre-approval required for: CT Scan, MRI

Action:
- For basic consultation: Proceed normally
- For CT scan: Get pre-approval FIRST
- For bills > 700 AED: Get pre-approval FIRST
```

### Example 3: Not Eligible

```
❌ Patient is Not Eligible
Status: not_found

Action:
- Verify insurance card is current
- Ask patient to check with insurance company
- Offer self-pay option
- Reschedule after insurance is confirmed
```

---

**Remember:** This tool helps verify eligibility in real-time. Always check eligibility before providing services to avoid billing issues later!

---

**Last Updated:** November 28, 2025
**Version:** 1.0.0

