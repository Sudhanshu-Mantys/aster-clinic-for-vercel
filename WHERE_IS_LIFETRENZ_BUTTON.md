# Where is the "Send Data Back to Lifetrenz" Button?

## Quick Answer

The **"Send Data Back to Lifetrenz"** button is on the **Eligibility Checks** page, inside the **eligibility check results** modal/drawer.

---

## Step-by-Step Guide

### 1. Navigate to Eligibility Checks Page

At the top of your screen, you'll see two navigation tabs:
- **Lifetrenz Integration** (Patient Dashboard)
- **Eligibility Checks** ← YOU NEED TO BE HERE

👉 **Click on "Eligibility Checks"**

---

### 2. View Eligibility Check History

You'll see a list of all eligibility checks that have been performed, showing:
- Patient Name
- Patient ID
- Date of Birth
- Payer Name
- Task ID
- Status (Complete, Pending, Processing, Error)

---

### 3. Click on a Completed Check

- Find an eligibility check with status **"Complete"**
- Click anywhere on that row to open the results

---

### 4. View the Results

A drawer/modal will slide in from the right showing:
- Eligibility Status (Eligible/Not Eligible)
- Patient Information
- Policy Details
- Network Information
- Copay and Deductible Details
- TPA Portal Screenshot

---

### 5. Find the Button

Scroll to the **bottom** of the results drawer. You'll see:

```
┌────────────────────────────────────────────┐
│                                            │
│  [Send Data Back to Lifetrenz]  (Blue)    │ ← THIS BUTTON!
│                                            │
│  [Check Another Eligibility]   [Close]    │
│                                            │
└────────────────────────────────────────────┘
```

---

## Visual Flow Diagram

```
Eligibility Checks Tab
    ↓
View History List
    ↓
Click on Completed Check (Status: Complete)
    ↓
Results Drawer Opens
    ↓
Scroll to Bottom
    ↓
See Three Buttons:
  1. 📤 Send Data Back to Lifetrenz (Blue) ← HERE!
  2. Check Another Eligibility (Green)
  3. Close (Outline)
```

---

## Important Notes

### ✅ Button WILL Appear When:
- You're on the **Eligibility Checks** page
- You've opened a **Completed** eligibility check result
- The check has successfully retrieved data from the TPA portal

### ❌ Button WILL NOT Appear When:
- The eligibility check is still **Pending** or **Processing**
- The eligibility check has **Failed/Error** status
- You haven't opened a result yet

---

## What the Button Does

When you click "Send Data Back to Lifetrenz":

1. **Sidebar opens** from the right (700px wide)
2. **Preview shows** all eligibility data that will be sent:
   - Eligibility Status (Eligible/Not Eligible)
   - Task ID and TPA Information
   - Patient Information (Name, Emirates ID, DOB, Gender, etc.)
   - Insurance/Policy Details (Payer, Policy Number, Dates, etc.)
   - Network Information
   - Coverage & Copay Details
   - Warning Messages (if any)
   - Referral Documents (if any)
3. **Warning banner** appears: "API Integration Pending"
4. **Send button** at bottom is currently disabled
5. You can **Cancel** to close the preview

---

## Complete User Flow

```
1. Navigate to "Eligibility Checks" page
   ↓
2. See list of eligibility checks
   ↓
3. Click on a check with "Complete" status
   ↓
4. Results drawer opens showing eligibility information
   ↓
5. Scroll to bottom of results
   ↓
6. Click "Send Data Back to Lifetrenz" (blue button)
   ↓
7. Preview sidebar opens with all data
   ↓
8. Review the data sections:
   - Eligibility Status
   - Patient Information
   - Insurance/Policy Details
   - Network Information
   - Coverage & Copay Details
   - Warning Messages
   - Referral Documents
   ↓
9. See warning: "API Integration Pending"
   ↓
10. "Send to Lifetrenz" button is disabled
   ↓
11. Click "Cancel" to close preview
```

---

## Button Location Summary

### ✅ CORRECT Location (Where the button IS):
**Eligibility Checks Page** → Click Completed Check → Results Drawer → Bottom of Results → "Send Data Back to Lifetrenz" Button

### ❌ Old Location (Not anymore):
The button was previously on the Patient Dashboard (Insurance Details Section), but has been moved to the Eligibility Checks results page where it makes more sense contextually.

---

## Screenshots Reference

### Correct Page (Eligibility Checks Results)
Look for:
- ✅ "Eligibility Check Results - [Patient Name]" heading
- ✅ Green/Red status banner (Eligible/Not Eligible)
- ✅ Patient info, policy details, copay details
- ✅ TPA portal screenshot
- ✅ **Blue "Send Data Back to Lifetrenz" button at bottom**

### Wrong Page (History List)
If you only see:
- ❌ List of eligibility checks
- ❌ "No results yet, click on a check above"
- ❌ No patient details displayed

Then you need to **click on a completed check** to open the results.

---

## Quick Test

To verify you're in the right place:

1. Look at the page/drawer heading
   - ✅ "Eligibility Check Results - [Patient Name]" = Correct
   - ❌ "Eligibility Check History" only = Wrong (need to open a result)

2. Look for these elements:
   - ✅ Large eligibility status banner (Green = Eligible, Red = Not Eligible)
   - ✅ Patient information displayed
   - ✅ TPA portal screenshot
   - ✅ Blue "Send Data Back to Lifetrenz" button
   - ❌ Only a list of checks = Wrong (need to click on one)

---

## Status Indicators

The button will appear for checks with these statuses:
- ✅ **Complete** - Full results available
- ❌ **Pending** - Still waiting for TPA response
- ❌ **Processing** - Currently extracting data
- ❌ **Error/Failed** - Check failed

---

## Need Help?

If you still can't find the button after following these steps:

1. ✅ Verify you're on the "Eligibility Checks" page (not "Lifetrenz Integration")
2. ✅ Ensure you have at least one completed eligibility check in the history
3. ✅ Click on a check row to open the results
4. ✅ Scroll to the bottom of the results drawer
5. ✅ Look for the blue button with paper plane icon

If all steps are completed and you don't see the button, the eligibility check may have failed or is still processing.

---

## Integration with Lifetrenz

### Current Status: Preview Mode
- The button is visible and functional
- Opens a comprehensive data preview
- **Send button is disabled** (API integration pending)

### When API is Ready:
- Send button will be enabled
- Data will be transmitted to Lifetrenz API
- Success/error notifications will appear
- Confirmation of data sent will be logged

---

**Last Updated**: November 2025  
**Feature Status**: Preview Mode (API Integration Pending)  
**Location**: Eligibility Checks → Completed Check Results → Bottom of Drawer