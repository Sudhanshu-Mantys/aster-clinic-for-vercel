# Mantys Image Extraction Feature

## Overview
Enhanced the Mantys eligibility check process to display real-time screenshots and documents during the data extraction phase, providing visual feedback to users about what's happening behind the scenes.

## Components Added

### 1. **Modal Component** (`renderer/components/ui/modal.tsx`)
A reusable modal/dialog component that:
- Handles escape key press to close
- Prevents body scroll when open
- Provides backdrop overlay
- Supports custom titles and close buttons

### 2. **ExtractionProgressModal Component** (`renderer/components/ExtractionProgressModal.tsx`)
A specialized modal that displays extraction progress with:
- **Status indicators** with color-coded states (pending, processing, complete)
- **Progress bar** showing estimated completion percentage
- **Live screenshots** from the TPA portal during extraction
- **Document list** showing extracted referral documents
- **Informational messages** explaining what's happening at each stage
- **Attempt counter** showing current polling attempt (e.g., "Attempt 45/150")

## Features

### Visual Feedback During Extraction

#### 1. **Pending State**
- Shows yellow status indicator
- Displays queue information
- Shows estimated wait time (30-90 seconds)

#### 2. **Processing State**
- Shows blue status indicator with animated spinner
- Displays **live screenshot** from TPA portal
  - Real-time image of the extraction process
  - Updates automatically as new screenshots arrive
  - Shows "Live View" indicator with pulsing dot
- Lists **interim documents** being extracted
  - Document tags and IDs
  - View links for each document
- Progress bar shows estimated completion
- Informational panel explaining the process steps

#### 3. **Complete State**
- Shows green checkmark
- Success message
- Allows closing the modal

## How It Works

### Data Flow

```
1. User clicks "Check Eligibility"
   ↓
2. Task is created → Modal opens (pending state)
   ↓
3. Polling starts every 2 seconds
   ↓
4. When status = "processing":
   - Backend receives interim_results from Mantys API
   - Includes: screenshot_key, referral_documents
   ↓
5. Frontend displays:
   - Screenshot from S3 URL (screenshot_key)
   - List of documents with tags and URLs
   ↓
6. Screenshot updates in real-time as extraction progresses
   ↓
7. When complete → Show success state
```

### API Response Structure

**Processing State Response:**
```json
{
  "status": "processing",
  "taskStatus": "EXTRACTING_DATA",
  "message": "Extracting eligibility data...",
  "interimResults": {
    "screenshot": "https://s3.amazonaws.com/...",
    "documents": [
      {
        "id": "doc-123",
        "tag": "Referral Document",
        "url": "https://s3.amazonaws.com/..."
      }
    ]
  }
}
```

## UI/UX Enhancements

### Progress Indicators
- **Progress Bar**: Shows 10% when pending, gradually increases during processing, reaches 100% on completion
- **Attempt Counter**: "Attempt 45/150 (max 5 min)" to show progress
- **Live Indicator**: Pulsing green dot next to "Live View" text

### Visual States
1. **Pending**: Yellow with hourglass icon
2. **Processing**: Blue with spinner + live screenshot
3. **Complete**: Green with checkmark
4. **Error**: Red with error icon (existing)

### Screenshot Display
- **Live Updates**: Screenshot refreshes as new interim results arrive
- **Responsive**: Full-width display with proper aspect ratio
- **Error Handling**: Gracefully hides if image fails to load
- **Context**: Shows caption "Real-time screenshot of the automated extraction process"

### Document Display
- **Card Layout**: Each document in a blue-tinted card
- **Document Icon**: File icon for visual clarity
- **Information**: Shows tag, ID, and view link
- **Interactive**: Click "View" to open document in new tab

## User Benefits

1. **Transparency**: Users can see exactly what the system is doing
2. **Confidence**: Visual proof that extraction is happening
3. **Reduced Anxiety**: Progress indicators show it's not stuck
4. **Educational**: Users learn how the system interacts with TPA portals
5. **Debugging**: Screenshots help troubleshoot issues

## Technical Implementation

### State Management
```typescript
const [interimScreenshot, setInterimScreenshot] = useState<string | null>(null)
const [interimDocuments, setInterimDocuments] = useState<Array<{ id: string; tag: string; url: string }>>([])
const [currentStatus, setCurrentStatus] = useState<'idle' | 'pending' | 'processing' | 'complete'>('idle')
```

### Polling Logic
```typescript
if (data.status === 'processing') {
  setStatusMessage('Extracting eligibility data from TPA portal...')
  setCurrentStatus('processing')
  
  // Store interim results
  if (data.interimResults) {
    if (data.interimResults.screenshot) {
      setInterimScreenshot(data.interimResults.screenshot)
    }
    if (data.interimResults.documents) {
      setInterimDocuments(data.interimResults.documents)
    }
  }
}
```

### Modal Integration
```typescript
<ExtractionProgressModal
  isOpen={isSubmitting}
  onClose={() => {
    if (currentStatus === 'complete') {
      setIsSubmitting(false)
    }
  }}
  status={currentStatus}
  statusMessage={statusMessage}
  interimScreenshot={interimScreenshot}
  interimDocuments={interimDocuments}
  pollingAttempts={pollingAttempts}
  maxAttempts={150}
/>
```

## Configuration

No additional configuration needed. The feature automatically activates when:
1. Task is submitted
2. Backend receives interim results from Mantys API
3. Screenshot/documents are available

## Files Modified

1. `/renderer/components/ui/modal.tsx` - NEW (Base modal component)
2. `/renderer/components/ExtractionProgressModal.tsx` - NEW (Progress modal with images)
3. `/renderer/components/MantysEligibilityForm.tsx` - MODIFIED
   - Added modal integration
   - Enhanced state management for interim results
   - Added status tracking (idle, pending, processing, complete)

## Testing

To test the feature:

1. Navigate to patient dashboard
2. Select a patient with insurance
3. Click "Check Eligibility with Mantys"
4. Observe the modal:
   - Should show pending state initially
   - Then switch to processing with screenshots (if available)
   - Progress bar should increment
   - Documents should appear as they're extracted
   - Finally show complete state

## Future Enhancements

1. **Video Recording**: Record full extraction process
2. **Timeline View**: Show step-by-step extraction timeline
3. **Download Screenshots**: Allow users to download screenshots
4. **Multiple Screenshots**: Show gallery of all screenshots captured
5. **Document Preview**: Show document thumbnails inline
6. **Error Screenshots**: Capture screenshots when errors occur
7. **Performance Metrics**: Show extraction speed and efficiency

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- No special permissions needed for screenshots (served via HTTPS)

## Security Considerations

- Screenshots are served from Mantys S3 bucket
- Documents require proper authentication
- No PHI (Protected Health Information) exposed beyond what's necessary
- Modal prevents interaction with background while processing