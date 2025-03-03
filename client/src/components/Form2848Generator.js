import React, { useState } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import { FileDownload } from '@mui/icons-material';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const SimpleForm2848Generator = ({ formData }) => {
  const [loading, setLoading] = useState(false);

  const generateForm2848 = async () => {
    if (!formData.businessName || !formData.ein || !formData.location) {
      alert('Business information is incomplete. Please fill all required fields.');
      return;
    }

    setLoading(true);
    try {
      // Fetch the blank Form 2848 template
      const formUrl = '/api/erc-protest/templates/f2848.pdf';
      const formBytes = await fetch(formUrl).then(res => res.arrayBuffer());
      
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(formBytes);
      const form = pdfDoc.getForm();
      
      // Fill in the taxpayer information
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
      
    } catch (err) {
      console.error('Error generating Form 2848:', err);
      alert('Failed to generate Form 2848. Please try again.');
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
    </Box>
  );
};

export default SimpleForm2848Generator;