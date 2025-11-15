import { describe, it, expect, vi } from 'vitest';
import * as usersApi from '../users';
import API from '../apiConfig';

vi.mock('../apiConfig');

const token = 'test-token';
const userId = 'user-1';
const role = 'admin';
const profileData = { name: 'User' };

API.get.mockResolvedValue({ data: { users: ['user1', 'user2'], user: 'me' } });
API.put.mockResolvedValue({ data: 'put-data' });

describe('users API', () => {
  it('getUsers calls API.get', async () => {
    API.get.mockResolvedValue({ data: { users: ['user1', 'user2'] } });
    const data = await usersApi.getUsers(token);
    expect(API.get).toHaveBeenCalledWith('/users', { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toEqual(['user1', 'user2']);
  });

  it('getUsers returns [] if users is undefined', async () => {
    API.get.mockResolvedValue({ data: {} });
    const data = await usersApi.getUsers(token);
    expect(data).toEqual([]);
  });
  it('getAllUsers is alias for getUsers', async () => {
    API.get.mockResolvedValue({ data: { users: ['user1', 'user2'] } });
    const data = await usersApi.getAllUsers(token);
    expect(API.get).toHaveBeenCalledWith('/users', { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toEqual(['user1', 'user2']);
  });
  it('updateUserRole calls API.put', async () => {
    const data = await usersApi.updateUserRole(userId, role, token);
    expect(API.put).toHaveBeenCalledWith(`/users/${userId}/role`, { role }, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('put-data');
  });
  it('getUsersWithHackathonRoles calls API.get', async () => {
    API.get.mockResolvedValue({ data: { users: ['user1', 'user2'] } });
    const data = await usersApi.getUsersWithHackathonRoles(token);
    expect(API.get).toHaveBeenCalledWith('/users/with-roles', { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toEqual(['user1', 'user2']);
  });

  it('getUsersWithHackathonRoles returns [] if users is undefined', async () => {
    API.get.mockResolvedValue({ data: {} });
    const data = await usersApi.getUsersWithHackathonRoles(token);
    expect(data).toEqual([]);
  });
  it('getMyProfile calls API.get', async () => {
    API.get.mockResolvedValue({ data: { user: 'me' } });
    const data = await usersApi.getMyProfile(token);
    expect(API.get).toHaveBeenCalledWith('/users/me', { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('me');
  });
  it('updateMyProfile calls API.put', async () => {
    await usersApi.updateMyProfile(profileData, token);
    expect(API.put).toHaveBeenCalledWith('/users/me', profileData, { headers: { Authorization: `Bearer ${token}` } });
  });

  it('updateNotificationPreferences calls API.put with correct params', async () => {
    const notificationsEnabled = true;
    API.put.mockResolvedValue({ data: { user: 'updated-user' } });
    const data = await usersApi.updateNotificationPreferences(notificationsEnabled, token);
    expect(API.put).toHaveBeenCalledWith('/users/me', { notificationsEnabled }, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('updated-user');
  });
});
