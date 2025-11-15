import { describe, it, expect, vi } from 'vitest';
import * as messagesApi from '../messages';
import API from '../apiConfig';

vi.mock('../apiConfig');

const token = 'test-token';
const teamId = 'team-1';
const content = 'Hello';

API.get.mockResolvedValue({ data: 'get-data' });
API.post.mockResolvedValue({ data: 'post-data' });

describe('messages API', () => {
  it('getTeamMessages calls API.get', async () => {
    const data = await messagesApi.getTeamMessages(teamId, token);
    expect(API.get).toHaveBeenCalledWith(`/teams/${teamId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('get-data');
  });
  it('sendTeamMessage calls API.post', async () => {
    const data = await messagesApi.sendTeamMessage(teamId, content, token);
    expect(API.post).toHaveBeenCalledWith(`/teams/${teamId}/messages`, { content }, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('post-data');
  });
  it('generateMeetingSummary calls API.post', async () => {
    const data = await messagesApi.generateMeetingSummary(teamId, token);
    expect(API.post).toHaveBeenCalledWith(`/teams/${teamId}/messages/summary`, {}, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('post-data');
  });
});
