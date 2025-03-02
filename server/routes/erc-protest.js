// server/routes/erc-protest.js - Updated section for handling chatgpt links

// Process ChatGPT conversation by scraping the content
router.post('/chatgpt/process-chatgpt', async (req, res) => {
    try {
      const { chatGptLink, businessName, ein, location, timePeriod, businessType } = req.body;
      
      // Validate required fields
      if (!chatGptLink || !businessName || !ein || !timePeriod) {
        return res.status(400).json({
          success: false,
          message: 'ChatGPT link, business name, EIN, and time period are required'
        });
      }
  
      // Extract location components
      const locationParts = location.split(',');
      const city = locationParts[0]?.trim() || 'Unknown City';
      const state = locationParts[1]?.trim() || 'Unknown State';
      
      // Create directory for attachments if needed
      const uniqueId = uuidv4().substring(0, 8);
      const attachmentsDir = path.join(__dirname, `../data/ChatGPT_Attachments/${uniqueId}`);
      await fs.mkdir(attachmentsDir, { recursive: true });
  
      // Initialize puppeteer to scrape the ChatGPT conversation
      console.log(`Attempting to scrape ChatGPT conversation: ${chatGptLink}`);
      let conversationContent = '';
      let attachments = [];
  
      try {
        // Launch puppeteer browser
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
  
        // Open a new page
        const page = await browser.newPage();
        
        // Navigate to the ChatGPT conversation
        await page.goto(chatGptLink, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for the content to load
        await page.waitForSelector('.markdown', { timeout: 10000 }).catch(() => {
          console.log('Could not find markdown content, using body instead');
        });
  
        // Get the page content
        const htmlContent = await page.content();
        
        // Close the browser
        await browser.close();
  
        // Use cheerio to parse and extract the conversation
        const $ = cheerio.load(htmlContent);
        
        // Extract all messages from the conversation
        // ChatGPT UI structure may change, so this selector might need updates
        $('.markdown').each((index, element) => {
          const messageText = $(element).text().trim();
          conversationContent += messageText + '\n\n';
        });
  
        // If we couldn't find any content with the markdown selector
        if (!conversationContent.trim()) {
          console.log('No content found with .markdown selector, trying alternate approach');
          conversationContent = $('body').text().trim();
        }
        
        // Extract relevant COVID orders from conversation content
        // This is a basic regex pattern - a more sophisticated approach would be better
        const ordersRegex = /(Executive Order|Directive|Proclamation|Public Health Order)[^\\n]+(COVID|coronavirus)[^\\n]+/gi;
        const matchedOrders = conversationContent.match(ordersRegex) || [];
        
        // For each matched order, create a "virtual attachment"
        attachments = matchedOrders.slice(0, 5).map((order, index) => {
          const orderName = order.substring(0, 60).trim() + '...';
          return {
            title: `COVID Order ${index + 1}: ${orderName}`,
            path: `${attachmentsDir}/order-${index + 1}.pdf`,
            // In a real implementation, we would save PDFs here
          };
        });
  
        console.log(`Successfully extracted ${attachments.length} order references from the conversation`);
        
      } catch (error) {
        console.error('Error scraping ChatGPT conversation:', error);
        // We'll continue with a limited implementation rather than failing completely
      }
  
      // Generate a protest letter using the extracted content
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
  
      // Extract relevant COVID-related information from the conversation
      let covidOrders = '';
      
      // If we have successfully scraped content, parse it for government orders
      if (conversationContent.length > 0) {
        // Look for sections that might contain order information
        const orderMatches = conversationContent.match(/(?:Executive Order|Directive|Order No\.|Public Health Order)[^\n]+(?:\n[^\n]+){1,6}/g) || [];
        
        // Format the matches into a clean numbered list
        covidOrders = orderMatches.slice(0, 3).map((match, index) => {
          return `${index + 1}. ${match.replace(/\n/g, '\n   ').trim()}`;
        }).join('\n\n');
      }
  
      // If we couldn't extract orders, return an error
      if (!covidOrders) {
        return res.status(400).json({
          success: false,
          message: "Could not extract COVID orders from the conversation. Please make sure your ChatGPT conversation contains specific information about government orders."
        });
      }
  
      // Format the letter
      const letter = `${currentDate}
  Internal Revenue Service
  Ogden, UT 84201
  
  EIN: ${ein}
  Taxpayer Name: ${businessName}
  RE: Formal Protest to Letter 105 - ERC Disallowance for ${timePeriod}
  Tax Period: ${timePeriod}
  Claim Amount: $XXXXX
  
  Dear Appeals Officer,
  
  We write in response to the IRS notice disallowing ${businessName}'s Employee Retention Credit (ERC) claim for ${timePeriod}. The disallowance was based on an assertion that "no government orders were in effect" that caused a suspension of our operations. We respectfully disagree. Multiple federal, state, county, and city government orders were active during ${timePeriod}, and they did impose COVID-19 related restrictions and requirements that partially suspended or limited ${businessName}'s normal operations.
  
  Based on the COVID-19 research obtained (see attachments), the following government orders directly impacted our business operations:
  
  ${covidOrders}
  
  In light of these facts and supporting authorities, ${businessName} qualifies for the Employee Retention Credit for ${timePeriod} due to a partial suspension of its operations caused by COVID-19 government orders. We have shown that numerous government orders were in effect during the quarter and that they had a direct, significant impact on our ability to conduct our mission.
  
  We respectfully request that the IRS reconsider and reverse the disallowance of our ${timePeriod} ERC. The credit we claimed was fully in line with the law and guidance.
  
  Attestation: "Under penalties of perjury, I declare that I submitted the protest and accompanying documents, and to the best of my personal knowledge and belief, the information stated in the protest and accompanying documents is true, correct, and complete."
  
  Sincerely,
  
  [Authorized Representative]
  ${businessName}
  
  Attachments:
  ${attachments.map((attachment, index) => `${index + 1}. ${attachment.title}`).join('\n') || 'COVID-19 Government Orders Documentation - PDF'}`;
      
      // Return the generated letter and conversation content
      res.status(200).json({
        success: true,
        letter,
        conversationContent,
        attachments
      });
    } catch (error) {
      console.error('Error processing ChatGPT conversation:', error);
      res.status(500).json({
        success: false,
        message: `Error processing ChatGPT conversation: ${error.message}`
      });
    }
  });