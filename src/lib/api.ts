// src/lib/api.ts
import axios from "axios";

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE,
   withCredentials: true,
});

// Attach token automatically to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Optional: handle 401 globally (auto logout)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      // token invalid/expired
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    return Promise.reject(err);
  }
);

export default api;