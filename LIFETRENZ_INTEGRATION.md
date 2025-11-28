# Lifetrenz Integration

This document describes the "Send Data Back to Lifetrenz" feature that allows users to preview and send insurance data from the Aster Clinics system back to the Lifetrenz platform.

## Overview

The Lifetrenz integration enables seamless data synchronization between Aster Clinics and Lifetrenz. When viewing a patient's insurance details, users can click a button to preview the data that will be sent and then submit it to Lifetrenz (once the API is integrated).

## Features

### 1. Send Data Back to Lifetrenz Button

- **Location**: Insurance Details Section, within each active insurance card
- **Visibility**: Only visible for insurance policies with "Active" status
- **Function**: Opens a preview sidebar showing all data that will be sent to Lifetrenz

### 2. Data Preview Sidebar

The preview sidebar displays a comprehensive view of the data before sending, organized into sections:

#### Patient Information
- MPI (Medical Patient Identifier)
- Full Name (First, Middle, Last)
- Date of Birth
- Gender
- Nationality
- Emirates ID
- Phone Number
- Email Address

#### Insurance Details
- Insurance Card Number
- Receiver ID, Name, and Code
- Payer ID, Name, and Code
- Network (TPA Name)
- Plan and Plan Code
- Policy Number
- Corporate Name
- Rate Card
- Authorization Limit
- Insurance Status

#### Policy Dates
- Start Date
- Last Renewal Date
- Expiry Date

#### Patient Payable / Coverage Details
- **Copay Details**: Charge groups with payable amounts and percentages
- **Deductible Details**: Charge groups with deductible amounts

### 3. Send to Lifetrenz Action

- **Button State**: Currently **disabled** (API integration pending)
- **Visual Indicator**: Yellow warning banner indicates API integration is not yet complete
- **Preview Mode Badge**: Shows "Preview Mode" to indicate the feature is in demonstration state

## User Flow

1. **Navigate to Patient Dashboard**
   - Search for a patient using MPI or Emirates ID

2. **View Insurance Details**
   - Expand a patient's details to see their insurance information
   - Expand an active insurance card

3. **Click "Send Data Back to Lifetrenz"**
   - Button appears below the "Check Eligibility with Mantys" button
   - Only available for active insurance policies

4. **Review Data Preview**
   - Sidebar opens from the right with smooth animation
   - All data is displayed in organized, color-coded sections
   - Review patient information, insurance details, and coverage information

5. **Send to Lifetrenz (When API is Ready)**
   - Currently the "Send to Lifetrenz" button is disabled
   - Once API integration is complete, clicking this button will:
     - Send the data to Lifetrenz API
     - Show confirmation message
     - Update the insurance record status

## Technical Implementation

### Components

#### `LifetrenzDataPreview.tsx`
Main component that renders the data preview sidebar.

**Props:**
- `insuranceData: InsuranceData` - The insurance record to send
- `patientData?: PatientData | null` - Patient demographic information
- `onClose: () => void` - Callback to close the preview

**Features:**
- Organizes data into logical sections with color-coded headers
- Displays all relevant patient and insurance information
- Shows warning banner for API integration status
- Disabled "Send to Lifetrenz" button with tooltip

#### `InsuranceDetailsSection.tsx`
Updated to include the new button and sidebar integration.

**State Management:**
```typescript
const [selectedInsuranceForLifetrenz, setSelectedInsuranceForLifetrenz] = useState<InsuranceData | null>(null)
const [showLifetrenzPreview, setShowLifetrenzPreview] = useState(false)
```

**Handler Functions:**
```typescript
const handleSendToLifetrenz = (insurance: InsuranceData) => {
    setSelectedInsuranceForLifetrenz(insurance)
    setShowLifetrenzPreview(true)
}

const handleCloseLifetrenzPreview = () => {
    setShowLifetrenzPreview(false)
    setTimeout(() => setSelectedInsuranceForLifetrenz(null), 300)
}
```

### Data Payload Structure

The data sent to Lifetrenz follows this structure:

```typescript
{
  patient: {
    mpi: string
    firstName: string
    middleName: string
    lastName: string
    dateOfBirth: string
    gender: string
    nationality: string
    emiratesId: string
    phone: string
    email: string
  },
  insurance: {
    cardNumber: string
    receiverId: number
    receiverName: string
    receiverCode: string
    payerId: number
    payerName: string
    payerCode: string
    network: string
    plan: string
    planCode: string
    policyNumber: string
    corporateName: string
    startDate: string
    lastRenewalDate: string
    expiryDate: string
    status: string
    rateCard: string
    authorizationLimit: string
  },
  coverage: {
    copay: Array<CopayDetail>
    deductible: Array<DeductibleDetail>
  }
}
```

## UI/UX Design

### Visual Hierarchy

1. **Header Section** (Gradient Blue)
   - Title: "Send Data to Lifetrenz"
   - Subtitle: "Review the data before sending"
   - Badge: "Preview Mode"

2. **Content Sections** (Color-coded)
   - Patient Information (Indigo/Blue gradient)
   - Insurance Details (Green/Emerald gradient)
   - Policy Dates (Amber/Orange gradient)
   - Coverage Details (Purple/Pink gradient)

3. **Warning Banner** (Yellow)
   - Indicates API integration is pending
   - Explains why the send button is disabled

4. **Action Buttons**
   - Cancel: Returns to insurance details
   - Send to Lifetrenz: Disabled with tooltip

### Responsive Design

- Sidebar width: 700px
- Scrollable content area for long data sets
- Fixed header and footer for easy navigation
- Smooth animations for opening/closing

## API Integration (Pending)

Once the Lifetrenz API is ready, the following needs to be implemented:

### 1. Create API Endpoint

**File**: `renderer/pages/api/lifetrenz/send-data.ts`

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { patient, insurance, coverage } = req.body

    // TODO: Replace with actual Lifetrenz API endpoint
    const response = await fetch('https://api.lifetrenz.com/insurance/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LIFETRENZ_API_KEY}`
      },
      body: JSON.stringify({ patient, insurance, coverage })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send data to Lifetrenz')
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Data sent successfully',
      data 
    })
  } catch (error) {
    console.error('Lifetrenz API Error:', error)
    return res.status(500).json({ 
      error: error.message || 'Failed to send data to Lifetrenz' 
    })
  }
}
```

### 2. Update Frontend Handler

In `LifetrenzDataPreview.tsx`, update the `handleSendToLifetrenz` function:

```typescript
const [isSending, setIsSending] = useState(false)
const [sendError, setSendError] = useState<string | null>(null)
const [sendSuccess, setSendSuccess] = useState(false)

const handleSendToLifetrenz = async () => {
  setIsSending(true)
  setSendError(null)

  try {
    const response = await fetch('/api/lifetrenz/send-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lifetrenzPayload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send data')
    }

    setSendSuccess(true)
    // Show success message
    // Optionally close the sidebar after a delay
    setTimeout(() => {
      onClose()
    }, 2000)
  } catch (error) {
    setSendError(error.message)
  } finally {
    setIsSending(false)
  }
}
```

### 3. Environment Variables

Add to `.env.local`:

```bash
LIFETRENZ_API_KEY=your_api_key_here
LIFETRENZ_API_URL=https://api.lifetrenz.com
```

### 4. Enable the Send Button

Remove the `disabled={true}` prop once API is integrated:

```typescript
<Button
  onClick={handleSendToLifetrenz}
  disabled={isSending}
  className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
>
  {isSending ? 'Sending...' : 'Send to Lifetrenz'}
</Button>
```

## Testing Checklist

- [ ] Button appears only for active insurance policies
- [ ] Sidebar opens smoothly when button is clicked
- [ ] All patient data is displayed correctly
- [ ] All insurance data is displayed correctly
- [ ] Coverage details (copay/deductible) are shown when available
- [ ] Sidebar closes properly when Cancel is clicked
- [ ] Send button shows disabled state with appropriate styling
- [ ] Warning banner is visible
- [ ] Preview Mode badge is displayed
- [ ] Data payload structure matches specification
- [ ] Console logs the correct payload structure

## Future Enhancements

1. **Success/Error Notifications**
   - Toast notifications for send success/failure
   - Detailed error messages for debugging

2. **Send History**
   - Track when data was last sent to Lifetrenz
   - Display timestamp and status in insurance card

3. **Batch Operations**
   - Send multiple insurance records at once
   - Bulk update functionality

4. **Data Validation**
   - Validate required fields before sending
   - Show warnings for incomplete data

5. **Audit Trail**
   - Log all data transmissions
   - Track user who initiated the send
   - Store response from Lifetrenz

## Support

For issues or questions about the Lifetrenz integration:

1. Check console logs for error messages
2. Verify all required data fields are present
3. Ensure API credentials are configured correctly
4. Contact the development team for API-related issues

---

**Last Updated**: November 2025  
**Status**: Preview Mode (API Integration Pending)