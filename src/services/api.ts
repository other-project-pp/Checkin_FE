import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3600",
  headers: {
    "ngrok-skip-browser-warning": "1",
  },
  timeout: 25000,
});

// optional: if you later add whitelist token/header etc.
// api.interceptors.request.use((config) => {
//   config.headers["x-admin-token"] = "....";
//   return config;
// });
