import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Paper, Typography, TextField, CircularProgress,
  Divider, Alert, Snackbar, IconButton
} from '@mui/material';
import { ContentCopy, CheckCircle } from '@mui/icons-material';

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

const COVIDPromptGenerator = ({ formData }) => {
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  useEffect(() => {
    if (formData && Object.keys(formData).length > 0) {
      generatePrompt();
    }
  }, [formData]);
  
  const generatePrompt = () => {
    setGenerating(true);
    
    setTimeout(() => {
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
        
        const promptTemplate = `Please provide all state, city, and county COVID-related government orders, proclamations, and public health orders in place during 2020-2021 that would affect a "${businessType}" business located in ${city}, ${state}. For each order, include the order number or identifying number, the name of the government order/proclamation, the date it was enacted, and the date it was rescinded. If rescinded by subsequent orders, list subsequent order and dates. Additionally, please provide a detailed summary of 3-5 sentences for each order, explaining what the order entailed and how it specifically impacted a ${businessType} in ${formData.timePeriod}. Provide possible reasons how ${formData.timePeriod} Covid Orders would have affected the business in that quarter.`;
        
        setPrompt(promptTemplate);
        setGenerating(false);
      } catch (error) {
        console.error('Error generating prompt:', error);
        setGenerating(false);
      }
    }, 500); // Simulate processing time
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
  
  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        COVID Orders Research Prompt
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
              Use this prompt in GPT to research COVID-19 orders affecting your business:
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
              Copy this prompt and paste it into a GPT interface for detailed research
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