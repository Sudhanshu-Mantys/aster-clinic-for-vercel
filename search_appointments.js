const https = require("https");
const fs = require("fs");

// Configuration
const API_URL =
  "https://stage.asterclinics.com/SCMS/web/app_sbox.php/apmgnt/patient/all/appointment/search/get";
const MPII = 1005774132;
const DAYS_PER_CALL = 3;
const TOTAL_CALLS = 150;
const BATCH_SIZE = 10;

// Calculate date ranges (going backwards from today)
function getDateRanges() {
  const ranges = [];
  const today = new Date();

  for (let i = 0; i < TOTAL_CALLS; i++) {
    const toDate = new Date(today);
    toDate.setDate(today.getDate() - i * DAYS_PER_CALL);

    const fromDate = new Date(toDate);
    fromDate.setDate(toDate.getDate() - (DAYS_PER_CALL - 1));

    ranges.push({
      from: formatDate(fromDate),
      to: formatDate(toDate),
      label: `${formatDate(fromDate)} to ${formatDate(toDate)}`,
    });
  }

  return ranges;
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function makeRequest(fromDate, toDate) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      head: {
        reqtime: new Date().toDateString(),
        srvseqno: "",
        reqtype: "POST",
      },
      body: {
        payerId: null,
        visitTypeId: null,
        recPerPage: 20,
        mpii1: MPII,
        patientName: null,
        mobPhn: null,
        groupByApntStatus: 0,
        appStatusId: "16,3,21,22,6,23,24,17,25,18,7,8,15,11,26,27",
        referralUploadFilter: 0,
        orderType: null,
        timeOrderBy: 2,
        filterByReferral: 0,
        mcnNo: null,
        visitPurposeId: null,
        mpii2: null,
        isFilterDate: 1,
        displayEncounterNumber: null,
        physicianId: null,
        payerTypeId: null,
        specialisationId: null,
        insuranceType: null,
        customerSiteId: 1,
        roomId: null,
        isEmergencyAppointment: null,
        fromDate: fromDate,
        type: null,
        toDate: toDate,
        pageNo: 0,
        encounterType: 1,
      },
    });

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(API_URL, options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve({ error: "Failed to parse JSON", raw: data });
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function searchAppointments() {
  const ranges = getDateRanges();
  const results = [];

  console.log(`Starting search for MPII ${MPII}`);
  console.log(`Making ${TOTAL_CALLS} calls in BATCHES of ${BATCH_SIZE}`);
  console.log(
    `Total period: ${ranges[ranges.length - 1].label} to ${ranges[0].label}`,
  );
  console.log("---\n");

  for (let i = 0; i < ranges.length; i += BATCH_SIZE) {
    const currentBatch = ranges.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(ranges.length / BATCH_SIZE);

    console.log(
      `Processing Batch [${batchNumber}/${totalBatches}] (${currentBatch.length} requests)...`,
    );

    const batchPromises = currentBatch.map((range) => {
      return makeRequest(range.from, range.to)
        .then((response) => ({ status: "fulfilled", response, range }))
        .catch((error) => ({ status: "rejected", error, range }));
    });

    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach((item) => {
      if (item.status === "fulfilled") {
        const { response, range } = item;

        // Get Status Text safely
        const statusText =
          response.head && response.head.StatusText
            ? response.head.StatusText
            : "Unknown";

        // Check for Data
        const hasAppointments =
          response.body &&
          response.body.Data &&
          Array.isArray(response.body.Data) &&
          response.body.Data.length > 0;

        if (hasAppointments) {
          const count = response.body.Data.length;
          console.log(
            `  ✓ [${range.label}] FOUND ${count} appointment(s)! (Status: ${statusText})`,
          );
          results.push({
            range: range.label,
            from: range.from,
            to: range.to,
            count: count,
            statusText: statusText,
            appointments: response.body.Data,
          });
        } else {
          // IF UNKNOWN, PRINT THE ERROR TO SEE WHAT HAPPENED
          if (statusText === "Unknown") {
            console.log(
              `  ? [${range.label}] Failed. Raw response:`,
              JSON.stringify(Object.keys(response.body)),
            );
          } else {
            console.log(
              `  - [${range.label}] No appointments (Status: ${statusText})`,
            );
          }
        }
      } else {
        console.log(`  ✗ [${item.range.label}] Error: ${item.error.message}`);
      }
    });

    if (i + BATCH_SIZE < ranges.length) {
      console.log("  Waiting 1s before next batch...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("\n---");
  console.log("SUMMARY");
  console.log("---\n");

  if (results.length > 0) {
    console.log(`Found appointments in ${results.length} date range(s):\n`);
    results.forEach((result, idx) => {
      console.log(
        `${idx + 1}. ${result.range}: ${result.count} appointment(s)`,
      );
      result.appointments.forEach((apt, aptIdx) => {
        console.log(
          `   ${aptIdx + 1}. Appt ID: ${apt.appointmentId || "N/A"}, Date: ${apt.appointmentDate || "N/A"}, Status: ${apt.appointmentStatus || "N/A"}`,
        );
      });
      console.log("");
    });

    fs.writeFileSync(
      "appointment_search_results.json",
      JSON.stringify(results, null, 2),
    );
    console.log("Detailed results saved to appointment_search_results.json");
  } else {
    console.log("No appointments found in any date range.");
  }
}

// Run the search
searchAppointments().catch(console.error);
