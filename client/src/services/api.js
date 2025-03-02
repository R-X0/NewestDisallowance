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

// New function to generate an ERC protest letter
export const generateERCProtestLetter = async (letterData) => {
  const response = await axios.post(
    `${API_URL}/erc-protest/letter/generate-letter`,
    letterData,
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
};