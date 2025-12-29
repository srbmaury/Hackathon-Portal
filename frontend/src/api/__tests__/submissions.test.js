import { describe, it, expect, vi } from 'vitest';
import * as submissionsApi from '../submissions';
import API from '../apiConfig';

vi.mock('../apiConfig');

const token = 'test-token';
const roundId = 'round-1';
const submissionData = { score: 100 };
const submissionId = 'sub-1';
const updateData = { score: 200 };

API.post.mockResolvedValue({ data: 'post-data' });
API.get.mockResolvedValue({ data: 'get-data' });
API.put.mockResolvedValue({ data: 'put-data' });


describe('submissions API', () => {
  it('submitForRound calls API.post', async () => {
    const data = await submissionsApi.submitForRound(roundId, submissionData, token);
    expect(API.post).toHaveBeenCalledWith(`/submissions/${roundId}`, submissionData, expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${token}` }) }));
    expect(data).toBe('post-data');
  });
  it('getMySubmission calls API.get', async () => {
    const data = await submissionsApi.getMySubmission(roundId, token);
    expect(API.get).toHaveBeenCalledWith(`/submissions/${roundId}/my`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('get-data');
  });
  it('getAllSubmissions calls API.get', async () => {
    const data = await submissionsApi.getAllSubmissions(roundId, token);
    expect(API.get).toHaveBeenCalledWith(`/submissions/${roundId}/all`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('get-data');
  });
  it('getStandings calls API.get', async () => {
    const data = await submissionsApi.getStandings(roundId, token);
    expect(API.get).toHaveBeenCalledWith(`/submissions/${roundId}/standings`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('get-data');
  });
  it('updateSubmission calls API.put', async () => {
    const data = await submissionsApi.updateSubmission(submissionId, updateData, token);
    expect(API.put).toHaveBeenCalledWith(`/submissions/${submissionId}`, updateData, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('put-data');
  });
  it('evaluateSubmission calls API.post with correct params', async () => {
    const submissionId = 'sub-1';
    API.post.mockResolvedValue({ data: 'evaluate-submission-data' });
    const data = await submissionsApi.evaluateSubmission(submissionId, token);
    expect(API.post).toHaveBeenCalledWith(
      `/submissions/${submissionId}/evaluate`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(data).toBe('evaluate-submission-data');
  });

  it('generateSubmissionFeedback calls API.post with correct params', async () => {
    const submissionId = 'sub-1';
    const score = 95;
    API.post.mockResolvedValue({ data: 'feedback-data' });
    const data = await submissionsApi.generateSubmissionFeedback(submissionId, score, token);
    expect(API.post).toHaveBeenCalledWith(
      `/submissions/${submissionId}/generate-feedback`,
      { score },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(data).toBe('feedback-data');
  });

  it('compareSubmissions calls API.get with correct params', async () => {
    const roundId = 'round-1';
    API.get.mockResolvedValue({ data: 'compare-data' });
    const data = await submissionsApi.compareSubmissions(roundId, token);
    expect(API.get).toHaveBeenCalledWith(
      `/submissions/${roundId}/compare`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(data).toBe('compare-data');
  });

  it('submitForRound does NOT set Content-Type when submissionData is FormData', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.txt');

    API.post.mockResolvedValue({ data: 'post-data' });

    const data = await submissionsApi.submitForRound(roundId, formData, token);

    expect(API.post).toHaveBeenCalledWith(
      `/submissions/${roundId}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    expect(data).toBe('post-data');
  });
});
