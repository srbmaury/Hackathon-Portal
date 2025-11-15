import { describe, it, expect, vi } from 'vitest';
import * as remindersApi from '../reminders';
import API from '../apiConfig';

vi.mock('../apiConfig');

const token = 'test-token';
const teamId = 'team-1';
const roundId = 'round-1';
const threshold = 75;

API.get.mockResolvedValue({ data: 'get-data' });
API.post.mockResolvedValue({ data: 'post-data' });

describe('reminders API', () => {
  it('analyzeTeamRisk calls API.get', async () => {
    const data = await remindersApi.analyzeTeamRisk(teamId, roundId, token);
    expect(API.get).toHaveBeenCalledWith(`/reminders/team/${teamId}/round/${roundId}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('get-data');
  });
  it('getAtRiskTeams calls API.get', async () => {
    const data = await remindersApi.getAtRiskTeams(roundId, threshold, token);
    expect(API.get).toHaveBeenCalledWith(`/reminders/round/${roundId}/at-risk?threshold=${threshold}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('get-data');
  });
  it('sendReminder calls API.post', async () => {
    const data = await remindersApi.sendReminder(teamId, roundId, token);
    expect(API.post).toHaveBeenCalledWith(`/reminders/team/${teamId}/round/${roundId}/send`, {}, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('post-data');
  });
});
