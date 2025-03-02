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
        chatGptLink: chatGptLink,
        businessType: businessType
      };
      
      // Show processing steps
      setProcessing(true);
      
      // Simulate processing steps (in a real implementation, these would be progress updates from the backend)
      setProcessingMessage('Accessing ChatGPT conversation...');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProcessingMessage('Extracting research data and sources...');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      setProcessingMessage('Downloading source documents as attachments...');
      
      await new Promise(resolve => setTimeout(resolve, 2500));
      setProcessingMessage('Generating protest letter with attachments...');
      
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
      setProcessing(false);
      setError(`Failed to generate protest letter: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };
  
  // No longer needed as we're not generating mock letters
  
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
            disabled={generating || !chatGptLink}
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