import { describe, it, expect, vi } from 'vitest';
import * as notificationsApi from '../notifications';
import API from '../apiConfig';

vi.mock('../apiConfig');

const token = 'test-token';
const notificationId = 'notif-1';

API.get.mockResolvedValue({ data: 'get-data' });
API.patch.mockResolvedValue({ data: 'patch-data' });
API.delete.mockResolvedValue({ data: 'delete-data' });

describe('notifications API', () => {
  it('getNotifications calls API.get', async () => {
    const data = await notificationsApi.getNotifications({}, token);
    expect(API.get).toHaveBeenCalledWith('/notifications', { params: { limit: 50, unreadOnly: false }, headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('get-data');
  });
  it('markNotificationAsRead calls API.patch', async () => {
    const data = await notificationsApi.markNotificationAsRead(notificationId, token);
    expect(API.patch).toHaveBeenCalledWith(`/notifications/${notificationId}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('patch-data');
  });
  it('markAllNotificationsAsRead calls API.patch', async () => {
    const data = await notificationsApi.markAllNotificationsAsRead(token);
    expect(API.patch).toHaveBeenCalledWith('/notifications/read-all', {}, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('patch-data');
  });
  it('deleteNotification calls API.delete', async () => {
    const data = await notificationsApi.deleteNotification(notificationId, token);
    expect(API.delete).toHaveBeenCalledWith(`/notifications/${notificationId}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('delete-data');
  });
  it('getUnreadCount calls API.get', async () => {
    const data = await notificationsApi.getUnreadCount(token);
    expect(API.get).toHaveBeenCalledWith('/notifications/unread-count', { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('get-data');
  });
});
