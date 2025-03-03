// server/middleware/static-forms.js

const express = require('express');
const path = require('path');
const fs = require('fs').promises;

/**
 * Middleware to serve static form templates
 */
const staticFormsMiddleware = async (app) => {
  // Create the forms directory if it doesn't exist
  const formsDir = path.join(__dirname, '../templates/forms');
  
  try {
    await fs.mkdir(formsDir, { recursive: true });
    console.log('Forms directory created:', formsDir);
    
    // Check for Form 2848 template
    const f2848Path = path.join(formsDir, 'f2848.pdf');
    try {
      await fs.access(f2848Path);
      console.log('Form 2848 template found at:', f2848Path);
    } catch (error) {
      console.warn('WARNING: Form 2848 template not found at', f2848Path);
      console.warn('Please download it from the IRS website: https://www.irs.gov/forms-pubs/about-form-2848');
      
      // Create a README file explaining how to add templates
      const readmePath = path.join(formsDir, 'README.txt');
      const message = `
Form 2848 Templates Directory

To enable Form 2848 generation, please add the IRS Form 2848 PDF template to this directory.
You can download the latest version from the IRS website at:
https://www.irs.gov/forms-pubs/about-form-2848

Save the file as "f2848.pdf" in this directory.
      `;
      
      await fs.writeFile(readmePath, message);
      console.log('Created README file for forms directory');
    }
  } catch (error) {
    console.error('Error setting up forms directory:', error);
  }
  
  // Direct route to serve the PDF file with proper headers
  app.get('/api/erc-protest/templates/f2848.pdf', async (req, res) => {
    const filePath = path.join(__dirname, '../templates/forms/f2848.pdf');
    
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Set content type explicitly
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="f2848.pdf"');
      
      // Send file
      res.sendFile(filePath);
      console.log(`Serving PDF file from ${filePath}`);
    } catch (error) {
      console.error(`Error serving PDF file: ${error.message}`);
      res.status(404).json({
        success: false,
        message: 'Form 2848 template not found. Please place the PDF file in the server/templates/forms directory.'
      });
    }
  });
  
  // Also serve as static files as a fallback
  app.use('/api/erc-protest/templates', express.static(formsDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
      }
    }
  }));
  
  console.log('Static forms middleware initialized');
};

module.exports = staticFormsMiddleware;