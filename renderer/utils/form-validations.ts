/**
 * Comprehensive Form Validation Utilities
 * Provides secure and robust validation functions for eligibility forms
 */

// ============================================================================
// SANITIZATION UTILITIES
// ============================================================================

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return "";

  return input
    .trim()
    .replace(/[<>]/g, "") // Remove angle brackets to prevent HTML injection
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .slice(0, 500); // Limit length to prevent DOS
};

/**
 * Sanitize numeric input (digits only)
 */
export const sanitizeNumericInput = (input: string): string => {
  if (!input) return "";
  return input.replace(/\D/g, "").slice(0, 50);
};

/**
 * Sanitize alphanumeric input
 */
export const sanitizeAlphanumericInput = (input: string): string => {
  if (!input) return "";
  return input.replace(/[^A-Za-z0-9\-\s]/g, "").slice(0, 100);
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate Emirates ID
 * Format: XXX-XXXX-XXXXXXX-X (15 digits total)
 */
export const validateEmiratesId = (emiratesId: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!emiratesId || emiratesId.trim() === "") {
    return { isValid: false, error: "Emirates ID is required" };
  }

  const sanitized = emiratesId.trim();

  // Remove dashes for digit counting
  const digitsOnly = sanitized.replace(/\-/g, "");

  // Check if contains only digits and dashes
  if (!/^[\d\-]+$/.test(sanitized)) {
    return {
      isValid: false,
      error: "Emirates ID must contain only numbers and dashes",
    };
  }

  // Check length
  if (digitsOnly.length !== 15) {
    return {
      isValid: false,
      error: `Emirates ID must be exactly 15 digits (current: ${digitsOnly.length})`,
    };
  }

  // Check format XXX-XXXX-XXXXXXX-X
  const formatRegex = /^\d{3}-\d{4}-\d{7}-\d{1}$/;
  if (!formatRegex.test(sanitized)) {
    return {
      isValid: false,
      error: "Invalid format. Expected: XXX-XXXX-XXXXXXX-X",
    };
  }

  return { isValid: true };
};

/**
 * Validate DHA Member ID
 * Format: XXXX-XXX-XXXXXXXXX-XX (18 alphanumeric characters)
 */
export const validateDhaMemberId = (dhaMemberId: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!dhaMemberId || dhaMemberId.trim() === "") {
    return { isValid: false, error: "DHA Member ID is required" };
  }

  const sanitized = dhaMemberId.trim().toUpperCase();

  // Remove dashes for character counting
  const charsOnly = sanitized.replace(/\-/g, "");

  // Check if contains only alphanumeric and dashes
  if (!/^[A-Z0-9\-]+$/.test(sanitized)) {
    return {
      isValid: false,
      error: "DHA Member ID must contain only letters, numbers, and dashes",
    };
  }

  // Check length
  if (charsOnly.length !== 18) {
    return {
      isValid: false,
      error: `DHA Member ID must be exactly 18 characters (current: ${charsOnly.length})`,
    };
  }

  // Check format XXXX-XXX-XXXXXXXXX-XX
  const formatRegex = /^[A-Z0-9]{4}-[A-Z0-9]{3}-[A-Z0-9]{9}-[A-Z0-9]{2}$/;
  if (!formatRegex.test(sanitized)) {
    return {
      isValid: false,
      error: "Invalid format. Expected: XXXX-XXX-XXXXXXXXX-XX",
    };
  }

  return { isValid: true };
};

/**
 * Validate Member ID / Card Number
 * Alphanumeric, 6-30 characters
 */
export const validateMemberId = (memberId: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!memberId || memberId.trim() === "") {
    return { isValid: false, error: "Member ID is required" };
  }

  const sanitized = memberId.trim();

  // Check length
  if (sanitized.length < 6) {
    return {
      isValid: false,
      error: "Member ID must be at least 6 characters",
    };
  }

  if (sanitized.length > 30) {
    return {
      isValid: false,
      error: "Member ID must not exceed 30 characters",
    };
  }

  // Check if contains valid characters (alphanumeric, dashes, underscores)
  if (!/^[A-Za-z0-9\-_]+$/.test(sanitized)) {
    return {
      isValid: false,
      error: "Member ID must contain only letters, numbers, dashes, and underscores",
    };
  }

  return { isValid: true };
};

/**
 * Validate Policy Number
 * Alphanumeric, 5-30 characters
 */
export const validatePolicyNumber = (policyNumber: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!policyNumber || policyNumber.trim() === "") {
    return { isValid: false, error: "Policy Number is required" };
  }

  const sanitized = policyNumber.trim();

  // Check length
  if (sanitized.length < 5) {
    return {
      isValid: false,
      error: "Policy Number must be at least 5 characters",
    };
  }

  if (sanitized.length > 30) {
    return {
      isValid: false,
      error: "Policy Number must not exceed 30 characters",
    };
  }

  // Check if contains valid characters
  if (!/^[A-Za-z0-9\-_\/]+$/.test(sanitized)) {
    return {
      isValid: false,
      error: "Policy Number contains invalid characters",
    };
  }

  return { isValid: true };
};

/**
 * Validate Passport Number
 * Alphanumeric, 6-15 characters
 */
export const validatePassport = (passport: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!passport || passport.trim() === "") {
    return { isValid: false, error: "Passport number is required" };
  }

  const sanitized = passport.trim().toUpperCase();

  // Check length
  if (sanitized.length < 6 || sanitized.length > 15) {
    return {
      isValid: false,
      error: "Passport number must be between 6 and 15 characters",
    };
  }

  // Check if contains valid characters
  if (!/^[A-Z0-9]+$/.test(sanitized)) {
    return {
      isValid: false,
      error: "Passport number must contain only letters and numbers",
    };
  }

  return { isValid: true };
};

/**
 * Validate Name
 * Letters, spaces, and common name characters only
 */
export const validateName = (name: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!name || name.trim() === "") {
    return { isValid: false, error: "Name is required" };
  }

  const sanitized = name.trim();

  // Check length
  if (sanitized.length < 2) {
    return { isValid: false, error: "Name must be at least 2 characters" };
  }

  if (sanitized.length > 100) {
    return { isValid: false, error: "Name must not exceed 100 characters" };
  }

  // Check if contains valid characters (letters, spaces, hyphens, apostrophes, periods)
  if (!/^[A-Za-z\s\-'.]+$/.test(sanitized)) {
    return {
      isValid: false,
      error: "Name contains invalid characters",
    };
  }

  // Check if name has at least one letter
  if (!/[A-Za-z]/.test(sanitized)) {
    return { isValid: false, error: "Name must contain at least one letter" };
  }

  // Check for consecutive special characters
  if (/[\-'.]{2,}/.test(sanitized)) {
    return {
      isValid: false,
      error: "Name contains consecutive special characters",
    };
  }

  return { isValid: true };
};

/**
 * Validate Phone Number (UAE format)
 * Supports various formats: 971XXXXXXXXX, 05XXXXXXXX, etc.
 */
export const validatePhoneNumber = (phone: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!phone || phone.trim() === "") {
    return { isValid: false, error: "Phone number is required" };
  }

  const sanitized = phone.replace(/[\s\-()]/g, ""); // Remove formatting

  // Check if contains only digits and + (for country code)
  if (!/^[\d+]+$/.test(sanitized)) {
    return {
      isValid: false,
      error: "Phone number must contain only digits",
    };
  }

  // Remove + if present
  const digitsOnly = sanitized.replace(/\+/g, "");

  // Check length (UAE numbers)
  if (digitsOnly.length < 9 || digitsOnly.length > 15) {
    return {
      isValid: false,
      error: "Invalid phone number length",
    };
  }

  // Validate UAE mobile patterns
  const uaePatterns = [
    /^971(50|52|54|55|56|57|58)\d{7}$/, // UAE mobile with country code
    /^(50|52|54|55|56|57|58)\d{7}$/, // UAE mobile without country code
    /^0(50|52|54|55|56|57|58)\d{7}$/, // UAE mobile with leading 0
  ];

  const isValidUAE = uaePatterns.some((pattern) => pattern.test(digitsOnly));

  if (!isValidUAE && digitsOnly.length < 12) {
    return {
      isValid: false,
      error: "Invalid UAE phone number format",
    };
  }

  return { isValid: true };
};

/**
 * Validate UAE Mobile Code (50, 52, 54, 55, 56, 57, 58)
 */
export const validateUAEMobileCode = (code: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!code || code.trim() === "") {
    return { isValid: false, error: "Mobile code is required" };
  }

  const validCodes = ["50", "52", "54", "55", "56", "57", "58"];

  if (!validCodes.includes(code)) {
    return {
      isValid: false,
      error: "Invalid UAE mobile code",
    };
  }

  return { isValid: true };
};

/**
 * Validate UAE Mobile Suffix (7 digits)
 */
export const validateUAEMobileSuffix = (suffix: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!suffix || suffix.trim() === "") {
    return { isValid: false, error: "Mobile number is required" };
  }

  const digitsOnly = suffix.replace(/\D/g, "");

  if (digitsOnly.length !== 7) {
    return {
      isValid: false,
      error: `Mobile number must be exactly 7 digits (current: ${digitsOnly.length})`,
    };
  }

  return { isValid: true };
};

/**
 * Validate Doctor Name / DHA ID
 */
export const validateDoctorName = (doctorName: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!doctorName || doctorName.trim() === "") {
    return { isValid: false, error: "Doctor name is required" };
  }

  const sanitized = doctorName.trim();

  if (sanitized.length < 2) {
    return {
      isValid: false,
      error: "Doctor name must be at least 2 characters",
    };
  }

  return { isValid: true };
};

/**
 * Validate POD ID
 */
export const validatePodId = (podId: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!podId || podId.trim() === "") {
    return { isValid: false, error: "POD ID is required" };
  }

  const sanitized = podId.trim();

  if (sanitized.length < 3) {
    return { isValid: false, error: "POD ID must be at least 3 characters" };
  }

  if (sanitized.length > 50) {
    return { isValid: false, error: "POD ID must not exceed 50 characters" };
  }

  // Check if contains valid characters (alphanumeric and basic special chars)
  if (!/^[A-Za-z0-9\-_]+$/.test(sanitized)) {
    return {
      isValid: false,
      error: "POD ID contains invalid characters",
    };
  }

  return { isValid: true };
};

/**
 * Validate Referral Code
 */
export const validateReferralCode = (referralCode: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!referralCode || referralCode.trim() === "") {
    return { isValid: true }; // Optional field
  }

  const sanitized = referralCode.trim();

  if (sanitized.length > 50) {
    return {
      isValid: false,
      error: "Referral code must not exceed 50 characters",
    };
  }

  // Check if contains valid characters
  if (!/^[A-Za-z0-9\-_]+$/.test(sanitized)) {
    return {
      isValid: false,
      error: "Referral code contains invalid characters",
    };
  }

  return { isValid: true };
};

/**
 * Validate Visit Type
 */
export const validateVisitType = (visitType: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!visitType || visitType.trim() === "") {
    return { isValid: false, error: "Visit type is required" };
  }

  const validVisitTypes = [
    "OUTPATIENT",
    "EMERGENCY",
    "MATERNITY",
    "CHRONIC_OUT",
    "DENTAL",
  ];

  if (!validVisitTypes.includes(visitType)) {
    return { isValid: false, error: "Invalid visit type selected" };
  }

  return { isValid: true };
};

/**
 * Validate Visit Category
 */
export const validateVisitCategory = (visitCategory: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!visitCategory || visitCategory.trim() === "") {
    return { isValid: false, error: "Visit category is required" };
  }

  const validCategories = ["FIRST_VISIT", "VISIT_WITHOUT_REFERRAL"];

  if (!validCategories.includes(visitCategory)) {
    return { isValid: false, error: "Invalid visit category selected" };
  }

  return { isValid: true };
};

/**
 * Validate Maternity Type
 */
export const validateMaternityType = (maternityType: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!maternityType || maternityType.trim() === "") {
    return { isValid: false, error: "Maternity type is required" };
  }

  const validTypes = ["normal_delivery", "c_section", "prenatal", "postnatal"];

  if (!validTypes.includes(maternityType)) {
    return { isValid: false, error: "Invalid maternity type selected" };
  }

  return { isValid: true };
};

/**
 * Validate Payer Name
 */
export const validatePayerName = (payerName: string): {
  isValid: boolean;
  error?: string;
} => {
  if (!payerName || payerName.trim() === "") {
    return { isValid: false, error: "Payer name is required" };
  }

  const sanitized = payerName.trim();

  if (sanitized.length < 2) {
    return {
      isValid: false,
      error: "Payer name must be at least 2 characters",
    };
  }

  return { isValid: true };
};

// ============================================================================
// COMPOSITE VALIDATION
// ============================================================================

/**
 * Validate ID based on ID Type
 */
export const validateIdByType = (
  idValue: string,
  idType: string
): {
  isValid: boolean;
  error?: string;
} => {
  switch (idType) {
    case "EMIRATESID":
      return validateEmiratesId(idValue);
    case "DHAMEMBERID":
      return validateDhaMemberId(idValue);
    case "CARDNUMBER":
      return validateMemberId(idValue);
    case "POLICYNUMBER":
      return validatePolicyNumber(idValue);
    case "Passport":
      return validatePassport(idValue);
    default:
      return validateMemberId(idValue); // Fallback to member ID validation
  }
};

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format Emirates ID as XXX-XXXX-XXXXXXX-X
 */
export const formatEmiratesId = (input: string): string => {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 0) return "";

  let formatted = digits.slice(0, 3);
  if (digits.length > 3) {
    formatted += "-" + digits.slice(3, 7);
  }
  if (digits.length > 7) {
    formatted += "-" + digits.slice(7, 14);
  }
  if (digits.length > 14) {
    formatted += "-" + digits.slice(14, 15);
  }

  return formatted;
};

/**
 * Format DHA Member ID as XXXX-XXX-XXXXXXXXX-XX
 */
export const formatDhaMemberId = (input: string): string => {
  const alphanumeric = input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (alphanumeric.length === 0) return "";

  let formatted = alphanumeric.slice(0, 4);
  if (alphanumeric.length > 4) {
    formatted += "-" + alphanumeric.slice(4, 7);
  }
  if (alphanumeric.length > 7) {
    formatted += "-" + alphanumeric.slice(7, 16);
  }
  if (alphanumeric.length > 16) {
    formatted += "-" + alphanumeric.slice(16, 18);
  }

  return formatted;
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (input: string): string => {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 0) return "";

  // Format as 971-XX-XXXXXXX for UAE numbers
  if (digits.startsWith("971") && digits.length === 12) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  // Format as 0XX-XXX-XXXX for local numbers
  if (digits.startsWith("0") && digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return digits;
};
