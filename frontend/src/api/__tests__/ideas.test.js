import { describe, it, expect, vi } from 'vitest';
import * as ideasApi from '../ideas';
import API from '../apiConfig';

vi.mock('../apiConfig');

const token = 'test-token';
const idea = { title: 'Idea', description: 'Desc' };
const updatedIdea = { title: 'Updated', description: 'Updated Desc' };
const id = '123';

API.get.mockResolvedValue({ data: { ideas: ['idea1', 'idea2'] } });
API.post.mockResolvedValue({ data: 'post-data' });
API.put.mockResolvedValue({ data: 'put-data' });
API.delete.mockResolvedValue({ data: 'delete-data' });

describe('ideas API', () => {
  it('getPublicIdeas calls API.get', async () => {
    const data = await ideasApi.getPublicIdeas(token);
    expect(API.get).toHaveBeenCalledWith('/ideas/public-ideas', { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toEqual(['idea1', 'idea2']);
  });
  it('getUserIdeas calls API.get', async () => {
    const data = await ideasApi.getUserIdeas(token);
    expect(API.get).toHaveBeenCalledWith('/ideas/my', { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toEqual(['idea1', 'idea2']);
  });
  it('submitIdea calls API.post', async () => {
    const data = await ideasApi.submitIdea(idea, token);
    expect(API.post).toHaveBeenCalledWith('/ideas/submit', idea, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('post-data');
  });
  it('editIdea calls API.put', async () => {
    const data = await ideasApi.editIdea(id, updatedIdea, token);
    expect(API.put).toHaveBeenCalledWith(`/ideas/${id}`, updatedIdea, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('put-data');
  });
  it('deleteIdea calls API.delete', async () => {
    const data = await ideasApi.deleteIdea(id, token);
    expect(API.delete).toHaveBeenCalledWith(`/ideas/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('delete-data');
  });
  it('evaluateIdea calls API.post with correct params', async () => {
    const ideaId = 'idea-1';
    API.post.mockResolvedValue({ data: 'evaluate-data' });
    const data = await ideasApi.evaluateIdea(ideaId, token);
    expect(API.post).toHaveBeenCalledWith(`/ideas/${ideaId}/evaluate`, {}, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('evaluate-data');
  });

  it('findSimilarIdeas calls API.get with correct params', async () => {
    const ideaId = 'idea-1';
    API.get.mockResolvedValue({ data: 'similar-data' });
    const data = await ideasApi.findSimilarIdeas(ideaId, token);
    expect(API.get).toHaveBeenCalledWith(`/ideas/${ideaId}/similar`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('similar-data');
  });

  it('getIdeaImprovements calls API.get with correct params', async () => {
    const ideaId = 'idea-1';
    API.get.mockResolvedValue({ data: 'improvements-data' });
    const data = await ideasApi.getIdeaImprovements(ideaId, token);
    expect(API.get).toHaveBeenCalledWith(`/ideas/${ideaId}/improvements`, { headers: { Authorization: `Bearer ${token}` } });
    expect(data).toBe('improvements-data');
  });
  it('getPublicIdeas returns [] if ideas is undefined', async () => {
    API.get.mockResolvedValue({ data: {} });
    const data = await ideasApi.getPublicIdeas(token);
    expect(data).toEqual([]);
  });

  it('getUserIdeas returns [] if ideas is undefined', async () => {
    API.get.mockResolvedValue({ data: {} });
    const data = await ideasApi.getUserIdeas(token);
    expect(data).toEqual([]);
  });
});
