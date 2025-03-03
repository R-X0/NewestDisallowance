// server/services/googleSheetsService.js
const { google } = require('googleapis');
const path = require('path');

class GoogleSheetsService {
  constructor() {
    this.initialized = false;
    this.sheets = null;
    
    // TEMPORARY FIX: Hardcoded spreadsheet ID
    // In production, this should come from process.env.GOOGLE_SHEET_ID
    this.spreadsheetId = '13zhAc2uKW5DOyW_LJuDiUxA7gV3rD_9yLFTveW9aRtM';
    
    console.log('GoogleSheetsService constructor - Using spreadsheetId:', this.spreadsheetId);
  }

  async initialize() {
    try {
      console.log('Initializing Google Sheets service...');
      
      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../config/google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      const client = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: client });
      
      // Double-check spreadsheet ID is set
      if (!this.spreadsheetId) {
        console.log('No spreadsheetId found in env vars, using hardcoded value');
        this.spreadsheetId = '13zhAc2uKW5DOyW_LJuDiUxA7gV3rD_9yLFTveW9aRtM';
      }
      
      this.initialized = true;
      console.log('Google Sheets service initialized successfully with spreadsheetId:', this.spreadsheetId);
    } catch (error) {
      console.error('Failed to initialize Google Sheets service:', error);
      throw error;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async addSubmission(submissionData) {
    await this.ensureInitialized();
    
    const {
      trackingId,
      businessName,
      timePeriod,
      status = 'Gathering data',
      timestamp = new Date().toISOString(),
      protestLetterPath = '',
      zipPath = '',
      trackingNumber = '',
      googleDriveLink = ''
    } = submissionData;

    try {
      console.log('Adding submission to Google Sheet with ID:', this.spreadsheetId);
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'ERC Tracking!A:I', // Added an extra column for Google Drive link
        valueInputOption: 'RAW',
        resource: {
          values: [
            [
              trackingId,
              businessName,
              timePeriod,
              status,
              timestamp,
              protestLetterPath,
              zipPath,
              trackingNumber,
              googleDriveLink // Add the Google Drive link
            ]
          ]
        }
      });

      console.log('Added submission to Google Sheet:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error adding submission to Google Sheet:', error);
      
      // Retry once with sheet initialization
      try {
        console.log('Retrying with sheet initialization...');
        await this.initialize();
        
        const response = await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: 'ERC Tracking!A:I', // Added an extra column for Google Drive link
          valueInputOption: 'RAW',
          resource: {
            values: [
              [
                trackingId,
                businessName,
                timePeriod,
                status,
                timestamp,
                protestLetterPath,
                zipPath,
                trackingNumber,
                googleDriveLink // Add the Google Drive link
              ]
            ]
          }
        });
        
        console.log('Added submission to Google Sheet on retry:', response.data);
        return response.data;
      } catch (retryError) {
        console.error('Error adding submission to Google Sheet after retry:', retryError);
        throw retryError;
      }
    }
  }

  async updateSubmission(trackingId, updateData) {
    await this.ensureInitialized();
    
    try {
      // First, find the row with the matching tracking ID
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'ERC Tracking!A:A',
      });
      
      const rows = response.data.values || [];
      let rowIndex = -1;
      
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === trackingId) {
          rowIndex = i + 1; // +1 because sheets are 1-indexed
          break;
        }
      }
      
      if (rowIndex === -1) {
        throw new Error(`Submission with tracking ID ${trackingId} not found`);
      }
      
      // Now we know which row to update
      const {
        status,
        timestamp = new Date().toISOString(),
        protestLetterPath,
        zipPath,
        trackingNumber,
        googleDriveLink
      } = updateData;
      
      // Create update data, only including fields that are provided
      const updateValues = [];
      
      if (status !== undefined) {
        // Status is in column D (index 3)
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `ERC Tracking!D${rowIndex}`,
          valueInputOption: 'RAW',
          resource: { values: [[status]] },
        });
      }
      
      // Always update timestamp
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `ERC Tracking!E${rowIndex}`,
        valueInputOption: 'RAW',
        resource: { values: [[timestamp]] },
      });
      
      if (protestLetterPath !== undefined) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `ERC Tracking!F${rowIndex}`,
          valueInputOption: 'RAW',
          resource: { values: [[protestLetterPath]] },
        });
      }
      
      if (zipPath !== undefined) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `ERC Tracking!G${rowIndex}`,
          valueInputOption: 'RAW',
          resource: { values: [[zipPath]] },
        });
      }
      
      if (trackingNumber !== undefined) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `ERC Tracking!H${rowIndex}`,
          valueInputOption: 'RAW',
          resource: { values: [[trackingNumber]] },
        });
      }
      
      if (googleDriveLink !== undefined) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `ERC Tracking!I${rowIndex}`,
          valueInputOption: 'RAW',
          resource: { values: [[googleDriveLink]] },
        });
      }
      
      console.log(`Updated submission ${trackingId} in Google Sheet`);
      return { success: true, rowIndex };
    } catch (error) {
      console.error(`Error updating submission ${trackingId} in Google Sheet:`, error);
      throw error;
    }
  }

  async getAllSubmissions() {
    await this.ensureInitialized();
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'ERC Tracking!A2:I', // Updated to include Google Drive link
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
        trackingNumber: row[7] || '',
        googleDriveLink: row[8] || '' // Google Drive folder link
      }));
      
      return submissions;
    } catch (error) {
      console.error('Error fetching submissions from Google Sheet:', error);
      throw error;
    }
  }
}

// Singleton instance
const sheetsService = new GoogleSheetsService();

module.exports = sheetsService;