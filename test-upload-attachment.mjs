/**
 * Test script for uploading attachments to Aster
 *
 * Usage:
 * node test-upload-attachment.mjs
 */

// Example 1: Upload a file from a URL (e.g., screenshot hosted somewhere)
async function testUploadFromUrl() {
  const uploadRequest = {
    patientId: 5879549,
    encounterId: 27342125,
    appointmentId: 28068161,
    insTpaPatId: 8402049,
    fileName: "eligibility-screenshot.pdf",
    fileUrl: "https://example.com/path-to-your-screenshot.pdf", // Replace with actual URL
    // Optional fields:
    // uploadDate: "2025-12-11",
    // expiryDate: "2026-02-11",
    // reportDate: "2025-12-11",
    // createdBy: 13295,
  };

  try {
    const response = await fetch("http://localhost:8888/api/aster/upload-attachment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(uploadRequest),
    });

    const result = await response.json();
    console.log("Upload result:", JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log("✅ Upload successful!");
    } else {
      console.log("❌ Upload failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Request error:", error.message);
  }
}

// Example 2: Upload a file from base64 data
async function testUploadFromBase64() {
  // This is a minimal PDF file for testing
  const samplePdfBase64 = "JVBERi0xLjYKJcOkw7zDtsOfCjI0IDAgb2JqPDwvRmlsdGVyL0ZsYXRlRGVjb2RlL0ZpcnN0IDQvTGVuZ3RoIDIxNi9OIDEvVHlwZS9PYmpTdG0+PnN0cmVhbQpo";

  const uploadRequest = {
    patientId: 5879549,
    encounterId: 27342125,
    appointmentId: 28068161,
    insTpaPatId: 8402049,
    fileName: "eligibility-screenshot.pdf",
    fileBase64: samplePdfBase64,
  };

  try {
    const response = await fetch("http://localhost:8888/api/aster/upload-attachment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(uploadRequest),
    });

    const result = await response.json();
    console.log("Upload result:", JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log("✅ Upload successful!");
    } else {
      console.log("❌ Upload failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Request error:", error.message);
  }
}

// Run the test
console.log("🧪 Testing file upload API...\n");
console.log("Choose test method:");
console.log("1. Upload from URL (uncomment testUploadFromUrl)");
console.log("2. Upload from base64 (uncomment testUploadFromBase64)\n");

// Uncomment the test you want to run:
// await testUploadFromUrl();
// await testUploadFromBase64();

console.log("\n💡 Tip: Update the patient/encounter/appointment IDs with real values from your system");
