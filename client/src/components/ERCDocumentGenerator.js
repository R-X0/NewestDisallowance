import React, { useState } from 'react';
import { 
  Box, Button, Paper, Typography, TextField, CircularProgress,
  Divider, Alert, Snackbar, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, LinearProgress,
  FormControlLabel, Switch, Tabs, Tab, FormControl, 
  InputLabel, Select, MenuItem, Chip, Grid // Added Grid import
} from '@mui/material';
import { ContentCopy, CheckCircle, Description, Link, FileDownload } from '@mui/icons-material';
import { generateERCProtestLetter, generateERCSubstantiation } from '../services/api';

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

// TabPanel component for toggling between document types
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`erc-doc-tabpanel-${index}`}
      aria-labelledby={`erc-doc-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ERCDocumentGenerator = ({ formData, disallowanceInfo }) => {
  const [generating, setGenerating] = useState(false);
  const [documentContent, setDocumentContent] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [chatGptLink, setChatGptLink] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingStep, setProcessingStep] = useState(0);
  const [packageData, setPackageData] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Additional state for Form 886-A Substantiation
  const [businessWebsite, setBusinessWebsite] = useState(formData?.businessWebsite || '');
  const [claimPeriods, setClaimPeriods] = useState([]);
  const [additionalContext, setAdditionalContext] = useState('');

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Function to generate protest letter using our LLM API
  const generateProtestLetter = async () => {
    setGenerating(true);
    setError(null);
    setProcessing(true);
    setProcessingStep(0);
    setPackageData(null);
    
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
        businessType: businessType,
        trackingId: formData.trackingId || '' // Pass tracking ID if available
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
      setProcessingMessage('Converting referenced links to PDF attachments...');
      setProcessingStep(4);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProcessingMessage('Creating complete protest package...');
      setProcessingStep(5);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (response.success) {
        setDocumentContent(response.letter);
        setPackageData({
          pdfPath: response.pdfPath,
          zipPath: response.zipPath,
          attachments: response.attachments || [],
          packageFilename: response.packageFilename || 'complete_protest_package.zip'
        });
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

  // Function to generate Form 886-A substantiation using LLM API
  const generateSubstantiation = async () => {
    setGenerating(true);
    setError(null);
    setProcessing(true);
    setProcessingStep(0);
    setPackageData(null);
    
    try {
      // Get business type based on NAICS code
      const businessType = getNaicsDescription(formData.naicsCode);
      
      // Prepare data for API call
      const substantiationData = {
        businessName: formData.businessName,
        ein: formData.ein,
        location: formData.location,
        businessWebsite: businessWebsite,
        businessType: businessType,
        naicsCode: formData.naicsCode,
        claimPeriods: claimPeriods,
        chatGptLink: chatGptLink,
        additionalContext: additionalContext,
        trackingId: formData.trackingId || '' // Pass tracking ID if available
      };
      
      // Update processing steps
      setProcessingMessage('Connecting to ChatGPT conversation...');
      setProcessingStep(1);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProcessingMessage('Analyzing business operations and government orders...');
      setProcessingStep(2);
      
      // Call the API to generate the substantiation document
      const response = await generateERCSubstantiation(substantiationData);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProcessingMessage('Creating Form 886-A document...');
      setProcessingStep(3);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProcessingMessage('Processing government orders across all claim periods...');
      setProcessingStep(4);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProcessingMessage('Creating complete substantiation package...');
      setProcessingStep(5);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (response.success) {
        setDocumentContent(response.document);
        setPackageData({
          pdfPath: response.pdfPath,
          zipPath: response.zipPath,
          attachments: response.attachments || [],
          packageFilename: response.packageFilename || 'erc_substantiation_package.zip'
        });
        setDialogOpen(true);
        setProcessing(false);
      } else {
        throw new Error(response.message || 'Failed to generate substantiation document');
      }
    } catch (error) {
      console.error('Error generating substantiation document:', error);
      setProcessing(false);
      setError(`Failed to generate Form 886-A: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(documentContent)
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

  const downloadPackage = () => {
    if (packageData && packageData.zipPath) {
      // Create a download link
      window.open(`/api/erc-protest/admin/download?path=${packageData.zipPath}`, '_blank');
    }
  };

  const handleClaimPeriodChange = (event) => {
    const {
      target: { value },
    } = event;
    setClaimPeriods(
      // On autofill we get a stringified value.
      typeof value === 'string' ? value.split(',') : value,
    );
  };

  const availableQuarters = [
    'Q2 2020', 'Q3 2020', 'Q4 2020', 
    'Q1 2021', 'Q2 2021', 'Q3 2021', 'Q4 2021'
  ];
  
  return (
    <Box mt={3}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="ERC Protest Letter" />
          <Tab label="Form 886-A Substantiation" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
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
              sx={{ minWidth: 240 }}
            >
              {generating ? 'Generating...' : 'Generate Complete Protest Package'}
            </Button>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Generate Form 886-A Substantiation
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Typography variant="body2" color="text.secondary" paragraph>
            Form 886-A provides a comprehensive response to IRS inquiries by addressing all claim periods and 
            detailing how government orders affected your business operations.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Business Website"
                variant="outlined"
                value={businessWebsite}
                onChange={(e) => setBusinessWebsite(e.target.value)}
                placeholder="https://www.yourbusiness.com"
                sx={{ mb: 2 }}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="claim-periods-label">Claim Periods</InputLabel>
                <Select
                  labelId="claim-periods-label"
                  multiple
                  value={claimPeriods}
                  onChange={handleClaimPeriodChange}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} />
                      ))}
                    </Box>
                  )}
                >
                  {availableQuarters.map((quarter) => (
                    <MenuItem key={quarter} value={quarter}>
                      {quarter}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
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
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Additional Context (Optional)"
                variant="outlined"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Provide any additional information about your business operations or specific impacts of government orders..."
                sx={{ mb: 2 }}
              />
            </Grid>
          </Grid>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            Make sure your ChatGPT conversation includes comprehensive research on COVID-19 orders affecting your business 
            across all claim periods. The system will analyze this data to create a complete Form 886-A document.
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
              onClick={generateSubstantiation}
              disabled={generating || !chatGptLink || !validateChatGptLink(chatGptLink) || claimPeriods.length === 0}
              sx={{ minWidth: 240 }}
            >
              {generating ? 'Generating...' : 'Generate Form 886-A Package'}
            </Button>
          </Box>
        </TabPanel>
        
        {generating && processing && (
          <Box mt={3}>
            <Typography variant="body2" align="center" gutterBottom>
              {processingMessage}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={(processingStep * 100) / 5} 
              sx={{ mt: 1, mb: 2 }}
            />
            <Typography variant="caption" align="center" display="block" color="text.secondary">
              This process may take 2-3 minutes to extract data from ChatGPT, generate the document, and create PDFs of all referenced sources.
            </Typography>
          </Box>
        )}
        
        {/* Document Dialog */}
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
            {tabValue === 0 ? 'ERC Protest Package' : 'Form 886-A Substantiation Package'}
            <IconButton
              aria-label="copy"
              onClick={copyToClipboard}
              sx={{ position: 'absolute', right: 16, top: 8 }}
            >
              {copied ? <CheckCircle color="success" /> : <ContentCopy />}
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ flexGrow: 1, overflow: 'auto' }}>
            {packageData && (
              <Box mb={3}>
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1">
                    {tabValue === 0 ? 'Complete protest package' : 'Form 886-A package'} generated successfully!
                  </Typography>
                  <Typography variant="body2">
                    Your package includes the {tabValue === 0 ? 'protest letter' : 'Form 886-A document'} and {packageData.attachments.length} PDF attachments 
                    of the referenced sources. You can download the complete package below.
                  </Typography>
                </Alert>
                
                <Box display="flex" justifyContent="center" mt={2} mb={3}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<FileDownload />}
                    onClick={downloadPackage}
                    sx={{ minWidth: 240 }}
                  >
                    Download Complete Package
                  </Button>
                </Box>
                
                {packageData.attachments.length > 0 && (
                  <Box mt={3} mb={2}>
                    <Typography variant="subtitle1" gutterBottom>
                      Attachments Created:
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <ol>
                        {packageData.attachments.map((attachment, index) => (
                          <li key={index}>
                            <Typography variant="body2">
                              {attachment.filename} 
                              <Typography variant="caption" component="span" color="text.secondary" sx={{ ml: 1 }}>
                                (from {attachment.originalUrl})
                              </Typography>
                            </Typography>
                          </li>
                        ))}
                      </ol>
                    </Paper>
                  </Box>
                )}
              </Box>
            )}
            
            <Typography variant="subtitle1" gutterBottom>
              {tabValue === 0 ? 'Protest Letter Preview:' : 'Form 886-A Preview:'}
            </Typography>
            <TextField
              fullWidth
              multiline
              variant="outlined"
              value={documentContent}
              InputProps={{
                readOnly: true,
                sx: { 
                  fontFamily: 'monospace', 
                  fontSize: '0.9rem'
                }
              }}
              minRows={15}
              maxRows={30}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={copyToClipboard} startIcon={copied ? <CheckCircle /> : <ContentCopy />}>
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
            <Button 
              onClick={downloadPackage} 
              variant="contained" 
              color="primary"
              startIcon={<FileDownload />}
            >
              Download Package
            </Button>
            <Button onClick={handleCloseDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
};

export default ERCDocumentGenerator;