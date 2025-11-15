import { describe, it, expect, vi } from 'vitest';
import * as authApi from '../auth';
import API from '../apiConfig';

vi.mock('../apiConfig');

API.post.mockResolvedValue({ data: 'login-data' });

describe('auth API', () => {
  it('googleLogin calls API.post with correct params', async () => {
    const idToken = 'test-id-token';
    const data = await authApi.googleLogin(idToken);
    expect(API.post).toHaveBeenCalledWith('/auth/google-login', { token: idToken });
    expect(data).toBe('login-data');
  });
});
