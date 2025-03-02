import React, { useState } from 'react';
import { 
  Box, Button, Paper, Typography, TextField, CircularProgress,
  Divider, Alert, Snackbar, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, LinearProgress,
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
  const [chatGptLink, setChatGptLink] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingStep, setProcessingStep] = useState(0);

  // Function to generate protest letter using our LLM API
  const generateProtestLetter = async () => {
    setGenerating(true);
    setError(null);
    setProcessing(true);
    setProcessingStep(0);
    
    try {
      // Get business type based on NAICS code
      const businessType = getNaicsDescription(formData.naicsCode);
      
      // Prepare data for API call
      const letterData = {
        businessName: formData.businessName,
        ein: formData.ein,
        location: formData.location,
        timePeriod: formData.timePeriod,
        chatGptLink: chatGptLink,
        businessType: businessType
      };
      
      // Update processing steps
      setProcessingMessage('Connecting to ChatGPT conversation...');
      setProcessingStep(1);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProcessingMessage('Extracting COVID-19 orders and research data...');
      setProcessingStep(2);
      
      // Call the API to generate the letter
      const response = await generateERCProtestLetter(letterData);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProcessingMessage('Generating protest letter...');
      setProcessingStep(3);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (response.success) {
        setProtestLetter(response.letter);
        setDialogOpen(true);
        setProcessing(false);
      } else {
        throw new Error(response.message || 'Failed to generate letter');
      }
    } catch (error) {
      console.error('Error generating protest letter:', error);
      setProcessing(false);
      setError(`Failed to generate protest letter: ${error.message}`);
    } finally {
      setGenerating(false);
    }
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
  
  const validateChatGptLink = (link) => {
    return link && (
      link.startsWith('https://chat.openai.com/') || 
      link.startsWith('https://chatgpt.com/') ||
      link.includes('chat.openai.com') ||
      link.includes('chatgpt.com')
    );
  };
  
  return (
    <Box mt={3}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Generate ERC Protest Letter
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Paste a link to your ChatGPT conversation containing COVID-19 research. 
          Our system will extract the information and generate a customized protest letter for your ERC claim.
        </Typography>
        
        <TextField
          fullWidth
          label="ChatGPT Conversation Link"
          variant="outlined"
          value={chatGptLink}
          onChange={(e) => setChatGptLink(e.target.value)}
          placeholder="https://chat.openai.com/c/..."
          error={chatGptLink !== '' && !validateChatGptLink(chatGptLink)}
          helperText={chatGptLink !== '' && !validateChatGptLink(chatGptLink) ? 
            "Please enter a valid ChatGPT conversation link" : ""}
          InputProps={{
            startAdornment: <Link color="action" sx={{ mr: 1 }} />,
          }}
          sx={{ mb: 2 }}
        />
        
        <Alert severity="info" sx={{ mb: 2 }}>
          Make sure your ChatGPT conversation includes specific COVID-19 orders that affected your business during {formData.timePeriod}. 
          The system will analyze your conversation to extract this information for your protest letter.
        </Alert>
        
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
            disabled={generating || !chatGptLink || !validateChatGptLink(chatGptLink)}
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
            <LinearProgress 
              variant="determinate" 
              value={processingStep * 25} 
              sx={{ mt: 1, mb: 2 }}
            />
            <Typography variant="caption" align="center" display="block" color="text.secondary">
              This process may take 1-2 minutes as we need to extract and analyze your ChatGPT conversation.
            </Typography>
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