// server/routes/forms.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Serve the Form 2848 template
router.get('/templates/f2848.pdf', async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../templates/forms/f2848.pdf');
    
    // Check if file exists
    try {
      await fs.access(templatePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Form 2848 template not found'
      });
    }
    
    // Send the PDF template
    res.sendFile(templatePath);
  } catch (error) {
    console.error('Error serving Form 2848 template:', error);
    res.status(500).json({
      success: false,
      message: `Error serving template: ${error.message}`
    });
  }
});

// Generate filled Form 2848
router.post('/generate-form-2848', async (req, res) => {
  try {
    const {
      businessName,
      ein,
      location,
      timePeriod,
      representativeName,
      representativeTitle,
      representativeAddress,
      representativePhone,
      representativeCAF,
      representativePTIN,
      taxMatters,
      taxForm,
      taxYears,
      taxQuarters
    } = req.body;
    
    // Validation
    if (!businessName || !ein || !representativeName || !representativeAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // In a production environment, you would use a PDF library like pdf-lib
    // to fill the form here on the server side
    // For this example, we'll just return success and let the client handle it

    res.status(200).json({
      success: true,
      message: 'Form data received successfully',
      // You could return the path to a generated PDF if implemented on server
    });
  } catch (error) {
    console.error('Error generating Form 2848:', error);
    res.status(500).json({
      success: false,
      message: `Error generating form: ${error.message}`
    });
  }
});

module.exports = router;