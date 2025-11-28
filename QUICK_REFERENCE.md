# Quick Reference: Send Data Back to Lifetrenz

## 🎯 What is this feature?

After checking a patient's insurance eligibility with Mantys, you can send the verified insurance data back to Lifetrenz's Insurance Detail screen.

---

## 📍 Where to find it?

1. Go to **"Eligibility Checks"** page (top navigation)
2. Click on a **completed** eligibility check
3. Scroll to the **bottom** of the results drawer
4. Click the **blue button**: "Send Data Back to Lifetrenz"

---

## 📋 What data gets sent?

### Insurance Card Details
- Insurance Card # (Member ID)
- Receiver ID
- Payer
- Network
- Plan
- Policy#
- Corporate Name

### Policy Dates
- Start Date
- Last Renewal Date
- Expiry Date
- Rate Card

### Patient Payable
- Deductible (Yes/No)
- Copay Details by category (Outpatient, Inpatient, etc.)
  - Service breakdown: LAB, MEDICINES, PROCEDURE, RADIOLOGY, CONSULTATION
  - Flat, %, and Max values

---

## ✅ Current Status

**Button**: ✅ Visible  
**Preview**: ✅ Working  
**Send Function**: ⏳ Disabled (API integration pending)  

---

## 🔮 When API is ready

1. The "Send to Lifetrenz" button will be enabled
2. Data will be transmitted to Lifetrenz API
3. Success/error notifications will appear
4. Insurance Detail screen in Lifetrenz will be populated

---

## 🚨 Important Notes

- Button only appears for **completed** eligibility checks
- Preview shows exactly what will be sent
- Some fields may show "Not Available" if not in Mantys response
- Send button is currently **disabled** until API is configured

---

## 🆘 Troubleshooting

**Q: I don't see the button**  
A: Make sure you're viewing a completed check (green "Complete" status)

**Q: Can't click "Send to Lifetrenz"**  
A: The button is disabled until API integration is complete

**Q: Some fields say "Not Available"**  
A: Those fields aren't provided by the Mantys API response

---

**Last Updated**: November 28, 2025  
**Feature Status**: Preview Mode (API Pending)