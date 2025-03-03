// server/services/googleSheetsService.js
const { google } = require('googleapis');
const path = require('path');

class GoogleSheetsService {
  constructor() {
    this.initialized = false;
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
  }

  async initialize() {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '../config/google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      const client = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: client });
      this.initialized = true;
      console.log('Google Sheets service initialized');
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
    
    if (!this.spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID environment variable is not set');
    }

    const {
      trackingId,
      businessName,
      timePeriod,
      status = 'Gathering data',
      timestamp = new Date().toISOString(),
      protestLetterPath = '',
      zipPath = '',
      trackingNumber = ''
    } = submissionData;

    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'ERC Tracking!A:H',
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
              trackingNumber
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
        await this.initialize();
        
        const response = await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: 'ERC Tracking!A:H',
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
                trackingNumber
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
    
    if (!this.spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID environment variable is not set');
    }

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
        trackingNumber
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
      
      console.log(`Updated submission ${trackingId} in Google Sheet`);
      return { success: true, rowIndex };
    } catch (error) {
      console.error(`Error updating submission ${trackingId} in Google Sheet:`, error);
      throw error;
    }
  }

  async getAllSubmissions() {
    await this.ensureInitialized();
    
    if (!this.spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID environment variable is not set');
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
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