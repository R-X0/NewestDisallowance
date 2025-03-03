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
    
    // Create a README file if the directory is empty
    const files = await fs.readdir(formsDir);
    if (files.length === 0 || !files.includes('f2848.pdf')) {
      console.log('No Form 2848 template found, creating placeholder README');
      
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
  
  // Serve the forms directory as static files
  app.use('/api/erc-protest/templates', express.static(formsDir));
  
  console.log('Static forms middleware initialized');
};

module.exports = staticFormsMiddleware;