// server/routes/erc-protest.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { google } = require('googleapis');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/temp'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Submit ERC protest form
router.post('/submit', upload.array('disallowanceNotices', 5), async (req, res) => {
  try {
    const { businessName, ein, location, businessWebsite, naicsCode, timePeriod, additionalInfo } = req.body;
    const files = req.files;
    
    // Generate tracking ID
    const trackingId = `ERC-${uuidv4().substring(0, 8).toUpperCase()}`;
    
    // Create directory for this submission
    const submissionDir = path.join(__dirname, `../data/ERC_Disallowances/${trackingId}`);
    await fs.mkdir(submissionDir, { recursive: true });
    
    // Move uploaded files to submission directory
    const fileInfo = [];
    for (const file of files) {
      const newPath = path.join(submissionDir, file.originalname);
      await fs.rename(file.path, newPath);
      fileInfo.push({
        originalName: file.originalname,
        path: newPath,
        mimetype: file.mimetype,
        size: file.size
      });
    }
    
    // Save submission info
    const submissionInfo = {
      trackingId,
      businessName,
      ein,
      location,
      businessWebsite,
      naicsCode,
      timePeriod,
      additionalInfo,
      files: fileInfo,
      timestamp: new Date().toISOString(),
      status: 'Gathering data'
    };
    
    await fs.writeFile(
      path.join(submissionDir, 'submission_info.json'),
      JSON.stringify(submissionInfo, null, 2)
    );
    
    // Add to Google Sheet for tracking
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../config/google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      const client = await auth.getClient();
      const sheets = google.sheets({ version: 'v4', auth: client });
      
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'ERC Tracking!A:D',
        valueInputOption: 'RAW',
        resource: {
          values: [
            [
              trackingId,
              businessName,
              timePeriod,
              'Gathering data',
              new Date().toISOString()
            ]
          ]
        }
      });
      
      console.log('Added submission to Google Sheet');
    } catch (sheetError) {
      console.error('Error adding to Google Sheet:', sheetError);
      // Continue anyway, not a critical error
    }
    
    res.status(201).json({
      success: true,
      message: 'Submission received successfully',
      trackingId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing submission:', error);
    res.status(500).json({
      success: false,
      message: `Error processing submission: ${error.message}`
    });
  }
});

// Get submission status
router.get('/status/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    if (!trackingId) {
      return res.status(400).json({
        success: false,
        message: 'Tracking ID is required'
      });
    }
    
    // Look up submission status
    try {
      const submissionPath = path.join(__dirname, `../data/ERC_Disallowances/${trackingId}/submission_info.json`);
      const submissionData = await fs.readFile(submissionPath, 'utf8');
      const submissionInfo = JSON.parse(submissionData);
      
      res.status(200).json({
        success: true,
        status: submissionInfo.status,
        timestamp: submissionInfo.timestamp,
        businessName: submissionInfo.businessName,
        timePeriod: submissionInfo.timePeriod
      });
    } catch (err) {
      // If file doesn't exist, check Google Sheet
      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: path.join(__dirname, '../config/google-credentials.json'),
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'ERC Tracking!A:E',
        });
        
        const rows = response.data.values;
        const submissionRow = rows.find(row => row[0] === trackingId);
        
        if (submissionRow) {
          res.status(200).json({
            success: true,
            status: submissionRow[3],
            timestamp: submissionRow[4],
            businessName: submissionRow[1],
            timePeriod: submissionRow[2]
          });
        } else {
          res.status(404).json({
            success: false,
            message: 'Submission not found'
          });
        }
      } catch (sheetError) {
        console.error('Error checking Google Sheet:', sheetError);
        res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }
    }
  } catch (error) {
    console.error('Error fetching submission status:', error);
    res.status(500).json({
      success: false,
      message: `Error fetching submission status: ${error.message}`
    });
  }
});

module.exports = router;