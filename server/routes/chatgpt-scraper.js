// server/routes/chatgpt-scraper.js

const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Process a ChatGPT conversation link
 * - Extracts conversation content
 * - Identifies sources/links
 * - Downloads linked pages as PDFs
 * - Returns processed content and attachment info
 */
router.post('/process-chatgpt', async (req, res) => {
  try {
    const { chatGptLink, trackingId } = req.body;
    
    if (!chatGptLink) {
      return res.status(400).json({
        success: false,
        message: 'ChatGPT conversation link is required'
      });
    }
    
    // Create directory for attachments
    const submissionDir = path.join(__dirname, `../data/ERC_Disallowances/${trackingId}`);
    const attachmentsDir = path.join(submissionDir, 'attachments');
    await fs.mkdir(attachmentsDir, { recursive: true });
    
    // Launch browser to scrape ChatGPT conversation
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Navigate to the ChatGPT conversation
    await page.goto(chatGptLink, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for the conversation content to load
    // Note: This is a simplified example, actual implementation would need to handle authentication, etc.
    await page.waitForSelector('.markdown-content', { timeout: 30000 });
    
    // Extract the conversation content
    const conversationContent = await page.evaluate(() => {
      // Get the last assistant message (assuming it contains the COVID research)
      const messages = document.querySelectorAll('.markdown-content');
      return messages[messages.length - 1].innerText;
    });
    
    // Extract URLs from the conversation
    const urls = await page.evaluate(() => {
      const links = document.querySelectorAll('.markdown-content a');
      return Array.from(links).map(link => ({
        url: link.href,
        text: link.innerText
      }));
    });
    
    // Close the browser
    await browser.close();
    
    // Filter for relevant links (COVID orders, government sites, etc.)
    const relevantUrls = urls.filter(link => {
      const url = link.url.toLowerCase();
      const text = link.text.toLowerCase();
      
      return (
        url.includes('gov') || 
        url.includes('covid') || 
        url.includes('order') || 
        url.includes('health') ||
        text.includes('order') || 
        text.includes('directive') ||
        text.includes('covid')
      );
    });
    
    // Download and convert each relevant URL to PDF
    const attachments = [];
    
    for (let i = 0; i < relevantUrls.length; i++) {
      const link = relevantUrls[i];
      try {
        // Create a new browser for each PDF to avoid memory issues
        const pdfBrowser = await puppeteer.launch({ headless: 'new' });
        const pdfPage = await pdfBrowser.newPage();
        
        // Navigate to the URL
        await pdfPage.goto(link.url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Generate a filename
        const filename = `attachment_${i+1}_${sanitizeFilename(link.text)}.pdf`;
        const pdfPath = path.join(attachmentsDir, filename);
        
        // Generate PDF
        await pdfPage.pdf({ 
          path: pdfPath,
          format: 'A4',
          printBackground: true
        });
        
        // Close browser
        await pdfBrowser.close();
        
        // Add to attachments list
        attachments.push({
          title: link.text,
          path: pdfPath,
          originalUrl: link.url
        });
      } catch (error) {
        console.error(`Error processing URL ${link.url}:`, error);
        // Continue with other URLs even if one fails
      }
    }
    
    // Return the processed data
    res.status(200).json({
      success: true,
      conversationContent,
      attachments,
      message: 'ChatGPT conversation processed successfully'
    });
  } catch (error) {
    console.error('Error processing ChatGPT conversation:', error);
    res.status(500).json({
      success: false,
      message: `Error processing ChatGPT conversation: ${error.message}`
    });
  }
});

// Helper function to sanitize filenames
function sanitizeFilename(input) {
  // Replace invalid characters with underscores
  const sanitized = input
    .substring(0, 50) // Limit length
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .trim();
  
  return sanitized || 'document';
}

module.exports = router;