// server/routes/letter-generator.js

const express = require('express');
const router = express.Router();
require('dotenv').config();
const axios = require('axios');

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-api-key-here'; // Replace with your actual key in .env
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Route to generate an ERC protest letter using GPT/LLM
router.post('/generate-letter', async (req, res) => {
  try {
    const {
      businessName,
      ein,
      location,
      timePeriod,
      disallowanceInfo,
      businessType
    } = req.body;

    if (!businessName || !ein || !timePeriod || !disallowanceInfo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields for letter generation'
      });
    }

    // Extract city and state from location
    const locationParts = location.split(',');
    const city = locationParts[0]?.trim() || '';
    const state = locationParts[1]?.trim() || '';

    // Create the prompt for the LLM
    const prompt = `Generate a formal IRS protest letter for Employee Retention Credit (ERC) disallowance. 
    Use the following information:
    
    Business Name: ${businessName}
    EIN: ${ein}
    Location: ${location}
    Time Period (Quarter): ${timePeriod}
    Business Type: ${businessType || 'business'}
    
    The letter should be addressed to the IRS and should formally protest the disallowance of the ERC for the specified quarter.
    
    Use the following COVID-19 orders research to substantiate the claim that the business was partially suspended due to government orders:
    
    ${disallowanceInfo}
    
    The protest letter should include:
    1. An introduction stating disagreement with the IRS disallowance
    2. A detailed timeline of relevant COVID-19 government orders active during the specified quarter
    3. Explanation of how these orders impacted the business operations constituting a "partial suspension"
    4. References to IRS Notices 2021-20, 2021-23, and 2021-49 regarding ERC eligibility
    5. A formal request to reconsider and reverse the disallowance
    6. An attestation statement with perjury language
    7. A signature line for an authorized representative
    
    Format the letter formally and professionally as would be appropriate for IRS submission.`;

    // Make the API call to OpenAI
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-4', // or gpt-3.5-turbo
        messages: [
          {
            role: 'system',
            content: 'You are a professional tax attorney specializing in Employee Retention Credit (ERC) protests. You write formal, detailed, and persuasive protest letters to the IRS.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract the generated letter from the response
    const generatedLetter = response.data.choices[0].message.content;

    // Return success with the generated letter
    res.status(200).json({
      success: true,
      letter: generatedLetter
    });
  } catch (error) {
    console.error('Error generating protest letter:', error);
    res.status(500).json({
      success: false,
      message: `Error generating protest letter: ${error.message}`
    });
  }
});

module.exports = router;