import { env } from '@/config/env';
import { useUserStore } from '@/stores';
import Axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const baseUrl = env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001/api/v1/';

const axiosOptions = {
  baseURL: baseUrl,
  timeout: 60000 * 5, // 5 minutes
  headers: {
    'Content-Type': 'application/json'
  },
  maxContentLength: 1024 * 1024 * 1024, // 1GB limit
  maxBodyLength: 1024 * 1024 * 1024 // 1GB limit
};

const getCurrentAccessToken = async () => {
  const token = useUserStore.getState().jwt;
  if (!token) {
    return null;
  }

  return token;
};

export const httpClient = Axios.create(axiosOptions);

// Request interceptor to add token to request headers
httpClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getCurrentAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for global error handling
httpClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      useUserStore.getState().clear();
    }

    return Promise.reject(error);
  }
);
