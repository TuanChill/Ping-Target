import { API_URL } from '@/constants/api';
import { httpClient } from '@/services/http';
import type { User } from '@/types/user';

/**
 * Get current user information
 */
export const getMe = async () => {
  const response = await httpClient.get<User>(API_URL.GET_ME);

  return response.data;
};

/**
 * Login user
 */
export const login = async (credentials: { email: string; password: string }) => {
  const response = await httpClient.post(`${API_URL.LOGIN || '/auth/login'}`, credentials);

  return response.data;
};

/**
 * Logout user
 */
export const logout = async () => {
  const response = await httpClient.post(`${API_URL.LOGOUT || '/auth/logout'}`);

  return response.data;
};

/**
 * Refresh access token
 */
export const refreshToken = async () => {
  const response = await httpClient.post(`${API_URL.REFRESH_TOKEN || '/auth/refresh'}`);

  return response.data;
};
