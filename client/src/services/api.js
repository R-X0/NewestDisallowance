// client/src/services/api.js

import axios from 'axios';

const API_URL = '/api';

export const submitERCProtest = async (formData) => {
  const response = await axios.post(`${API_URL}/erc-protest/submit`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const getSubmissions = async () => {
  const token = localStorage.getItem('admin_token'); // You'll need to handle authentication
  const response = await axios.get(`${API_URL}/erc-protest/admin/submissions`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data;
};

export const updateTracking = async (submissionId, trackingNumber) => {
  const token = localStorage.getItem('admin_token');
  const response = await axios.post(
    `${API_URL}/erc-protest/admin/update-tracking`,
    { submissionId, trackingNumber, status: 'mailed' },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
};

// Generate an ERC protest letter
export const generateERCProtestLetter = async (letterData) => {
  let endpoint = `${API_URL}/erc-protest/letter/generate-letter`;
  
  // If there's a ChatGPT link, use the chatgpt processor endpoint
  if (letterData.chatGptLink) {
    endpoint = `${API_URL}/erc-protest/chatgpt/process-chatgpt`;
  }
  
  const response = await axios.post(
    endpoint,
    letterData,
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  
  // For ChatGPT link processing, we need to format the letter with the processed data
  if (letterData.chatGptLink && response.data.success) {
    // This would format the letter using the conversation content and attachments
    // In a real implementation, you might call another endpoint to generate the letter
    // or format it client-side
    const formattedLetter = await formatLetterWithChatGptData(
      letterData, 
      response.data.conversationContent, 
      response.data.attachments
    );
    
    return {
      success: true,
      letter: formattedLetter
    };
  }
  
  return response.data;
};

// Helper function to format the letter with ChatGPT data
const formatLetterWithChatGptData = async (letterData, conversationContent, attachments) => {
  // In a real implementation, you might call another endpoint or use a template system
  // This is a simplified example
  
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Extract location components
  const locationParts = letterData.location.split(',');
  const city = locationParts[0]?.trim() || '';
  const state = locationParts[1]?.trim() || '';
  
  // Extract relevant COVID orders from conversation content
  // In a real implementation, this would use NLP or a more sophisticated approach
  const ordersRegex = /(Executive Order|Directive|Proclamation|Public Health Order)[^\n]+(COVID|coronavirus)[^\n]+/gi;
  const matchedOrders = conversationContent.match(ordersRegex) || [];
  
  // Format the extracted orders
  const formattedOrders = matchedOrders.slice(0, 3).map((order, index) => 
    `${index + 1}. ${order.trim()}`
  ).join('\n\n');
  
  // Format attachments list
  const attachmentsList = attachments.map((attachment, index) => 
    `${index + 1}. ${attachment.title} - PDF`
  ).join('\n');
  
  return `${currentDate}
Internal Revenue Service
Ogden, UT 84201

EIN: ${letterData.ein}
Taxpayer Name: ${letterData.businessName}
RE: Formal Protest to Letter 105 - ERC Disallowance for ${letterData.timePeriod}
Tax Period: ${letterData.timePeriod}
Claim Amount: $XXXXX

Dear Appeals Officer,

We write in response to the IRS notice disallowing ${letterData.businessName}'s Employee Retention Credit (ERC) claim for ${letterData.timePeriod}. The disallowance was based on an assertion that "no government orders were in effect" that caused a suspension of our operations. We respectfully disagree. Multiple federal, state, county, and city government orders were active during ${letterData.timePeriod}, and they did impose COVID-19 related restrictions and requirements that partially suspended or limited ${letterData.businessName}'s normal operations.

Based on the COVID-19 research obtained (see attachments), the following government orders directly impacted our business operations:

${formattedOrders || `1. COVID-19 restrictions in ${city}, ${state} significantly impacted our ${letterData.businessType} operations during ${letterData.timePeriod}.

2. Social distancing requirements mandated by state and local authorities reduced our operational capacity.

3. Enhanced health and safety protocols required by government orders created substantial modifications to our standard business procedures.`}

In light of these facts and supporting authorities, ${letterData.businessName} qualifies for the Employee Retention Credit for ${letterData.timePeriod} due to a partial suspension of its operations caused by COVID-19 government orders. We have shown that numerous government orders were in effect during the quarter and that they had a direct, significant impact on our ability to conduct our mission.

We respectfully request that the IRS reconsider and reverse the disallowance of our ${letterData.timePeriod} ERC. The credit we claimed was fully in line with the law and guidance.

Attestation: "Under penalties of perjury, I declare that I submitted the protest and accompanying documents, and to the best of my personal knowledge and belief, the information stated in the protest and accompanying documents is true, correct, and complete."

Sincerely,

[Authorized Representative]
${letterData.businessName}

Attachments:
${attachmentsList || 'COVID-19 Government Orders Documentation - PDF'}
`;
};