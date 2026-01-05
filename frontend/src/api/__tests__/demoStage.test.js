import * as demoStage from '../demoStage';
import API from '../apiConfig';

import { vi } from 'vitest';

describe('demoStage API', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uploadDemoVideo calls API.post with correct params', async () => {
    const postMock = vi.spyOn(API, 'post').mockResolvedValue({ data: { success: true } });
    const blob = new Blob(['test'], { type: 'video/webm' });
    const result = await demoStage.uploadDemoVideo({ token: 'tok', sessionId: 'sid', blob });
    expect(postMock).toHaveBeenCalledWith(
      '/demo-stage/upload-video',
      expect.any(FormData),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    );
    expect(result).toEqual({ success: true });
  });

  it('editDemoSession calls API.patch with correct params', async () => {
    const patchMock = vi.spyOn(API, 'patch').mockResolvedValue({ data: { ok: 1 } });
    await demoStage.editDemoSession({ token: 'tok', sessionId: 'sid', startTime: 1, endTime: 2, round: 'r' });
    expect(patchMock).toHaveBeenCalledWith(
      '/demo-stage/sessions/sid',
      { startTime: 1, endTime: 2, round: 'r' },
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    );
  });

  it('aiGenerateSchedulePreview calls API.post with correct params', async () => {
    const postMock = vi.spyOn(API, 'post').mockResolvedValue({ data: { preview: true } });
    await demoStage.aiGenerateSchedulePreview({ token: 'tok', hackathonId: 'hid', roundId: 'rid', prompt: 'p' });
    expect(postMock).toHaveBeenCalledWith(
      '/demo-stage/sessions/ai-generate-preview',
      { hackathonId: 'hid', roundId: 'rid', prompt: 'p' },
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    );
  });

  it('aiConfirmSchedule calls API.post with correct params', async () => {
    const postMock = vi.spyOn(API, 'post').mockResolvedValue({ data: { confirmed: true } });
    await demoStage.aiConfirmSchedule({ token: 'tok', hackathonId: 'hid', roundId: 'rid', schedule: [] });
    expect(postMock).toHaveBeenCalledWith(
      '/demo-stage/sessions/ai-generate-confirm',
      { hackathonId: 'hid', roundId: 'rid', schedule: [] },
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    );
  });

  it('fetchDemoSessions calls API.get with correct params', async () => {
    const getMock = vi.spyOn(API, 'get').mockResolvedValue({ data: { sessions: [] } });
    await demoStage.fetchDemoSessions({ token: 'tok', hackathonId: 'hid' });
    expect(getMock).toHaveBeenCalledWith(
      '/demo-stage/sessions/hid',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    );
  });

  it('createDemoSession calls API.post with correct params', async () => {
    const postMock = vi.spyOn(API, 'post').mockResolvedValue({ data: { session: {} } });
    await demoStage.createDemoSession({ token: 'tok', payload: { foo: 'bar' } });
    expect(postMock).toHaveBeenCalledWith(
      '/demo-stage/sessions',
      { foo: 'bar' },
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    );
  });

  it('editDemoSessionVideo calls API.patch with correct params', async () => {
    const patchMock = vi.spyOn(API, 'patch').mockResolvedValue({ data: { ok: 1 } });
    await demoStage.editDemoSessionVideo({ token: 'tok', sessionId: 'sid', videoUrl: 'url', videoVisibility: 'public' });
    expect(patchMock).toHaveBeenCalledWith(
      '/demo-stage/sessions/sid',
      { videoUrl: 'url', videoVisibility: 'public' },
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    );
  });

  it('deleteDemoSession calls API.delete with correct params', async () => {
    const deleteMock = vi.spyOn(API, 'delete').mockResolvedValue({ data: { ok: 1 } });
    await demoStage.deleteDemoSession({ token: 'tok', sessionId: 'sid' });
    expect(deleteMock).toHaveBeenCalledWith(
      '/demo-stage/sessions/sid',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    );
  });

  it('changeDemoSessionStage calls API.patch with correct params', async () => {
    const patchMock = vi.spyOn(API, 'patch').mockResolvedValue({ data: { ok: 1 } });
    await demoStage.changeDemoSessionStage({ token: 'tok', sessionId: 'sid', stage: 'review' });
    expect(patchMock).toHaveBeenCalledWith(
      '/demo-stage/sessions/sid',
      { stage: 'review' },
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    );
  });
});
