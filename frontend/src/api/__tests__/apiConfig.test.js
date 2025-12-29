import API from '../apiConfig';
import i18n from '../../i18n/i18n';

describe('API config', () => {
  it('should set the base URL correctly', () => {
    expect(API.defaults.baseURL).toBe(import.meta.env.VITE_API_URL || '/api');
  });

  it('should include Accept-Language header from i18n', async () => {
    i18n.language = 'te';

    const config = await API.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });

    expect(config.headers['Accept-Language']).toBe('te');
  });

  it('should fallback to "en" when i18n.language is not set', async () => {
    i18n.language = undefined;

    const config = await API.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });

    expect(config.headers['Accept-Language']).toBe('en');
  });

  it('should reject on request interceptor error', async () => {
    const error = new Error('Interceptor error');

    await expect(
      API.interceptors.request.handlers[0].rejected(error)
    ).rejects.toThrow('Interceptor error');
  });
});
