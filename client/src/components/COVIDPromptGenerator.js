import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Paper, Typography, TextField, CircularProgress,
  Divider, Alert, Snackbar, IconButton
} from '@mui/material';
import { ContentCopy, CheckCircle } from '@mui/icons-material';
import axios from 'axios';

// Utility function to extract city and state from location string
const extractCityState = (location) => {
  // Assuming location format is "City, State"
  const parts = location.split(',');
  if (parts.length < 2) return { city: location.trim(), state: '' };
  
  return {
    city: parts[0].trim(),
    state: parts[1].trim()
  };
};

// Utility function to map NAICS code to business type
const getNaicsDescription = (naicsCode) => {
  // This is a simplified mapping - you'd want a more comprehensive one in production
  const naicsMap = {
    '541110': 'law firm',
    '541211': 'accounting firm',
    '541330': 'engineering firm',
    '561320': 'temporary staffing agency',
    '722511': 'restaurant', 
    '623110': 'nursing home',
    '622110': 'hospital',
    '611110': 'elementary or secondary school',
    '445110': 'supermarket or grocery store',
    '448140': 'clothing store',
    '236220': 'construction company',
    '621111': 'medical office'
  };
  
  return naicsMap[naicsCode] || 'business';
};

const COVIDPromptGenerator = ({ formData, documentType = 'protestLetter' }) => {
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  useEffect(() => {
    if (formData && Object.keys(formData).length > 0) {
      generatePrompt();
    }
  }, [formData, documentType]); // Added documentType as dependency
  
  const generatePrompt = async () => {
    setGenerating(true);
    
    try {
      const { city, state } = extractCityState(formData.location || '');
      const businessType = getNaicsDescription(formData.naicsCode);
      
      // Extract quarter and year from time period
      let quarter = '';
      let year = '';
      
      if (formData.timePeriod) {
        const parts = formData.timePeriod.split(' ');
        if (parts.length === 2) {
          quarter = parts[0];
          year = parts[1];
        }
      }
      
      // Different base templates based on document type
      let basePrompt = '';
      
      if (documentType === 'protestLetter' || formData.documentType === 'protestLetter') {
        // Original protest letter prompt
        basePrompt = `Please provide all state, city, and county COVID-related government orders, proclamations, and public health orders in place during 2020-2021 that would affect a "${businessType}" business located in ${city}, ${state}. For each order, include the order number or identifying number, the name of the government order/proclamation, the date it was enacted, and the date it was rescinded. If rescinded by subsequent orders, list subsequent order and dates. Additionally, please provide a detailed summary of 3-5 sentences for each order, explaining what the order entailed and how it specifically impacted a ${businessType} in ${formData.timePeriod}. Provide possible reasons how ${formData.timePeriod} Covid Orders would have affected the business in that quarter.`;
      } else {
        // Form 886-A substantiation prompt
        basePrompt = `Review the following website for ${formData.businessName}. ${formData.businessWebsite}. Provide a general overview summary of the business operations. With the information found regarding the business operations, review all federal, state, city, county government orders that would have been in place and affected ${formData.businessName} located in ${city}, ${state} from 2Q 2020 – 3Q 2021. 

For each order, provide:
- Order name and number
- Date enacted and date rescinded
- A 2-3 sentence summary of the order
- How the order specifically affected the ${businessType} in ${formData.timePeriod} and for what period of time (which quarters)

With the information gained regarding operations and government orders in place, I need help creating a Form 886-A IRS response. Create a comprehensive document exclusively for ERC claims related to COVID-19. The document will provide detailed IRS-style explanations, prioritize official IRS and government sources and all federal, state, city, county applicable government orders that would have affected the business. 

Any reference to the business should be notated as ${formData.businessName} and explain how this business qualified for ERC ${formData.timePeriod} due to full and partial shutdowns caused by government orders.`;
      }
      
      // Use OpenAI API to generate a customized prompt based on the business info
      try {
        const response = await axios.post('/api/erc-protest/chatgpt/generate-prompt', {
          basePrompt,
          businessInfo: {
            businessType,
            city,
            state,
            quarter,
            year,
            timePeriod: formData.timePeriod,
            documentType: documentType || formData.documentType, // Pass document type to API
            businessName: formData.businessName, // Add business name for Form 886-A
            businessWebsite: formData.businessWebsite // Add business website for Form 886-A
          }
        });
        
        if (response.data && response.data.prompt) {
          setPrompt(response.data.prompt);
        } else {
          // If API fails or isn't available, fall back to the base prompt
          setPrompt(basePrompt);
        }
      } catch (apiError) {
        console.error('Error calling GPT API:', apiError);
        // Fall back to the base prompt if API call fails
        setPrompt(basePrompt);
      }
    } catch (error) {
      console.error('Error generating prompt:', error);
      // In case of any error, just use a simpler version of the prompt
      const { city, state } = extractCityState(formData.location || '');
      const businessType = getNaicsDescription(formData.naicsCode);
      
      if (documentType === 'protestLetter' || formData.documentType === 'protestLetter') {
        setPrompt(`Please provide all state, city, and county COVID-related government orders, proclamations, and public health orders in place during ${formData.timePeriod} that would affect a "${businessType}" business located in ${city}, ${state}. For each order, include the order number, the date it was enacted, and the date it was rescinded. Additionally, please explain how each order specifically impacted a ${businessType}.`);
      } else {
        setPrompt(`Please research and provide a detailed analysis of how COVID-19 government orders affected ${formData.businessName}, a ${businessType} in ${city}, ${state}, during ${formData.timePeriod}. Include order numbers, dates, and specific impacts for Form 886-A substantiation.`);
      }
    } finally {
      setGenerating(false);
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(prompt)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };
  
  // Get appropriate title based on document type
  const getPromptTitle = () => {
    const docType = documentType || formData.documentType;
    return docType === 'protestLetter' 
      ? 'COVID Orders Research Prompt for Protest Letter'
      : 'COVID Orders Research Prompt for Form 886-A';
  };
  
  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        {getPromptTitle()}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      {generating ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress size={40} />
          <Typography variant="body1" sx={{ ml: 2 }}>
            Generating prompt...
          </Typography>
        </Box>
      ) : prompt ? (
        <>
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Use this prompt in ChatGPT to research COVID-19 orders affecting your business:
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={8}
              value={prompt}
              variant="outlined"
              InputProps={{
                readOnly: true,
                sx: { fontFamily: 'monospace', fontSize: '0.9rem' }
              }}
            />
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Copy this prompt and paste it into a ChatGPT interface for detailed research
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={copied ? <CheckCircle /> : <ContentCopy />}
              onClick={copyToClipboard}
              disabled={copied}
            >
              {copied ? 'Copied!' : 'Copy Prompt'}
            </Button>
          </Box>
        </>
      ) : (
        <Alert severity="info">
          Fill out the business information form to generate a research prompt for COVID-19 orders.
        </Alert>
      )}
      
      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => setCopied(false)}
        message="Prompt copied to clipboard!"
        action={
          <IconButton size="small" color="inherit" onClick={() => setCopied(false)}>
            <CheckCircle />
          </IconButton>
        }
      />
    </Paper>
  );
};

export default COVIDPromptGenerator;