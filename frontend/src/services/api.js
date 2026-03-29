import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token from storage on init
const token = localStorage.getItem('ef_token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ef_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
