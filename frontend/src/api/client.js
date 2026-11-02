import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((request) => {
  const token = sessionStorage.getItem("shortly.accessToken");
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url ?? "";
    if (error.response?.status === 401 && !requestUrl.startsWith("/auth/")) {
      window.dispatchEvent(new Event("shortly:auth-expired"));
    }
    return Promise.reject(error);
  }
);

export default api;
