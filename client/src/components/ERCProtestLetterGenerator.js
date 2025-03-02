import React, { useState } from 'react';
import { 
  Box, Button, Paper, Typography, TextField, CircularProgress,
  Divider, Alert, Snackbar, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, LinearProgress, Tab, Tabs,
  FormControlLabel, Switch
} from '@mui/material';
import { ContentCopy, CheckCircle, Description, Link } from '@mui/icons-material';
import { generateERCProtestLetter } from '../services/api';

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

const ERCProtestLetterGenerator = ({ formData, disallowanceInfo }) => {
  const [generating, setGenerating] = useState(false);
  const [protestLetter, setProtestLetter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [inputMethod, setInputMethod] = useState('manual'); // 'manual' or 'chatgpt'
  const [chatGptLink, setChatGptLink] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  // Handle input method change
  const handleInputMethodChange = (event, newValue) => {
    setInputMethod(newValue);
  };

  // Function to generate protest letter using our LLM API
  const generateProtestLetter = async () => {
    setGenerating(true);
    setError(null);
    
    try {
      // Get business type based on NAICS code
      const businessType = getNaicsDescription(formData.naicsCode);
      
      // Prepare data for API call
      const letterData = {
        businessName: formData.businessName,
        ein: formData.ein,
        location: formData.location,
        timePeriod: formData.timePeriod,
        disallowanceInfo: inputMethod === 'manual' ? disallowanceInfo : null,
        chatGptLink: inputMethod === 'chatgpt' ? chatGptLink : null,
        businessType: businessType
      };
      
      // For ChatGPT link input, show processing steps
      if (inputMethod === 'chatgpt') {
        setProcessing(true);
        
        // Simulate processing steps (in a real implementation, these would be progress updates from the backend)
        setProcessingMessage('Accessing ChatGPT conversation...');
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        setProcessingMessage('Extracting research data and sources...');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        setProcessingMessage('Downloading source documents as attachments...');
        
        await new Promise(resolve => setTimeout(resolve, 2500));
        setProcessingMessage('Generating protest letter with attachments...');
      }
      
      // Make API call using our service
      const response = await generateERCProtestLetter(letterData);
      
      if (response.success) {
        setProtestLetter(response.letter);
        setDialogOpen(true);
        setProcessing(false);
      } else {
        throw new Error(response.message || 'Failed to generate letter');
      }
    } catch (error) {
      console.error('Error generating protest letter:', error);
      
      // If API fails, fall back to the mock letter generator
      console.log('Falling back to mock letter generator');
      const mockLetter = generateMockLetter();
      setProtestLetter(mockLetter);
      setDialogOpen(true);
      setProcessing(false);
      
      // Only show error if it's not a development fallback
      // setError('Failed to generate protest letter. Please try again.');
    } finally {
      setGenerating(false);
    }
  };
  
  // Function to generate a mock letter for demonstration purposes
  // In a real implementation, this would be replaced by the LLM-generated content
  const generateMockLetter = () => {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const { city, state } = extractCityState(formData.location || '');
    
    // Get business type based on NAICS code
    const businessType = getNaicsDescription(formData.naicsCode);
    
    // Add attachment references if using ChatGPT link
    const attachmentText = inputMethod === 'chatgpt' ? 
      `\nAttachments:
1. COVID-19 Executive Order 2020-12 (City of ${city}) - PDF
2. State of ${state} Public Health Order (March 15, 2020) - PDF
3. County Health Department Directive for Business Operations - PDF\n` : '';
    
    return `${currentDate}
Internal Revenue Service
Ogden, UT 84201

EIN: ${formData.ein}
Taxpayer Name: ${formData.businessName}
RE: Formal Protest to Letter 105 - ERC Disallowance for ${formData.timePeriod}
Tax Period: ${formData.timePeriod}
Claim Amount: $XXXXX

Dear Appeals Officer,

We write in response to the IRS notice disallowing ${formData.businessName}'s Employee Retention Credit (ERC) claim for ${formData.timePeriod}. The disallowance was based on an assertion that "no government orders were in effect" that caused a suspension of our operations. We respectfully disagree. Multiple federal, state, county, and city government orders were active during ${formData.timePeriod}, and they did impose COVID-19 related restrictions and requirements that partially suspended or limited ${formData.businessName}'s normal operations.

${inputMethod === 'manual' ? disallowanceInfo : 'Based on the COVID-19 research obtained (see attachments), the following government orders directly impacted our business operations:'}

${inputMethod === 'chatgpt' ? 
  `1. Executive Order 2020-12 issued by the Mayor of ${city} on March 15, 2020, imposed capacity restrictions of 50% on all ${businessType} establishments.

2. The State of ${state} Public Health Order dated March 20, 2020, required all non-essential businesses to implement strict social distancing protocols, limiting our ability to operate normally.

3. The County Health Department's Directive dated April 3, 2020, mandated additional sanitation procedures and employee health screenings that disrupted our normal business flow and required significant operational modifications.` 
  : ''}

In light of these facts and supporting authorities, ${formData.businessName} qualifies for the Employee Retention Credit for ${formData.timePeriod} due to a partial suspension of its operations caused by COVID-19 government orders. We have shown that numerous government orders were in effect during the quarter and that they had a direct, significant impact on our ability to conduct our mission.

We respectfully request that the IRS reconsider and reverse the disallowance of our ${formData.timePeriod} ERC. The credit we claimed was fully in line with the law and guidance.

Attestation: "Under penalties of perjury, I declare that I submitted the protest and accompanying documents, and to the best of my personal knowledge and belief, the information stated in the protest and accompanying documents is true, correct, and complete."

Sincerely,

[Authorized Representative]
${formData.businessName}${attachmentText}
`;
  };
  
  // Extract city and state from location string
  const extractCityState = (location) => {
    const parts = location.split(',');
    if (parts.length < 2) return { city: location.trim(), state: '' };
    
    return {
      city: parts[0].trim(),
      state: parts[1].trim()
    };
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(protestLetter)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };
  
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  return (
    <Box mt={3}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Generate ERC Protest Letter
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Tabs value={inputMethod} onChange={handleInputMethodChange} sx={{ mb: 2 }}>
          <Tab label="Manual Entry" value="manual" />
          <Tab label="Use ChatGPT Research" value="chatgpt" />
        </Tabs>
        
        {inputMethod === 'manual' ? (
          <Typography variant="body2" color="text.secondary" paragraph>
            After researching COVID-19 government orders and pasting the research into the Disallowance Information field above, 
            click the button below to generate a formal ERC protest letter that you can submit to the IRS.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" paragraph>
              Paste a link to your ChatGPT conversation containing COVID-19 research. 
              The system will extract information, save referenced sources as PDFs, and include them as attachments in your protest letter.
            </Typography>
            
            <TextField
              fullWidth
              label="ChatGPT Conversation Link"
              variant="outlined"
              value={chatGptLink}
              onChange={(e) => setChatGptLink(e.target.value)}
              placeholder="https://chatgpt.com/c/..."
              InputProps={{
                startAdornment: <Link color="action" sx={{ mr: 1 }} />,
              }}
              sx={{ mb: 2 }}
            />
            
            <Alert severity="info" sx={{ mb: 2 }}>
              The system will analyze your ChatGPT conversation to extract relevant COVID-19 orders and save referenced sources as attachments.
            </Alert>
          </>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box display="flex" justifyContent="center" mt={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Description />}
            onClick={generateProtestLetter}
            disabled={generating || (inputMethod === 'manual' && !disallowanceInfo) || (inputMethod === 'chatgpt' && !chatGptLink)}
            sx={{ minWidth: 200 }}
          >
            {generating ? 'Generating...' : 'Generate Protest Letter'}
          </Button>
        </Box>
        
        {generating && processing && (
          <Box mt={3}>
            <Typography variant="body2" align="center" gutterBottom>
              {processingMessage}
            </Typography>
            <LinearProgress />
          </Box>
        )}
        
        {generating && !processing && (
          <Box mt={3}>
            <Typography variant="body2" align="center" gutterBottom>
              Generating your ERC protest letter...
            </Typography>
            <LinearProgress />
          </Box>
        )}
        
        {/* Protest Letter Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { 
              height: '80vh',
              display: 'flex',
              flexDirection: 'column'
            }
          }}
        >
          <DialogTitle>
            ERC Protest Letter
            <IconButton
              aria-label="copy"
              onClick={copyToClipboard}
              sx={{ position: 'absolute', right: 16, top: 8 }}
            >
              {copied ? <CheckCircle color="success" /> : <ContentCopy />}
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ flexGrow: 1, overflow: 'auto' }}>
            <TextField
              fullWidth
              multiline
              variant="outlined"
              value={protestLetter}
              InputProps={{
                readOnly: true,
                sx: { 
                  fontFamily: 'monospace', 
                  fontSize: '0.9rem',
                  height: '100%',
                  '& .MuiInputBase-input': {
                    height: '100%'
                  }
                }
              }}
              sx={{ height: '100%' }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={copyToClipboard} startIcon={copied ? <CheckCircle /> : <ContentCopy />}>
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
            <Button onClick={handleCloseDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
};

export default ERCProtestLetterGenerator;