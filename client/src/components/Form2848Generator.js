import React, { useState } from 'react';
import { Box, Button, CircularProgress, Alert, Snackbar } from '@mui/material';
import { FileDownload } from '@mui/icons-material';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const Form2848Generator = ({ formData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showError, setShowError] = useState(false);

  const generateForm2848 = async () => {
    if (!formData.businessName || !formData.ein || !formData.location) {
      setError('Business information is incomplete. Please fill all required fields.');
      setShowError(true);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Fetch the blank Form 2848 template with better error handling
      console.log('Fetching Form 2848 template...');
      const formUrl = '/api/erc-protest/templates/f2848.pdf';
      const response = await fetch(formUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
      }
      
      const formBytes = await response.arrayBuffer();
      console.log(`Received ${formBytes.byteLength} bytes of PDF data`);
      
      // Load the PDF document
      console.log('Loading PDF document...');
      const pdfDoc = await PDFDocument.load(formBytes, {
        ignoreEncryption: true,
      });
      console.log('PDF loaded successfully');
      
      const form = pdfDoc.getForm();
      
      // Fill in the taxpayer information
      console.log('Filling in form fields...');
      const taxpayerNameField = form.getTextField('topmostSubform[0].Page1[0].f1_1[0]');
      taxpayerNameField.setText(formData.businessName || '');
      
      const taxpayerAddressField = form.getTextField('topmostSubform[0].Page1[0].f1_3[0]');
      taxpayerAddressField.setText(formData.location || '');
      
      const taxpayerEINField = form.getTextField('topmostSubform[0].Page1[0].f1_2[0]');
      taxpayerEINField.setText(formData.ein || '');
      
      // Set tax matters (minimal hardcoded information)
      const taxMattersField = form.getTextField('topmostSubform[0].Page1[0].Line3[0].f1_13[0]');
      taxMattersField.setText('Employee Retention Credit (ERC) Disallowance Protest');
      
      const taxFormField = form.getTextField('topmostSubform[0].Page1[0].Line3[0].f1_14[0]');
      taxFormField.setText('Form 941');
      
      const taxYearsField = form.getTextField('topmostSubform[0].Page1[0].Line3[0].f1_15[0]');
      taxYearsField.setText(formData.timePeriod ? formData.timePeriod.substring(4) : '');
      
      if (formData.timePeriod) {
        const taxQuarterField = form.getTextField('topmostSubform[0].Page1[0].Line3[0].f1_16[0]');
        taxQuarterField.setText(formData.timePeriod.substring(0, 2));
      }
      
      // Save the filled form
      console.log('Saving filled form...');
      const pdfBytes = await pdfDoc.save();
      
      // Create a Blob and trigger download
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `Form_2848_${formData.businessName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('Download initiated');
      
    } catch (err) {
      console.error('Error generating Form 2848:', err);
      setError(`Error generating Form 2848: ${err.message}`);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="inline" ml={2}>
      <Button
        variant="outlined"
        color="primary"
        startIcon={loading ? <CircularProgress size={20} /> : <FileDownload />}
        onClick={generateForm2848}
        disabled={loading}
      >
        {loading ? 'Generating...' : 'Download Form 2848'}
      </Button>
      
      <Snackbar 
        open={showError} 
        autoHideDuration={6000} 
        onClose={() => setShowError(false)}
      >
        <Alert 
          onClose={() => setShowError(false)} 
          severity="error" 
          variant="filled"
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Form2848Generator;