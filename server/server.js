// server.js - Main server file for ERC Protest Generator

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const morgan = require('morgan');
const fs = require('fs').promises;
const ercProtestRouter = require('./routes/erc-protest');
const adminRouter = require('./routes/admin');
const { authenticateUser, adminOnly } = require('./middleware/auth');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Static files
app.use(express.static(path.join(__dirname, 'client/build')));

// API routes
app.use('/api/erc-protest', ercProtestRouter);
app.use('/api/erc-protest/admin', authenticateUser, adminOnly, adminRouter);

// Create necessary directories
async function createDirectories() {
  try {
    const directories = [
      path.join(__dirname, 'uploads/temp'),
      path.join(__dirname, 'data/ERC_Disallowances')
    ];
    
    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

// Front-end route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await createDirectories();
});

// auth.js - Authentication middleware
const authenticateUser = (req, res, next) => {
  // This is a simplified authentication middleware
  // In a production environment, you would use more robust authentication
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  // In a real implementation, you would verify the token
  // For this example, we're just checking if it matches the secret key
  if (token !== process.env.API_SECRET_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
  
  // For a real app, you would decode the token and set user info on req.user
  req.user = {
    isAdmin: true
  };
  
  next();
};

const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  next();
};

module.exports = {
  authenticateUser,
  adminOnly
};

// admin.js - Admin routes
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