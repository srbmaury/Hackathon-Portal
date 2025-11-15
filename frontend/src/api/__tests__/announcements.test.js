import { describe, it, expect, vi } from 'vitest';
import * as announcementsApi from '../announcements';
import API from '../apiConfig';

vi.mock('../apiConfig');

const token = 'test-token';
const announcement = { title: 'Test', message: 'Hello' };
const updatedAnnouncement = { title: 'Updated', message: 'World' };
const id = '123';
const hackathonId = 'hackathon-1';

API.get.mockResolvedValue({ data: 'get-data' });
API.post.mockResolvedValue({ data: 'post-data' });
API.put.mockResolvedValue({ data: 'put-data' });
API.delete.mockResolvedValue({ data: 'delete-data' });


describe('announcements API', () => {
  it('getAnnouncements calls API.get with correct params', async () => {
    const data = await announcementsApi.getAnnouncements(token, 2, 5);
    expect(API.get).toHaveBeenCalledWith('/announcements', {
      params: { page: 2, limit: 5 },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(data).toBe('get-data');
  });

  it('enhanceAnnouncement calls API.post with correct params', async () => {
    const data = await announcementsApi.enhanceAnnouncement(hackathonId, announcement.title, announcement.message, token);
    expect(API.post).toHaveBeenCalledWith(
      `/hackathons/${hackathonId}/announcements/enhance`,
      { title: announcement.title, message: announcement.message },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(data).toBe('post-data');
  });

  it('createAnnouncement calls API.post with correct params', async () => {
    const data = await announcementsApi.createAnnouncement(announcement, token);
    expect(API.post).toHaveBeenCalledWith('/announcements', announcement, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(data).toBe('post-data');
  });

  it('updateAnnouncement calls API.put with correct params', async () => {
    const data = await announcementsApi.updateAnnouncement(id, updatedAnnouncement, token);
    expect(API.put).toHaveBeenCalledWith(`/announcements/${id}`, updatedAnnouncement, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(data).toBe('put-data');
  });

  it('deleteAnnouncement calls API.delete with correct params', async () => {
    const data = await announcementsApi.deleteAnnouncement(id, token);
    expect(API.delete).toHaveBeenCalledWith(`/announcements/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(data).toBe('delete-data');
  });

  it('formatAnnouncement calls API.post with correct params', async () => {
    const data = await announcementsApi.formatAnnouncement(hackathonId, announcement.title, announcement.message, token);
    expect(API.post).toHaveBeenCalledWith(
      `/hackathons/${hackathonId}/announcements/format`,
      { title: announcement.title, message: announcement.message },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(data).toBe('post-data');
  });
});
