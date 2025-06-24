import axios, { AxiosInstance, AxiosRequestConfig, Method } from 'axios';

const STORAGE_CREDENTIAL_NAME = 'bangumi-list-v3-credential';

class APIClient {
  private instance: AxiosInstance;
  private credential: string | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: '/api/v1',
      timeout: 10000,
    });

    // Load credential from localStorage
    this.loadCredential();

    // Request interceptor to add auth header
    this.instance.interceptors.request.use((config) => {
      if (this.credential) {
        config.headers.Authorization = `Bearer ${this.credential}`;
      }
      return config;
    });

    // Response interceptor to handle auth errors
    this.instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.removeCredential();
        }
        return Promise.reject(error);
      }
    );
  }

  async request<T>(
    method: Method,
    url: string,
    params?: Record<string, unknown>,
    data?: Record<string, unknown>,
    requireAuth = false
  ): Promise<T> {
    if (requireAuth && !this.credential) {
      throw new Error('Authentication required');
    }

    const config: AxiosRequestConfig = {
      method,
      url,
      params,
      data,
    };

    const response = await this.instance.request<T>(config);
    return response.data;
  }

  setCredential(token: string): void {
    this.credential = token;
  }

  saveCredential(skipSave = false): void {
    if (!skipSave && this.credential) {
      localStorage.setItem(STORAGE_CREDENTIAL_NAME, this.credential);
    }
  }

  loadCredential(): void {
    const token = localStorage.getItem(STORAGE_CREDENTIAL_NAME);
    if (token) {
      this.credential = token;
    }
  }

  removeCredential(): void {
    this.credential = null;
    localStorage.removeItem(STORAGE_CREDENTIAL_NAME);
  }

  hasCredential(): boolean {
    return !!this.credential;
  }
}

export const apiClient = new APIClient();
