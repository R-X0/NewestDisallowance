// server/routes/chatgpt-scraper.js

const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cheerio = require('cheerio');

// For openai@4.x+ in CommonJS, use default import:
const OpenAI = require('openai').default;

// Instantiate the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Use GPT to sanitize raw HTML from ChatGPT's page
 * Return only user messages, ChatGPT messages, and relevant links.
 */
async function sendToGPTForSanitization(rawHtml) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'o3-mini',
      messages: [
        {
          role: 'system',
          content: `You are a specialized assistant that extracts COVID-19 related government orders and regulations from ChatGPT conversations. 
          YOUR GOAL IS TO SANITIZE THE CONVERSATION FROM THE HTML/SERIALIZATION. RETURN THE ENTIRE CONVERSATION IN FULL CLEANED WITH ALL LINKS PROVIDED AS WELL`
        },
        {
          role: 'user',
          content: `Here is the entire HTML of a ChatGPT page discussing COVID-19 government orders.:
${rawHtml}`
        }
      ],
    });

    // Get GPT's cleaned-up text
    const cleanedText = response.choices[0].message.content.trim();
    return cleanedText;
  } catch (error) {
    console.error('Error calling OpenAI for sanitization:', error);
    
    // Fallback: basic HTML parsing with cheerio if OpenAI call fails
    try {
      const $ = cheerio.load(rawHtml);
      const messages = [];
      
      // Get all message elements (this selector may need updating based on ChatGPT's HTML structure)
      $('div[data-message]').each((i, el) => {
        const role = $(el).attr('data-message-author-role');
        const text = $(el).text().trim();
        
        if (text && (role === 'user' || role === 'assistant')) {
          messages.push(`${role === 'user' ? 'User:' : 'ChatGPT:'} ${text}`);
        }
      });
      
      return messages.join('\n\n');
    } catch (cheerioError) {
      console.error('Cheerio fallback also failed:', cheerioError);
      // Last resort: return raw HTML with tags stripped out
      return rawHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';
    }
  }
}

/**
 * Generate protest letter using OpenAI with example template
 */
async function generateERCProtestLetter(businessInfo, covidData, havenForHopeExample) {
  try {
    console.log('Generating protest letter using GPT...');
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'o3-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert in creating IRS Employee Retention Credit (ERC) protest letters. 
          Create a formal protest letter following the exact format and style of the example letter provided, 
          using the specific business information and COVID-19 research data provided.`
        },
        {
          role: 'user',
          content: `Please create an ERC protest letter using the following information:

BUSINESS INFORMATION:
Business Name: ${businessInfo.businessName}
EIN: ${businessInfo.ein}
Location: ${businessInfo.location}
Time Period: ${businessInfo.timePeriod}
Business Type: ${businessInfo.businessType || 'business'}

COVID-19 RESEARCH DATA FROM CHATGPT, THIS IS THE DATA THAT IS ACTUALLY RELAVENT TO OUR PROTEST LETTER:
${covidData}

FORMAT EXAMPLE (FOLLOW THIS EXACT FORMAT AND STYLE), MAKE SURE TO INCLUDE THE LINKS WE FOUND IN OUR RESEARCH DATA SIMILAR TO HOW ITS INCLUDED IN THE EXAMPLE:
${havenForHopeExample}

Create a comprehensive protest letter using the business information and COVID data above, following the exact format and structure of the example letter. Make it specific to the time period and location of the business. Use today's date: ${new Date().toLocaleDateString()}`
        }
      ],
    });
    
    const generatedLetter = response.choices[0].message.content.trim();
    console.log('Letter successfully generated');
    
    return generatedLetter;
  } catch (error) {
    console.error('Error generating protest letter:', error);
    throw new Error(`Failed to generate protest letter: ${error.message}`);
  }
}

// ----------------------------------------------------------------------------
// MAIN ROUTE
// ----------------------------------------------------------------------------

router.post('/process-chatgpt', async (req, res) => {
  try {
    const {
      chatGptLink,
      businessName,
      ein,
      location,
      timePeriod,
      businessType
    } = req.body;

    // Validate required inputs
    if (!chatGptLink) {
      return res.status(400).json({
        success: false,
        message: 'ChatGPT conversation link is required'
      });
    }
    
    if (!businessName || !ein || !timePeriod) {
      return res.status(400).json({
        success: false,
        message: 'Business name, EIN, and time period are required'
      });
    }

    console.log(`Processing ChatGPT link: ${chatGptLink}`);
    console.log(`Business: ${businessName}, Period: ${timePeriod}, Type: ${businessType || 'Not specified'}`);

    // Create unique directory for request
    const requestId = uuidv4().substring(0, 8);
    const outputDir = path.join(__dirname, `../../data/ChatGPT_Conversations/${requestId}`);
    await fs.mkdir(outputDir, { recursive: true });

    // Launch Puppeteer with robust error handling
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
        ],
      });

      console.log('Browser launched');
      const page = await browser.newPage();
      
      // Set longer timeouts for stability
      await page.setDefaultNavigationTimeout(90000);
      await page.setDefaultTimeout(60000);

      // Block non-essential resources for faster loading
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // Navigate with robust error handling
      console.log(`Navigating to: ${chatGptLink}`);
      try {
        await page.goto(chatGptLink, { 
          waitUntil: 'networkidle2',
          timeout: 60000 
        });
        console.log('Navigation complete (networkidle2)');
      } catch (navError) {
        console.error('Initial navigation error:', navError);
        try {
          console.log('Trying domcontentloaded instead');
          await page.goto(chatGptLink, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });
          console.log('Navigation complete (domcontentloaded)');
        } catch (secondNavError) {
          console.error('Second navigation error:', secondNavError);
          console.log('Trying with basic load');
          await page.goto(chatGptLink, { 
            waitUntil: 'load',
            timeout: 90000 
          });
          console.log('Basic navigation complete');
        }
      }

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 1) Grab the entire HTML
      const rawHTML = await page.content();
      console.log(`Raw HTML captured (${rawHTML.length} bytes)`);

      // 2) Send the full HTML to GPT for sanitization
      console.log('Sending to GPT for sanitization...');
      const conversationContent = await sendToGPTForSanitization(rawHTML);
      console.log(`Clean conversation length: ${conversationContent.length} chars`);

      // Save sanitized conversation
      await fs.writeFile(
        path.join(outputDir, 'conversation.txt'),
        conversationContent,
        'utf8'
      );

      // Take screenshot for reference
      try {
        await page.screenshot({
          path: path.join(outputDir, 'screenshot.png'),
          fullPage: true
        });
        console.log('Screenshot captured');
      } catch (screenshotError) {
        console.error('Screenshot error:', screenshotError);
      }

      // Close browser
      await browser.close();
      console.log('Browser closed');

      // Get the Haven for Hope example letter
      const havenForHopeExample = await fs.readFile(
        path.join(__dirname, '../templates/haven_for_hope_letter.txt'),
        'utf8'
      ).catch(async () => {
        // If the file doesn't exist, use the hard-coded example
        return;
      });

      // 3) Create business info object
      const businessInfo = {
        businessName,
        ein,
        location,
        timePeriod,
        businessType: businessType || 'business'
      };

      // 4) Generate protest letter using GPT with example
      const letter = await generateERCProtestLetter(
        businessInfo,
        conversationContent, // Pass the entire cleaned conversation as the COVID data
        havenForHopeExample
      );
      
      // Save the generated letter
      await fs.writeFile(
        path.join(outputDir, 'protest_letter.txt'),
        letter,
        'utf8'
      );

      // 5) Return JSON with all processed data
      res.status(200).json({
        success: true,
        letter,
        conversationContent,
        outputPath: outputDir
      });
      
    } catch (error) {
      console.error('Error during processing:', error);
      
      // Close browser if it's open
      if (browser) {
        try { 
          await browser.close();
          console.log('Browser closed after error');
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
      
      // Send error response
      res.status(500).json({
        success: false,
        message: `Error processing ChatGPT conversation: ${error.message}`
      });
    }
  } catch (outerError) {
    console.error('Outer error in route handler:', outerError);
    res.status(500).json({
      success: false,
      message: `Critical error in request processing: ${outerError.message}`
    });
  }
});

module.exports = router;