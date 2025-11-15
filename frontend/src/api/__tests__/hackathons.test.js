
import { describe, it, expect, vi } from 'vitest';
vi.mock('../apiConfig');
import * as hackathonsApi from '../hackathons';
import API from '../apiConfig';

const token = 'test-token';
const hackathon = { name: 'Test Hackathon' };
const updatedHackathon = { name: 'Updated Hackathon' };
const id = '123';

API.post.mockResolvedValue({ data: 'post-data' });
API.get.mockResolvedValue({ data: 'get-data' });
API.put.mockResolvedValue({ data: 'put-data' });
API.delete.mockResolvedValue({ data: 'delete-data' });

describe('hackathons API', () => {
  it('createHackathon calls API.post with correct params', async () => {
    const data = await hackathonsApi.createHackathon(hackathon, token);
    expect(API.post).toHaveBeenCalledWith('/hackathons', hackathon, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(data).toBe('post-data');
  });

  it('getAllHackathons calls API.get with correct params', async () => {
    const data = await hackathonsApi.getAllHackathons(token);
    expect(API.get).toHaveBeenCalledWith('/hackathons', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(data).toBe('get-data');
  });

  it('getHackathonById calls API.get with correct params', async () => {
    const data = await hackathonsApi.getHackathonById(id, token);
    expect(API.get).toHaveBeenCalledWith(`/hackathons/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(data).toBe('get-data');
  });

  it('updateHackathon calls API.put with correct params', async () => {
    const data = await hackathonsApi.updateHackathon(id, updatedHackathon, token);
    expect(API.put).toHaveBeenCalledWith(`/hackathons/${id}`, updatedHackathon, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(data).toBe('put-data');
  });

    it('getHackathonAnnouncements calls API.get with correct params', async () => {
      const hackathonId = 'hackathon-1';
      const page = 2;
      const limit = 5;
      API.get.mockResolvedValue({ data: 'announcements-data' });
      const data = await hackathonsApi.getHackathonAnnouncements(hackathonId, token, page, limit);
      expect(API.get).toHaveBeenCalledWith(
        `/hackathons/${hackathonId}/announcements`,
        { params: { page, limit }, headers: { Authorization: `Bearer ${token}` } }
      );
      expect(data).toBe('announcements-data');
    });

    it('createHackathonAnnouncement calls API.post with correct params', async () => {
      const hackathonId = 'hackathon-1';
      const announcement = { title: 'Title', message: 'Message' };
      API.post.mockResolvedValue({ data: 'create-announcement-data' });
      const data = await hackathonsApi.createHackathonAnnouncement(hackathonId, announcement, token);
      expect(API.post).toHaveBeenCalledWith(
        `/hackathons/${hackathonId}/announcements`,
        announcement,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(data).toBe('create-announcement-data');
    });

    it('updateHackathonAnnouncement calls API.put with correct params', async () => {
      const hackathonId = 'hackathon-1';
      const announcementId = 'announcement-1';
      const announcement = { title: 'Updated', message: 'Updated Message' };
      API.put.mockResolvedValue({ data: 'update-announcement-data' });
      const data = await hackathonsApi.updateHackathonAnnouncement(hackathonId, announcementId, announcement, token);
      expect(API.put).toHaveBeenCalledWith(
        `/hackathons/${hackathonId}/announcements/${announcementId}`,
        announcement,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(data).toBe('update-announcement-data');
    });

    it('deleteHackathonAnnouncement calls API.delete with correct params', async () => {
      const hackathonId = 'hackathon-1';
      const announcementId = 'announcement-1';
      API.delete.mockResolvedValue({ data: 'delete-announcement-data' });
      const data = await hackathonsApi.deleteHackathonAnnouncement(hackathonId, announcementId, token);
      expect(API.delete).toHaveBeenCalledWith(
        `/hackathons/${hackathonId}/announcements/${announcementId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(data).toBe('delete-announcement-data');
    });

    it('addHackathonRole calls API.post with correct params', async () => {
      const hackathonId = 'hackathon-1';
      const userId = 'user-1';
      const role = 'mentor';
      API.post.mockResolvedValue({ data: 'add-role-data' });
      const data = await hackathonsApi.addHackathonRole(hackathonId, userId, role, token);
      expect(API.post).toHaveBeenCalledWith(
        `/hackathons/${hackathonId}/roles`,
        { userId, role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(data).toBe('add-role-data');
    });

    it('removeHackathonRole calls API.delete with correct params', async () => {
      const hackathonId = 'hackathon-1';
      const userId = 'user-1';
      API.delete.mockResolvedValue({ data: 'remove-role-data' });
      const data = await hackathonsApi.removeHackathonRole(hackathonId, userId, token);
      expect(API.delete).toHaveBeenCalledWith(
        `/hackathons/${hackathonId}/roles/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(data).toBe('remove-role-data');
    });

    it('getHackathonMembers calls API.get with correct params', async () => {
      const hackathonId = 'hackathon-1';
      API.get.mockResolvedValue({ data: 'members-data' });
      const data = await hackathonsApi.getHackathonMembers(hackathonId, token);
      expect(API.get).toHaveBeenCalledWith(
        `/hackathons/${hackathonId}/members`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(data).toBe('members-data');
    });

    it('getMyHackathonRole calls API.get with correct params', async () => {
      const hackathonId = 'hackathon-1';
      API.get.mockResolvedValue({ data: 'my-role-data' });
      const data = await hackathonsApi.getMyHackathonRole(hackathonId, token);
      expect(API.get).toHaveBeenCalledWith(
        `/hackathons/${hackathonId}/my-role`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(data).toBe('my-role-data');
    });
  it('deleteHackathon calls API.delete with correct params', async () => {
    API.delete.mockResolvedValue({ data: 'delete-data' });
    const data = await hackathonsApi.deleteHackathon(id, token);
    expect(API.delete).toHaveBeenCalledWith(`/hackathons/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(data).toBe('delete-data');
  });
  it('assignMentorsToTeams calls API.post with correct params', async () => {
    const hackathonId = 'hackathon-1';
    API.post.mockResolvedValue({ data: 'assign-mentors-data' });
    const data = await hackathonsApi.assignMentorsToTeams(hackathonId, token);
    expect(API.post).toHaveBeenCalledWith(
      `/hackathons/${hackathonId}/assign-mentors`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(data).toBe('assign-mentors-data');
  });

  it('formatHackathonDescription calls API.post with correct params', async () => {
    const title = 'Hackathon Title';
    const description = 'Hackathon Description';
    API.post.mockResolvedValue({ data: 'format-description-data' });
    const data = await hackathonsApi.formatHackathonDescription(title, description, token);
    expect(API.post).toHaveBeenCalledWith(
      '/hackathons/format',
      { title, description },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(data).toBe('format-description-data');
  });
  });

describe('hackathons API (AI suggestions)', () => {
  it('suggestRound calls API.post with correct params', async () => {
  const title = 'Round Title';
  const description = 'Round Description';
  const roundNumber = 2;
  const existingRounds = [{ name: 'Round 1' }];
  const hackathonStartDate = '2025-11-15';
  API.post.mockResolvedValue({ data: 'suggest-round-data' });
  const data = await hackathonsApi.suggestRound(title, description, roundNumber, existingRounds, hackathonStartDate, token);
  expect(API.post).toHaveBeenCalledWith(
    '/hackathons/suggest-round',
    { title, description, roundNumber, existingRounds, hackathonStartDate },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(data).toBe('suggest-round-data');
  });

  it('suggestRounds calls API.post with correct params', async () => {
  const title = 'Rounds Title';
  const description = 'Rounds Description';
  const numberOfRounds = 3;
  const hackathonStartDate = '2025-11-15';
  API.post.mockResolvedValue({ data: 'suggest-rounds-data' });
  const data = await hackathonsApi.suggestRounds(title, description, numberOfRounds, hackathonStartDate, token);
  expect(API.post).toHaveBeenCalledWith(
    '/hackathons/suggest-rounds',
    { title, description, numberOfRounds, hackathonStartDate },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(data).toBe('suggest-rounds-data');
  });
});
