#!/bin/bash

# Test curl command for uploading attachment via Next.js API
# Using the same patient details from your original curl example

curl -X POST http://localhost:3001/api/aster/upload-attachment \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": 5879549,
    "encounterId": 27342125,
    "appointmentId": 28068161,
    "insTpaPatId": 8402049,
    "fileName": "eligibility-screenshot.pdf",
    "fileUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  }'
