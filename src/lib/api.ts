// src/lib/api.ts
import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 15000,
});

// Attach token automatically to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Server responded with a status
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        console.error("Unauthorized: token may be expired or invalid.");
      }

      console.error("API Error:", {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url,
      });
    }
    // Request made but no response received
    else if (error.request) {
      console.error("Network Error: No response received from server.", {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
      });
    }
    // Something else happened
    else {
      console.error("Axios Error:", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;