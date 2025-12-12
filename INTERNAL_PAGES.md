# Clinic Configuration Documentation

This document describes the clinic configuration page available in the Aster Clinics application.

## Overview

The Clinic Configuration page (`/clinic-config`) provides clinic-specific value mappings for administrative configuration.

## Clinic Configuration Page (`/clinic-config`)

### Purpose
Allows administrators to create and manage clinic-specific value mappings for:
- Payer Codes
- Plan Codes
- Visit Types
- ID Types
- TPA Codes
- Other custom mappings

### Access
Navigate to: `http://localhost:3000/clinic-config` (or your domain)

### Features
- **Active Clinic Display**: Shows the currently selected clinic name and ID at the top of the page
- **Add Mappings**: Create new source-to-target value mappings
- **Edit Mappings**: Modify existing mappings
- **Delete Mappings**: Remove mappings that are no longer needed
- **Search & Filter**: Find mappings by type or search term
- **Clinic-Specific**: All mappings are scoped to the selected clinic/team

### Use Cases

#### Example 1: Map TPA Code to Display Name
```
Type: TPA Code
Source Value: TPA004
Target Value: NAS
Description: National Assurance Services
```

#### Example 2: Map Payer Code
```
Type: Payer Code
Source Value: INS012
Target Value: Oman Insurance / Sukoon
Description: Oman Insurance Company
```

#### Example 3: Map Visit Type
```
Type: Visit Type
Source Value: OP
Target Value: OUTPATIENT
Description: Outpatient visit type mapping
```

### Using Mappings in Code

```typescript
import { getMappingValue, MAPPING_TYPES } from '../lib/clinic-config'

// Get a specific mapping
const displayName = await getMappingValue(
  clinicId,
  MAPPING_TYPES.TPA_CODE,
  'TPA004'
)
// Returns: "NAS"

// Get all mappings of a type
import { getMappingsByType } from '../lib/clinic-config'
const payerMappings = await getMappingsByType(clinicId, MAPPING_TYPES.PAYER_CODE)
```


## API Endpoints

### Mappings API

#### Get All Mappings
```
GET /api/mappings?clinic_id={clinic_id}
```

#### Create Mapping
```
POST /api/mappings
Body: {
  clinic_id: string
  mapping_type: string
  source_value: string
  target_value: string
  description?: string
}
```

#### Update Mapping
```
PUT /api/mappings/{id}
Body: {
  mapping_type: string
  source_value: string
  target_value: string
  description?: string
}
```

#### Delete Mapping
```
DELETE /api/mappings/{id}
```


## Data Storage

**Current Implementation**: In-memory storage (Map-based)

**Production Recommendation**: Replace with a proper database (PostgreSQL, MongoDB, etc.)

### Migration Path

To migrate to a database:

1. Create database table:
   - `clinic_mappings` table

2. Update API routes to use database queries instead of Map operations

3. Example schema:

```sql
-- Mappings table
CREATE TABLE clinic_mappings (
  id VARCHAR(255) PRIMARY KEY,
  clinic_id VARCHAR(255) NOT NULL,
  mapping_type VARCHAR(50) NOT NULL,
  source_value VARCHAR(255) NOT NULL,
  target_value VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_clinic_id (clinic_id),
  INDEX idx_mapping_type (mapping_type)
);
```

## Security Considerations

1. **Authentication**: The page requires user authentication
2. **Clinic Isolation**: Data is scoped to the selected clinic/team
3. **Active Clinic Display**: Users can clearly see which clinic they are configuring

### Recommended Production Enhancements

1. **Role-Based Access**: Add admin role checking before allowing access
2. **Audit Logging**: Track who makes configuration changes
3. **Encryption**: Encrypt sensitive data at rest
4. **Environment Separation**: Use different configs for dev/staging/production

## Examples

### Example: Using Mappings in Eligibility Check

```typescript
import { getMappingValue, MAPPING_TYPES } from '../lib/clinic-config'

async function performEligibilityCheck(clinicId: string, tpaCode: string) {
  // Get the display name for the TPA code
  const tpaDisplayName = await getMappingValue(
    clinicId,
    MAPPING_TYPES.TPA_CODE,
    tpaCode
  )

  console.log(`Checking eligibility with ${tpaDisplayName || tpaCode}`)

  // Proceed with eligibility check...
}
```


## Troubleshooting

### Mappings not showing up
- Verify you're logged in and have a team selected
- Check browser console for API errors
- Ensure the clinic_id matches your selected team

### Config changes not taking effect
- Refresh the page after saving
- Check that the API endpoints are returning the correct values
- Verify environment variables are set as fallbacks


## Future Enhancements

Potential improvements for this page:

1. **Import/Export**: Bulk import/export of mappings via CSV
2. **Version History**: Track changes to configurations over time
3. **Multi-Clinic Management**: Ability to copy configs/mappings between clinics
4. **Validation**: Add validation rules for specific mapping types
5. **API Documentation**: Interactive API documentation within the app
6. **Backup/Restore**: Automated backup of configurations

