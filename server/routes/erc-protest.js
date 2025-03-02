const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Set up file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/temp'));
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    cb(null, `${uniqueId}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Submit ERC protest information
router.post('/submit', upload.array('disallowanceNotices', 5), async (req, res) => {
  try {
    const {
      businessName,
      ein,
      location,
      businessWebsite,
      naicsCode,
      timePeriod,
      additionalInfo,
      disallowanceReasons
    } = req.body;
    
    // Validate required fields
    if (!businessName || !ein || !timePeriod) {
      return res.status(400).json({
        success: false,
        message: 'Business name, EIN, and time period are required'
      });
    }
    
    // Generate tracking ID
    const trackingId = uuidv4().substring(0, 8).toUpperCase();
    
    // Create directory for this submission
    const submissionDir = path.join(__dirname, `../data/ERC_Disallowances/${trackingId}`);
    await fs.mkdir(submissionDir, { recursive: true });
    
    // Save uploaded files to submission directory
    const uploadedFiles = req.files || [];
    const fileInfo = [];
    
    for (const file of uploadedFiles) {
      const destPath = path.join(submissionDir, file.filename);
      await fs.copyFile(file.path, destPath);
      await fs.unlink(file.path); // Remove from temp
      
      fileInfo.push({
        originalName: file.originalname,
        path: destPath
      });
    }
    
    // Save submission data
    const submissionData = {
      trackingId,
      businessName,
      ein,
      location,
      businessWebsite,
      naicsCode,
      timePeriod,
      additionalInfo,
      disallowanceReasons,
      files: fileInfo,
      status: 'Gathering data',
      timestamp: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(submissionDir, 'submission-data.json'),
      JSON.stringify(submissionData, null, 2)
    );
    
    // Return success response
    res.status(201).json({
      success: true,
      message: 'Submission received and being processed',
      trackingId
    });
  } catch (error) {
    console.error('Error submitting ERC protest:', error);
    res.status(500).json({
      success: false,
      message: `Error processing submission: ${error.message}`
    });
  }
});

module.exports = router;