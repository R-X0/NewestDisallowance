import React, { useState } from 'react';
import { 
  Container, Box, TextField, MenuItem, Button, 
  Typography, Paper, Grid, Divider, CircularProgress 
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { FileUpload } from '@mui/icons-material';

const ERCProtestForm = () => {
  // State for form data
  const [formData, setFormData] = useState({
    businessName: '',
    ein: '',
    location: '',
    businessWebsite: '',
    naicsCode: '',
    timePeriod: '',
    additionalInfo: '',
    disallowanceReasons: ''
  });
  
  const [pdfFiles, setPdfFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  
  // Available quarters for selection
  const quarters = [
    'Q2 2020', 'Q3 2020', 'Q4 2020', 
    'Q1 2021', 'Q2 2021', 'Q3 2021', 'Q4 2021'
  ];
  
  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };
  
  // Handle file uploads
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setPdfFiles(files);
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Create FormData object for file upload
      const submitData = new FormData();
      
      // Append form field data
      Object.keys(formData).forEach(key => {
        submitData.append(key, formData[key]);
      });
      
      // Append files
      pdfFiles.forEach(file => {
        submitData.append('disallowanceNotices', file);
      });
      
      // Send to backend API
      const response = await fetch('/api/erc-protest/submit', {
        method: 'POST',
        body: submitData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setSubmissionStatus({
          success: true,
          message: 'Submission successful. Processing has begun.',
          data: result
        });
      } else {
        throw new Error(result.message || 'Submission failed');
      }
    } catch (error) {
      setSubmissionStatus({
        success: false,
        message: `Error: ${error.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>
            ERC Disallowance Protest Generator
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Business Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Business Information
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Business Name"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="EIN"
                  name="ein"
                  value={formData.ein}
                  onChange={handleInputChange}
                  placeholder="XX-XXXXXXX"
                  inputProps={{
                    pattern: "[0-9]{2}-[0-9]{7}",
                    title: "EIN format: XX-XXXXXXX"
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Business Location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="City, State"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Business Website"
                  name="businessWebsite"
                  value={formData.businessWebsite}
                  onChange={handleInputChange}
                  placeholder="https://example.com"
                  type="url"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="NAICS Code"
                  name="naicsCode"
                  value={formData.naicsCode}
                  onChange={handleInputChange}
                  placeholder="6-digit NAICS Code"
                  inputProps={{
                    pattern: "[0-9]{6}",
                    title: "6-digit NAICS code"
                  }}
                />
              </Grid>
              
              {/* Time Period */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Claim Information
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  select
                  label="Time Period"
                  name="timePeriod"
                  value={formData.timePeriod}
                  onChange={handleInputChange}
                >
                  {quarters.map((quarter) => (
                    <MenuItem key={quarter} value={quarter}>
                      {quarter}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Additional Information"
                  name="additionalInfo"
                  value={formData.additionalInfo}
                  onChange={handleInputChange}
                  placeholder="Any additional details about the business operation during COVID..."
                />
              </Grid>
              
              {/* Disallowance Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Disallowance Information
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Disallowance Reasons"
                  name="disallowanceReasons"
                  value={formData.disallowanceReasons}
                  onChange={handleInputChange}
                  placeholder="Describe the reasons for disallowance mentioned in the IRS notice..."
                />
              </Grid>
              
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<FileUpload />}
                  sx={{ mt: 1 }}
                >
                  Upload Disallowance Notices (PDF)
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    hidden
                    onChange={handleFileUpload}
                  />
                </Button>
                {pdfFiles.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {pdfFiles.length} file(s) selected
                  </Typography>
                )}
              </Grid>
              
              {/* Submit Button */}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting}
                  sx={{ mt: 2 }}
                >
                  {isSubmitting ? (
                    <>
                      <CircularProgress size={24} sx={{ mr: 1 }} />
                      Processing...
                    </>
                  ) : 'Generate ERC Protest Package'}
                </Button>
              </Grid>
            </Grid>
          </form>
          
          {submissionStatus && (
            <Box mt={3} p={2} bgcolor={submissionStatus.success ? 'success.light' : 'error.light'} borderRadius={1}>
              <Typography variant="body1">
                {submissionStatus.message}
              </Typography>
              {submissionStatus.success && submissionStatus.data?.trackingId && (
                <Typography variant="body2" mt={1}>
                  Tracking ID: {submissionStatus.data.trackingId}
                </Typography>
              )}
            </Box>
          )}
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default ERCProtestForm;