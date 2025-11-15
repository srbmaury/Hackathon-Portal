import { describe, it, expect, vi } from 'vitest';
import * as registrationsApi from '../registrations';
import API from '../apiConfig';

vi.mock('../apiConfig');

const token = 'test-token';
const hackathonId = 'hackathon-1';
const teamId = 'team-1';
const registrationData = { name: 'Team' };
const updateData = { name: 'Updated Team' };

API.post.mockResolvedValue({ data: 'post-data' });
API.get.mockResolvedValue({ data: 'get-data' });
API.delete.mockResolvedValue({ data: 'delete-data' });
API.put.mockResolvedValue({ data: 'put-data' });

describe('registrations API', () => {
  it('registerForHackathon calls API.post', async () => {
    const data = await registrationsApi.registerForHackathon(hackathonId, registrationData, token);
    expect(API.post).toHaveBeenCalledWith(`/register/${hackathonId}/register`, registrationData, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('post-data');
  });
  it('getMyTeam calls API.get', async () => {
    const data = await registrationsApi.getMyTeam(hackathonId, token);
    expect(API.get).toHaveBeenCalledWith(`/register/${hackathonId}/my`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('get-data');
  });
  it('withdrawTeam calls API.delete', async () => {
    const data = await registrationsApi.withdrawTeam(hackathonId, teamId, token);
    expect(API.delete).toHaveBeenCalledWith(`/register/${hackathonId}/teams/${teamId}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('delete-data');
  });
  it('getMyTeams calls API.get', async () => {
    const data = await registrationsApi.getMyTeams(token);
    expect(API.get).toHaveBeenCalledWith('/register/my-teams', { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('get-data');
  });
  it('updateTeam calls API.put', async () => {
    const data = await registrationsApi.updateTeam(hackathonId, teamId, updateData, token);
    expect(API.put).toHaveBeenCalledWith(`/register/${hackathonId}/teams/${teamId}`, updateData, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('put-data');
  });
  it('getHackathonTeams calls API.get with correct params', async () => {
    const hackathonId = 'hackathon-1';
    API.get.mockResolvedValue({ data: 'public-teams-data' });
    const data = await registrationsApi.getHackathonTeams(hackathonId, token);
    expect(API.get).toHaveBeenCalledWith(`/register/${hackathonId}/teams/public`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('public-teams-data');
  });
});
