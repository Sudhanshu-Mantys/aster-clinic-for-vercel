# Appointment Search API Examples

This document provides examples of how to use the new flexible appointment search API endpoint.

## API Endpoint

**Frontend Function:** `searchAppointments(params)`  
**API Route:** `/api/patient/search-appointments`  
**Backend Endpoint:** `https://aster-clinics-dev.mantys.org/SCMS/web/app.php/apmgnt/patient/all/appointment/search/get`

## Basic Usage

### Example 1: Search by Phone Number with Date Range

This matches the provided curl command:

```typescript
import { searchAppointments } from '@/lib/api'

const results = await searchAppointments({
    phoneNumber: 433,
    fromDate: '11/25/2025',
    toDate: '11/27/2025',
    customerSiteId: 1,
})
```

### Example 2: Search by MPI

```typescript
const results = await searchAppointments({
    mpi: 'MPI123456',
    fromDate: '11/01/2025',
    toDate: '11/30/2025',
    customerSiteId: 1,
})
```

### Example 3: Search by Patient Name

```typescript
const results = await searchAppointments({
    patientName: 'John Doe',
    fromDate: '11/01/2025',
    toDate: '11/30/2025',
})
```

### Example 4: Search with Specific Physician and Specialization

```typescript
const results = await searchAppointments({
    physicianId: 123,
    specialisationId: 456,
    fromDate: '11/27/2025',
    toDate: '11/27/2025',
    customerSiteId: 1,
})
```

### Example 5: Search with Multiple Filters

```typescript
const results = await searchAppointments({
    phoneNumber: '1234567890',
    fromDate: '11/01/2025',
    toDate: '11/30/2025',
    customerSiteId: 1,
    encounterType: 1,
    appStatusId: '16,3,21,22,6,23,24,17,25,18,7,8,15,11,26,27',
    pageNo: 0,
    recPerPage: 20,
})
```

### Example 6: Pagination

```typescript
// First page
const page1 = await searchAppointments({
    phoneNumber: 433,
    fromDate: '11/25/2025',
    toDate: '11/27/2025',
    pageNo: 0,
    recPerPage: 20,
})

// Second page
const page2 = await searchAppointments({
    phoneNumber: 433,
    fromDate: '11/25/2025',
    toDate: '11/27/2025',
    pageNo: 1,
    recPerPage: 20,
})
```

## Response Format

The API returns an `AppointmentSearchResponse` object:

```typescript
{
    head: {
        StatusValue: 200,
        StatusText: "Success"
    },
    body: {
        Data: [
            {
                appointment_id: 123,
                patient_id: 456,
                mpi: "MPI123456",
                full_name: "John Doe",
                mobile_phone: "1234567890",
                email: "john@example.com",
                dob: "01/15/1990",
                age: "33",
                gender: "Male",
                gender_id: 1,
                nationality_id: "784",
                is_estimated: "0",
                appointment_date: "11/27/2025",
                appointment_time: "10:00 AM",
                appointment_status: "Scheduled",
                appointment_status_id: 3,
                physician_name: "Dr. Smith",
                specialisation_name: "Cardiology",
                // ... additional fields
            }
        ],
        RecordCount: 1,
        TotalRecords: 1
    }
}
```

## Available Search Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `phoneNumber` | string/number | Mobile phone number | - |
| `mpi` | string | Master Patient Index | - |
| `patientName` | string | Patient's full name | - |
| `mcnNo` | string | MCN Number | - |
| `displayEncounterNumber` | string | Encounter number | - |
| `fromDate` | string | Start date (MM/DD/YYYY) | Today |
| `toDate` | string | End date (MM/DD/YYYY) | Today |
| `isFilterDate` | number | Enable date filtering (0 or 1) | 1 |
| `pageNo` | number | Page number for pagination | 0 |
| `recPerPage` | number | Records per page | 20 |
| `customerSiteId` | number | Customer site ID | 1 |
| `payerId` | number | Payer ID | null |
| `visitTypeId` | number | Visit type ID | null |
| `physicianId` | number | Physician ID | null |
| `specialisationId` | number | Specialization ID | null |
| `roomId` | number | Room ID | null |
| `visitPurposeId` | number | Visit purpose ID | null |
| `payerTypeId` | number | Payer type ID | null |
| `appStatusId` | string | Comma-separated appointment status IDs | '16,3,21,22,6,23,24,17,25,18,7,8,15,11,26,27' |
| `encounterType` | number | Encounter type | 1 |
| `isEmergencyAppointment` | number | Emergency appointment flag | null |
| `insuranceType` | string | Insurance type | null |
| `groupByApntStatus` | number | Group by appointment status | 0 |
| `referralUploadFilter` | number | Referral upload filter | 0 |
| `filterByReferral` | number | Filter by referral | 0 |
| `timeOrderBy` | number | Time order by | 2 |
| `orderType` | string | Order type | null |
| `type` | string | Type | null |

## Error Handling

```typescript
try {
    const results = await searchAppointments({
        phoneNumber: 433,
        fromDate: '11/25/2025',
        toDate: '11/27/2025',
    })
    
    console.log(`Found ${results.body.RecordCount} appointments`)
    results.body.Data.forEach(appointment => {
        console.log(`${appointment.full_name} - ${appointment.appointment_date}`)
    })
} catch (error) {
    if (error.message.includes('No appointments found')) {
        console.log('No appointments match the search criteria')
    } else {
        console.error('Search error:', error)
    }
}
```

## Using in React Components

```typescript
import { useState } from 'react'
import { searchAppointments, AppointmentSearchParams, AppointmentData } from '@/lib/api'

function AppointmentSearchComponent() {
    const [appointments, setAppointments] = useState<AppointmentData[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSearch = async (params: AppointmentSearchParams) => {
        setLoading(true)
        setError(null)
        
        try {
            const response = await searchAppointments(params)
            setAppointments(response.body.Data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <button onClick={() => handleSearch({
                phoneNumber: 433,
                fromDate: '11/25/2025',
                toDate: '11/27/2025',
            })}>
                Search Appointments
            </button>
            
            {loading && <p>Loading...</p>}
            {error && <p>Error: {error}</p>}
            
            <ul>
                {appointments.map(apt => (
                    <li key={apt.appointment_id}>
                        {apt.full_name} - {apt.appointment_date}
                    </li>
                ))}
            </ul>
        </div>
    )
}
```

## Direct API Call (if needed)

If you need to call the API directly without using the wrapper function:

```typescript
const response = await fetch('/api/patient/search-appointments', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        phoneNumber: 433,
        fromDate: '11/25/2025',
        toDate: '11/27/2025',
        customerSiteId: 1,
    }),
})

const data = await response.json()

if (response.ok) {
    console.log('Appointments:', data.body.Data)
} else {
    console.error('Error:', data.error)
}
```

