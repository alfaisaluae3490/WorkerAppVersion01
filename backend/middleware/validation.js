// backend/middleware/validation.js
const validator = require('validator');

// Validate signup data
const validateSignup = (req, res, next) => {
  const { email, phone, password, full_name } = req.body;
  const errors = [];

  // Email validation
  if (!email || !validator.isEmail(email)) {
    errors.push('Valid email is required');
  }

  // Phone validation (basic)
  if (!phone || phone.length < 10) {
    errors.push('Valid phone number is required (min 10 digits)');
  }

  // Password validation
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  // Full name validation
  if (!full_name || full_name.trim().length < 2) {
    errors.push('Full name is required (min 2 characters)');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// Validate login data
const validateLogin = (req, res, next) => {
  const { identifier, password } = req.body;
  const errors = [];

  if (!identifier) {
    errors.push('Email or phone is required');
  }

  if (!password) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// Validate OTP
const validateOTP = (req, res, next) => {
  const { phone, code } = req.body;
  const errors = [];

  if (!phone || phone.length < 10) {
    errors.push('Valid phone number is required');
  }

  if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
    errors.push('Valid 6-digit OTP code is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// Detect contact info in text (prevent sharing before booking)
const detectContactInfo = (text) => {
  if (!text) return false;

  // Phone patterns
  const phonePatterns = [
    /\b\d{10,}\b/, // 10+ digits
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // Phone formats
    /\+\d{1,3}[-.\s]?\d{9,}/, // International
  ];

  // Email pattern
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

  // Social media patterns
  const socialPatterns = [
    /\b(?:whatsapp|telegram|signal|viber|wechat)\b/i,
    /\b(?:facebook|instagram|twitter|snapchat)\b/i,
    /@\w+/i, // @username
  ];

  // Check phone
  for (let pattern of phonePatterns) {
    if (pattern.test(text)) return true;
  }

  // Check email
  if (emailPattern.test(text)) return true;

  // Check social
  for (let pattern of socialPatterns) {
    if (pattern.test(text)) return true;
  }

  return false;
};

// Validate job posting
const validateJobPost = (req, res, next) => {
  const { title, description, category_id, budget_min, location_address, city, province } = req.body;
  const errors = [];

  if (!title || title.trim().length < 5) {
    errors.push('Title is required (min 5 characters)');
  }

  if (!description || description.trim().length < 20) {
    errors.push('Description is required (min 20 characters)');
  }

  // Check for contact info in title/description
  if (detectContactInfo(title) || detectContactInfo(description)) {
    errors.push('Please do not include contact information (phone, email, social media) in job posts. You can share contact details after booking is confirmed.');
  }

  if (!category_id) {
    errors.push('Category is required');
  }

  if (!budget_min || budget_min < 0) {
    errors.push('Valid budget is required');
  }

  if (!location_address || location_address.trim().length < 5) {
    errors.push('Location address is required');
  }

  if (!city || city.trim().length < 2) {
    errors.push('City is required');
  }

  if (!province || province.trim().length < 2) {
    errors.push('Province/State is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

module.exports = {
  validateSignup,
  validateLogin,
  validateOTP,
  validateJobPost,
  detectContactInfo
};