// server/routes/chatgpt-scraper.js

const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// For openai@4.x+ in CommonJS, use default import:
const OpenAI = require('openai').default;

// Instantiate the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 1) Use GPT to sanitize raw HTML from ChatGPT's page
 *    - Return only user messages, ChatGPT messages, and relevant links.
 */
async function sendToGPTForSanitization(rawHtml) {
  try {
    const response = await openai.chat.completions.create({
      model: 'o3-mini', // or 'gpt-3.5-turbo', etc.
      messages: [
        {
          role: 'developer',
          content: `You are a helpful assistant that cleans up raw HTML from a ChatGPT page.
            Return only the user messages, ChatGPT messages, and relevant links.
            Remove extraneous HTML, scripts, or noise.`
        },
        {
          role: 'user',
          content: `Here is the entire HTML of the ChatGPT page. Please parse it and return only a clean transcript:
${rawHtml}`
        }
      ],
    });

    // Get GPT's cleaned-up text
    const cleanedText = response.choices[0].message.content.trim();
    return cleanedText;
  } catch (error) {
    console.error('Error calling OpenAI for sanitization:', error);
    // Fallback: return raw HTML if GPT fails
    return rawHtml || '';
  }
}

/**
 * 2) Extract COVID-related orders from the sanitized text
 */
function extractCovidOrders(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);
  
  // Patterns to identify COVID-related orders
  const orderPatterns = [
    /(?:Executive Order|Order No\.)[^.]*(?:COVID|coronavirus|pandemic|emergency|closure|restriction)[^.]*\./gi,
    /(?:Public Health|Health Department|Department of Health)[^.]*(?:order|directive|mandate|guidance)[^.]*\./gi,
    /(?:Order|Directive|Proclamation) (?:No\. |Number |#)?[A-Z0-9-]+[^.]*\./gi,
    /(?:State of Emergency|Emergency Declaration|Emergency Order)[^.]*\./gi,
    /(?:COVID-19|coronavirus) (?:restriction|requirement|mandate|order|directive)[^.]*\./gi,
    /(?:Blueprint|Reopening|Tier)[^.]*(?:COVID|coronavirus|pandemic|restriction)[^.]*\./gi,
    /Q3 2020[^.]*(?:COVID|coronavirus|pandemic|restriction)[^.]*\./gi
  ];
  
  const orders = [];
  
  // Look for paragraphs referencing COVID and orders
  paragraphs.forEach(paragraph => {
    if (paragraph.length < 40) return; // skip short
    const isRelevant =
      /(?:COVID|coronavirus|pandemic|emergency|closure|restriction)/i.test(paragraph) &&
      /(?:order|directive|mandate|proclamation|restriction|guidance)/i.test(paragraph);
    
    if (isRelevant) {
      for (const pattern of orderPatterns) {
        const matches = paragraph.match(pattern);
        if (matches) {
          matches.forEach(match => {
            if (!orders.includes(match) && match.length > 30) {
              orders.push(match);
            }
          });
        }
      }
      // If nothing matched specifically, but it's relevant, keep paragraph
      if (orders.length === 0 && paragraph.length < 500) {
        orders.push(paragraph);
      }
    }
  });

  // If we still found nothing, try Q3 2020 fallback
  if (orders.length === 0) {
    paragraphs.forEach(paragraph => {
      if (
        paragraph.length > 100 &&
        paragraph.includes('Q3 2020') &&
        /(?:COVID|coronavirus|pandemic|emergency|closure|restriction)/i.test(paragraph)
      ) {
        orders.push(paragraph);
      }
    });
  }
  
  // Deduplicate
  const uniqueOrders = [...new Set(orders)];
  return uniqueOrders.slice(0, 10);
}

/**
 * 3) Format extracted COVID orders for the protest letter
 */
function formatCovidOrders(orders) {
  if (!orders || orders.length === 0) {
    return `Based on the research, multiple government orders were in effect during the time period in question 
that significantly impacted business operations. These orders included capacity restrictions, social distancing 
requirements, and operational limitations that directly affected normal business functions.`;
  }
  return orders
    .slice(0, 5)
    .map((order, i) => `${i + 1}. ${order.trim()}`)
    .join('\n\n');
}

/**
 * 4) Generate the protest letter
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

    if (!chatGptLink) {
      return res.status(400).json({
        success: false,
        message: 'ChatGPT conversation link is required'
      });
    }

    console.log(`Processing ChatGPT link: ${chatGptLink}`);

    // Unique directory for request
    const requestId = uuidv4().substring(0, 8);
    const outputDir = path.join(__dirname, `../../data/ChatGPT_Conversations/${requestId}`);
    await fs.mkdir(outputDir, { recursive: true });

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    console.log('Browser launched');
    const page = await browser.newPage();
    // Larger viewport & longer timeout
    await page.setViewport({ width: 1280, height: 800 });
    await page.setDefaultNavigationTimeout(60000);

    // (Optional) block images & fonts:
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'font', 'stylesheet'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Navigate
    console.log(`Navigating to: ${chatGptLink}`);
    try {
      await page.goto(chatGptLink, { waitUntil: 'networkidle2' });
      console.log('Navigation success');
    } catch (err) {
      console.error('Navigation error:', err);
      console.log('Trying domcontentloaded instead');
      await page.goto(chatGptLink, { waitUntil: 'domcontentloaded' });
    }

    // Let things stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 1) Grab the entire HTML
    const rawHTML = await page.content();

    // 2) Send the full HTML to GPT for sanitization
    const conversationContent = await sendToGPTForSanitization(rawHTML);
    console.log(`Clean conversation length: ${conversationContent.length} chars`);

    // Save sanitized conversation
    await fs.writeFile(
      path.join(outputDir, 'conversation.txt'),
      conversationContent,
      'utf8'
    );

    // Screenshot & raw HTML for reference
    await page.screenshot({
      path: path.join(outputDir, 'screenshot.png'),
      fullPage: true
    });
    // Also save the raw HTML in case you need it
    await fs.writeFile(
      path.join(outputDir, 'page.html'),
      rawHTML,
      'utf8'
    );

    // Close browser
    await browser.close();
    console.log('Browser closed');

    // Extract COVID orders
    const covidOrders = extractCovidOrders(conversationContent);
    // Save them (optional)
    await fs.writeFile(
      path.join(outputDir, 'covid_orders.txt'),
      covidOrders.join('\n\n'),
      'utf8'
    );

    // Generate protest letter
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const formattedOrders = formatCovidOrders(covidOrders);
    const letter = generateProtestLetter(
      businessName,
      ein,
      location,
      timePeriod,
      businessType || 'business',
      formattedOrders,
      currentDate
    );

    // Return JSON
    res.status(200).json({
      success: true,
      letter,
      conversationContent,  // GPT-cleaned conversation
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

module.exports = router;
