const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { google } = require('googleapis');

const router = express.Router();

// Get all submissions
router.get('/submissions', async (req, res) => {
  try {
    // Get data from Google Sheets (admin dashboard)
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '../config/google-credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'ERC Tracking!A2:H',
    });
    
    const rows = response.data.values || [];
    
    const submissions = rows.map(row => ({
      trackingId: row[0] || '',
      businessName: row[1] || '',
      timePeriod: row[2] || '',
      status: row[3] || '',
      timestamp: row[4] || '',
      protestLetterPath: row[5] || '',
      zipPath: row[6] || '',
      trackingNumber: row[7] || ''
    }));
    
    res.status(200).json({
      success: true,
      submissions
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      message: `Error fetching submissions: ${error.message}`
    });
  }
});

// Update tracking number
router.post('/update-tracking', async (req, res) => {
  try {
    const { submissionId, trackingNumber, status } = req.body;
    
    if (!submissionId || !trackingNumber) {
      return res.status(400).json({
        success: false,
        message: 'Submission ID and tracking number are required'
      });
    }
    
    // Update Google Sheets
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '../config/google-credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    // Find the row with the matching tracking ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'ERC Tracking!A2:A',
    });
    
    const rows = response.data.values || [];
    let rowIndex = -1;
    
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === submissionId) {
        rowIndex = i + 2; // +2 because we start at row 2 and array index starts at 0
        break;
      }
    }
    
    if (rowIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    
    // Update tracking number and status
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `ERC Tracking!D${rowIndex}:H${rowIndex}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[
          status || 'mailed',
          new Date().toISOString(),
          '', // Keep existing path
          '', // Keep existing path
          trackingNumber
        ]]
      },
    });
    
    res.status(200).json({
      success: true,
      message: 'Tracking number updated successfully'
    });
  } catch (error) {
    console.error('Error updating tracking number:', error);
    res.status(500).json({
      success: false,
      message: `Error updating tracking number: ${error.message}`
    });
  }
});

// Download file
router.get('/download', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Send file
    res.download(filePath);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      message: `Error downloading file: ${error.message}`
    });
  }
});

module.exports = router;