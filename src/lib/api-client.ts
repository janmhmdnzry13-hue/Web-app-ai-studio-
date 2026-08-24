import { APP_CONSTANTS } from '../config/constants';
import { safeStorage } from './storage';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
  };
}

class ApiClient {
  private getAuthToken(): string | null {
    const directToken = safeStorage.get<string | null>(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, null);
    if (directToken) return directToken;

    const session = safeStorage.get<{ token?: string } | null>(APP_CONSTANTS.STORAGE_KEYS.USER_SESSION, null);
    return session?.token || null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const json = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: json.error || { code: `HTTP_${response.status}`, message: response.statusText || 'Request failed.' },
        };
      }

      return json;
    } catch (err: any) {
      console.warn(`[ApiClient] Network or parsing error on ${endpoint}:`, err);
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: err.message || 'Unable to connect to server.' },
      };
    }
  }

  public async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
