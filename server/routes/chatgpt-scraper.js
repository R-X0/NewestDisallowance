// server/routes/chatgpt-scraper.js

const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cheerio = require('cheerio');

/**
 * Process a ChatGPT conversation link
 * - Extracts conversation content
 * - Identifies COVID-related information
 * - Returns processed content for ERC protest letter generation
 */
router.post('/process-chatgpt', async (req, res) => {
  try {
    const { chatGptLink, businessName, ein, location, timePeriod, businessType } = req.body;
    
    if (!chatGptLink) {
      return res.status(400).json({
        success: false,
        message: 'ChatGPT conversation link is required'
      });
    }

    console.log(`Starting to process ChatGPT link: ${chatGptLink}`);
    
    // Create a unique ID for this request
    const requestId = uuidv4().substring(0, 8);
    
    // Create directory for any downloaded attachments
    const outputDir = path.join(__dirname, `../../data/ChatGPT_Conversations/${requestId}`);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Launch browser to scrape ChatGPT conversation
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    
    // Set a reasonable viewport size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set a longer timeout for navigation
    await page.setDefaultNavigationTimeout(60000);
    
    // Enable request interception to speed up page load
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Block images, fonts, and stylesheets to speed up loading
      if (['image', 'font', 'stylesheet'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    console.log(`Navigating to ChatGPT link: ${chatGptLink}`);
    
    try {
      // Navigate to the ChatGPT conversation
      await page.goto(chatGptLink, { waitUntil: 'networkidle2' });
      console.log('Navigation completed');
    } catch (navError) {
      console.error('Navigation error:', navError);
      
      // If navigation times out, try waiting for the DOM to be ready
      console.log('Attempting to navigate with domcontentloaded instead');
      await page.goto(chatGptLink, { waitUntil: 'domcontentloaded' });
    }
    
    // Wait for page content to load and stabilize
    // Replace waitForTimeout with standard setTimeout
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the page HTML for further processing
    const html = await page.content();
    
    console.log('Page content retrieved, attempting to extract conversation');
    
    // Try various selectors to find the conversation content
    let conversationContent = '';
    
    // First try the standard ChatGPT selectors
    try {
      // Try to find all message content
      const messages = await page.$$eval(
        '.markdown-content, .text-message, .prose, [data-message-content], .text-base',
        elements => elements.map(el => el.innerText.trim())
      );
      
      conversationContent = messages.join('\n\n');
      console.log(`Found ${messages.length} messages using standard selectors`);
    } catch (selectorError) {
      console.error('Error with standard selectors:', selectorError);
    }
    
    // If standard selectors fail, try a more general approach
    if (!conversationContent.trim()) {
      console.log('Standard selectors failed, trying alternative approach');
      
      // Use cheerio to parse the HTML for more flexible extraction
      const $ = cheerio.load(html);
      
      // Look for various potential selectors
      $('[class*="message"], [class*="content"], [class*="markdown"], [class*="prose"]').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 100) { // Likely a content block if it has substantial text
          conversationContent += text + '\n\n';
        }
      });
      
      console.log('Used alternative extraction approach');
    }
    
    // Last resort: capture all paragraph text
    if (!conversationContent.trim()) {
      console.log('All selective approaches failed, capturing all paragraph text');
      
      try {
        const paragraphs = await page.$$eval('p, div, span', 
          elements => elements
            .filter(el => el.innerText && el.innerText.trim().length > 50)
            .map(el => el.innerText.trim())
        );
        
        conversationContent = paragraphs.join('\n\n');
      } catch (fallbackError) {
        console.error('Error with fallback approach:', fallbackError);
      }
    }
    
    // Save the full conversation text for debugging
    await fs.writeFile(
      path.join(outputDir, 'conversation.txt'), 
      conversationContent, 
      'utf8'
    );
    
    console.log(`Conversation content length: ${conversationContent.length} characters`);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: path.join(outputDir, 'screenshot.png') });
    
    // Extract COVID-related orders or information from the conversation
    let covidOrders = extractCovidOrders(conversationContent);
    
    // Close the browser
    await browser.close();
    console.log('Browser closed');
    
    // Save extracted COVID orders for reference
    await fs.writeFile(
      path.join(outputDir, 'covid_orders.txt'), 
      covidOrders.join('\n\n'), 
      'utf8'
    );
    
    // Generate a protest letter using the extracted content
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Format the extracted orders into a readable format
    const formattedOrders = formatCovidOrders(covidOrders);
    
    // Generate the protest letter
    const letter = generateProtestLetter(
      businessName,
      ein,
      location,
      timePeriod,
      businessType || 'business',
      formattedOrders,
      currentDate
    );
    
    console.log('Successfully generated protest letter');
    
    // Return success with the letter and conversation content
    res.status(200).json({
      success: true,
      letter,
      conversationContent,
      extractedOrders: covidOrders
    });
    
  } catch (error) {
    console.error('Error processing ChatGPT conversation:', error);
    res.status(500).json({
      success: false,
      message: `Error processing ChatGPT conversation: ${error.message}`
    });
  }
});

/**
 * Extract COVID-related orders from conversation text
 */
function extractCovidOrders(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Split into paragraphs/sections
  const paragraphs = text.split(/\n\n+/);
  
  // Patterns to identify COVID-related orders
  const orderPatterns = [
    // Executive orders
    /(?:Executive Order|Order No\.)[^.]*(?:COVID|coronavirus|pandemic|emergency|closure|restriction)[^.]*\./gi,
    
    // Health department orders
    /(?:Public Health|Health Department|Department of Health)[^.]*(?:order|directive|mandate|guidance)[^.]*\./gi,
    
    // Specific orders with dates or numbers
    /(?:Order|Directive|Proclamation) (?:No\. |Number |#)?[A-Z0-9-]+[^.]*\./gi,
    
    // Emergency declarations
    /(?:State of Emergency|Emergency Declaration|Emergency Order)[^.]*\./gi,
    
    // COVID-specific language
    /(?:COVID-19|coronavirus) (?:restriction|requirement|mandate|order|directive)[^.]*\./gi
  ];
  
  const orders = [];
  
  // Process each paragraph
  paragraphs.forEach(paragraph => {
    // Skip very short paragraphs
    if (paragraph.length < 40) return;
    
    // Check if paragraph mentions COVID and orders
    const isRelevant = 
      /(?:COVID|coronavirus|pandemic|emergency|closure|restriction)/i.test(paragraph) &&
      /(?:order|directive|mandate|proclamation|restriction|guidance)/i.test(paragraph);
    
    if (isRelevant) {
      // Apply each pattern to extract specific order references
      for (const pattern of orderPatterns) {
        const matches = paragraph.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Only add if not already included and not too short
            if (!orders.includes(match) && match.length > 30) {
              orders.push(match);
            }
          });
        }
      }
      
      // If no specific orders were matched but paragraph is relevant, 
      // include the whole paragraph if it's reasonably sized
      if (orders.length === 0 && paragraph.length < 500) {
        orders.push(paragraph);
      }
    }
  });
  
  // Deduplicate and limit to most relevant orders
  const uniqueOrders = [...new Set(orders)];
  return uniqueOrders.slice(0, 10); // Limit to top 10 most relevant
}

/**
 * Format COVID orders for inclusion in the protest letter
 */
function formatCovidOrders(orders) {
  if (!orders || orders.length === 0) {
    return "Based on the research, multiple government orders were in effect during the time period in question that significantly impacted business operations. These orders included capacity restrictions, social distancing requirements, and operational limitations that directly affected normal business functions.";
  }
  
  return orders
    .slice(0, 5) // Limit to top 5 for readability
    .map((order, index) => `${index + 1}. ${order.trim()}`)
    .join('\n\n');
}

/**
 * Generate a protest letter using extracted information
 */
function generateProtestLetter(businessName, ein, location, timePeriod, businessType, covidOrders, currentDate) {
  return `${currentDate}

Internal Revenue Service
Ogden, UT 84201

Re: EIN ${ein} - Formal Protest of Employee Retention Credit (ERC) Disallowance
Taxpayer: ${businessName}
Tax Period: ${timePeriod}

To Whom It May Concern:

I am writing to formally protest the IRS's disallowance of ${businessName}'s Employee Retention Credit claim for ${timePeriod}. We believe the disallowance is in error as our business operations were partially suspended due to government orders related to COVID-19 during the relevant time period.

SUMMARY OF FACTS

${businessName} is a ${businessType} located in ${location}. During ${timePeriod}, our business was subject to numerous government orders related to COVID-19 that significantly limited our normal operations. These government-imposed restrictions had more than a nominal effect on our business and qualify us for the Employee Retention Credit under IRS Notice 2021-20.

RELEVANT GOVERNMENT ORDERS

Based on our research, the following government orders directly impacted our business operations during ${timePeriod}:

${covidOrders}

IMPACT ON BUSINESS OPERATIONS

These government orders significantly impacted our ability to operate in the normal course of business. Specifically:

1. We were limited in our capacity to serve customers/clients
2. We had to modify our physical workspace to comply with mandated social distancing requirements
3. Our hours of operation were affected by emergency orders and curfews
4. We had to implement costly safety procedures to comply with public health mandates

LEGAL ANALYSIS

According to IRS Notice 2021-20, a business is eligible for the Employee Retention Credit if its operations were fully or partially suspended due to a governmental order limiting commerce, travel, or group meetings due to COVID-19. A partial suspension occurs when "more than a nominal portion" of business operations are suspended by government order.

The impact on our business was clearly "more than nominal" as defined in IRS Notice 2021-20, Section III.C, Question 11, which states that a portion of business operations will be considered "more than nominal" if either:

1. The gross receipts from that portion of the business operations is not less than 10% of the total gross receipts, or
2. The hours of service performed by employees in that portion of the business is not less than 10% of the total number of hours of service.

TAX LAW AND AUTHORITIES

The Employee Retention Credit was established under Section 2301 of the Coronavirus Aid, Relief, and Economic Security Act (CARES Act) and was modified and extended under subsequent legislation. IRS Notice 2021-20 provides guidance on the ERC, including the criteria for "partial suspension" of business operations.

PROTEST REQUEST

Based on the facts and law presented above, we respectfully request that the IRS reverse its decision to disallow our ERC claim for ${timePeriod}. The government orders in effect during this period clearly caused a partial suspension of our business operations as defined in the relevant IRS guidance.

PENALTIES OF PERJURY STATEMENT

Under penalties of perjury, I declare that I have examined this protest, including accompanying documents, and to the best of my knowledge and belief, the facts presented are true, correct, and complete.

Respectfully submitted,

[Signature]

[Name]
[Title]
${businessName}
[Contact Information]

Attachments:
- Documentation of relevant government orders
- Evidence of business impact`;
}

module.exports = router;