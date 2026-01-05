import React, { useEffect, useState, useCallback } from "react";
import { getHackathonById } from "../api/hackathons";
import { useParams } from "react-router-dom";
import {
    Box,
    Typography,
    Button,
    Stack,
    Paper,
    CircularProgress,
    Chip,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    Switch,
    FormControlLabel
} from "@mui/material";
import { Add as AddIcon, VideoCall as VideoIcon, Edit as EditIcon, Delete as DeleteIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import {
    editDemoSession,
    aiGenerateSchedulePreview,
    aiConfirmSchedule,
    fetchDemoSessions,
    createDemoSession,
    editDemoSessionVideo,
    deleteDemoSession,
    changeDemoSessionStage
} from "../api/demoStage";
import WebRTCStreamRecorder from "./WebRTCStreamRecorder";


const DemoStagePage = ({ hackathonId: propHackathonId, myRole, teams = [] }) => {
    const { hackathonId: paramHackathonId } = useParams();
    const hackathonId = propHackathonId || paramHackathonId;
    const { t } = useTranslation();
    const { token, user } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSession, setActiveSession] = useState(null);
    const [rounds, setRounds] = useState([]);
    const [selectedRound, setSelectedRound] = useState("");

    // Session creation state
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [creating, setCreating] = useState(false);

    // Edit video dialog state
    const [editingSession, setEditingSession] = useState(null);
    const [showVideoDialog, setShowVideoDialog] = useState(false);
    const [editVideoUrl, setEditVideoUrl] = useState("");
    const [editVideoVisibility, setEditVideoVisibility] = useState("draft");
    const [savingVideo, setSavingVideo] = useState(false);

    // AI scheduling dialog state (must be inside component)
    const [showAIScheduleDialog, setShowAIScheduleDialog] = useState(false);
    const [aiPrompt, setAIPrompt] = useState("");
    const [aiSelectedRound, setAISelectedRound] = useState("");
    const [aiSchedulePreview, setAISchedulePreview] = useState([]);
    const [aiLoading, setAILoading] = useState(false);
    const [aiStep, setAIStep] = useState(1); // 1: prompt, 2: preview

    // Edit session dialog state
    const [showEditSessionDialog, setShowEditSessionDialog] = useState(false);
    const [editSessionData, setEditSessionData] = useState(null);

    const handleOpenEditSessionDialog = (session) => {
        setEditSessionData({ ...session });
        setShowEditSessionDialog(true);
    };

    const handleEditSessionChange = (field, value) => {
        setEditSessionData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveEditSession = async () => {
        if (!editSessionData) return;
        try {
            await editDemoSession({
                token,
                sessionId: editSessionData._id,
                startTime: editSessionData.startTime,
                endTime: editSessionData.endTime,
                round: editSessionData.round?._id || editSessionData.round,
            });
            toast.success(t("demo_stage.session_updated"));
            setShowEditSessionDialog(false);
            setEditSessionData(null);
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.error || t("demo_stage.session_update_failed"));
        }
    };


    // Judges have the same access as organizers
    const isOrganizer = myRole === "organizer" || myRole === "judge" || user?.role === "admin";

    // Filter state
    const [participantFilter, setParticipantFilter] = useState("all"); // 'all' or 'mine'
    const [organizerStage, setOrganizerStage] = useState("all"); // 'all', 'scheduled', 'live', 'completed'

    // Helper: is user a member of a team?
    function isUserTeamMember(team) {
        if (!user?._id || !team?.members) return false;
        return team.members.some(m => String(m._id || m) === String(user._id));
    }

    // Filtered sessions for display
    let filteredSessions = sessions;
    if (!isOrganizer) {
        // Participant: filter by all/mine
        if (participantFilter === "mine") {
            filteredSessions = sessions.filter(s => isUserTeamMember(s.team));
        }
    } else {
        // Organizer: filter by stage
        if (["scheduled", "live", "completed"].includes(organizerStage)) {
            filteredSessions = sessions.filter(s => s.stage === organizerStage);
        }
    }

    // Get teams that don't have a session for the selected round
    const availableTeams = teams.filter((team) => {
        if (!selectedRound) return true;
        return !sessions.some((s) => s.team?._id === team._id && s.round?._id === selectedRound);
    });

    // Helper to format ISO string to local datetime-local input value (YYYY-MM-DDTHH:mm)
    function formatLocalDateTime(isoString) {
        if (!isoString) return "";
        const d = new Date(isoString);
        const pad = n => n.toString().padStart(2, '0');
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const min = pad(d.getMinutes());
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    // AI scheduling handlers (must be inside component)
    const handleOpenAIScheduleDialog = () => {
        setShowAIScheduleDialog(true);
        setAIPrompt("");
        setAISelectedRound("");
        setAISchedulePreview([]);
        setAIStep(1);
    };

    const handleAIGeneratePreview = async () => {
        if (!aiPrompt || !aiSelectedRound) {
            toast.error(t("demo_stage.ai_prompt_required"));
            return;
        }
        setAILoading(true);
        try {
            const res = await aiGenerateSchedulePreview({
                token,
                hackathonId,
                roundId: aiSelectedRound,
                prompt: aiPrompt
            });
            setAISchedulePreview(res.data.schedule || []);
            setAIStep(2);
        } catch (err) {
            toast.error(err.response?.data?.error || t("demo_stage.ai_generate_failed"));
        } finally {
            setAILoading(false);
        }
    };

    const handleAIConfirmSchedule = async () => {
        setAILoading(true);
        try {
            await aiConfirmSchedule({
                token,
                hackathonId,
                roundId: aiSelectedRound,
                schedule: aiSchedulePreview
            });
            toast.success(t("demo_stage.sessions_scheduled"));
            setShowAIScheduleDialog(false);
            setAISchedulePreview([]);
            setAIPrompt("");
            setAISelectedRound("");
            setAIStep(1);
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.error || t("demo_stage.sessions_create_failed"));
        } finally {
            setAILoading(false);
        }
    };

    // Fetch demo sessions
    const fetchSessions = useCallback(async () => {
        if (!hackathonId) return;
        setLoading(true);
        try {
            const res = await fetchDemoSessions({ token, hackathonId });
            setSessions(res.data);
        } catch {
            setSessions([]);
        }
        setLoading(false);
    }, [hackathonId, token]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    // Fetch rounds for the hackathon
    useEffect(() => {
        const fetchRounds = async () => {
            if (!hackathonId) return;
            try {
                const data = await getHackathonById(hackathonId, token);
                setRounds(data.hackathon?.rounds || data.rounds || []);
            } catch {
                setRounds([]);
            }
        };
        fetchRounds();
    }, [hackathonId, token]);

    const handleCreateSession = async () => {
        if (!selectedTeam) {
            toast.error(t("demo_stage.select_team_required"));
            return;
        }
        if (!selectedRound) {
            toast.error(t("demo_stage.round_required"));
            return;
        }
        setCreating(true);
        try {
            const payload = {
                hackathon: hackathonId,
                team: selectedTeam,
                round: selectedRound,
                startTime: startTime || undefined,
                endTime: endTime || undefined,
                videoUrl: videoUrl || undefined,
            };
            await createDemoSession({ token, payload });
            toast.success(t("demo_stage.session_created"));
            setShowCreateDialog(false);
            setSelectedTeam("");
            setSelectedRound("");
            setStartTime("");
            setEndTime("");
            setVideoUrl("");
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.error || t("demo_stage.session_create_failed"));
        } finally {
            setCreating(false);
        }
    };

    const handleOpenVideoDialog = (session) => {
        setEditingSession(session);
        setEditVideoUrl(session.videoUrl || "");
        setEditVideoVisibility(session.videoVisibility || "draft");
        setShowVideoDialog(true);
    };

    const handleSaveVideo = async () => {
        if (!editingSession) return;
        setSavingVideo(true);
        try {
            await editDemoSessionVideo({
                token,
                sessionId: editingSession._id,
                videoUrl: editVideoUrl,
                videoVisibility: editVideoVisibility
            });
            toast.success(t("demo_stage.video_updated"));
            setShowVideoDialog(false);
            setEditingSession(null);
            setEditVideoUrl("");
            setEditVideoVisibility("draft");
            fetchSessions();
        } catch {
            toast.error(t("demo_stage.video_update_failed"));
        } finally {
            setSavingVideo(false);
        }
    };

    const handleDeleteSession = async (sessionId) => {
        if (!window.confirm(t("demo_stage.delete_confirm"))) return;
        try {
            await deleteDemoSession({ token, sessionId });
            toast.success(t("demo_stage.session_deleted"));
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.error || t("demo_stage.session_delete_failed"));
        }
    };

    // Helper to detect if URL is embeddable video
    const getEmbedUrl = (url) => {
        if (!url) return null;
        // YouTube
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/);
        if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
        // Vimeo
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        // Loom
        const loomMatch = url.match(/loom\.com\/share\/([^?]+)/);
        if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
        // Cloudinary video - render as native video element
        if (url.includes("cloudinary.com") && url.includes("/video/")) {
            return { type: "video", url };
        }
        return null;
    };


    const formatDateTime = (dateStr) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleString();
    };

    // Handler to update session stage
    const handleStageChange = async (sessionId, newStage) => {
        try {
            await changeDemoSessionStage({ token, sessionId, stage: newStage });
            fetchSessions();
            toast.success(t("demo_stage.status_updated"));
        } catch (err) {
            toast.error(err.response?.data?.error || t("demo_stage.status_update_failed"));
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight={600}>
                    {t("demo_stage.live_demo_day")}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                    {/* Filters */}
                    {!isOrganizer && (
                        <FormControl size="small">
                            <Select value={participantFilter} onChange={e => setParticipantFilter(e.target.value)}>
                                <MenuItem value="all">{t("demo_stage.filter_all")}</MenuItem>
                                <MenuItem value="mine">{t("demo_stage.filter_mine")}</MenuItem>
                            </Select>
                        </FormControl>
                    )}
                    {isOrganizer && (
                        <FormControl size="small">
                            <Select value={organizerStage} onChange={e => setOrganizerStage(e.target.value)}>
                                <MenuItem value="all">{t("demo_stage.stage_all")}</MenuItem>
                                <MenuItem value="scheduled">{t("demo_stage.stage_scheduled")}</MenuItem>
                                <MenuItem value="live">{t("demo_stage.stage_live")}</MenuItem>
                                <MenuItem value="completed">{t("demo_stage.stage_completed")}</MenuItem>
                            </Select>
                        </FormControl>
                    )}
                    {isOrganizer && (
                        <>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => setShowCreateDialog(true)}
                                disabled={availableTeams.length === 0}
                            >
                                {t("demo_stage.schedule_session")}
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={handleOpenAIScheduleDialog}
                            >
                                {t("demo_stage.ai_schedule")}
                            </Button>
                        </>
                    )}
                </Stack>
                {/* AI Schedule Dialog */}
                <Dialog open={showAIScheduleDialog} onClose={() => setShowAIScheduleDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>{t("demo_stage.ai_scheduling_title")}</DialogTitle>
                    <DialogContent>
                        {aiStep === 1 && (
                            <Stack spacing={3} sx={{ mt: 1 }}>
                                <FormControl fullWidth required>
                                    <InputLabel>{t("demo_stage.round")}</InputLabel>
                                    <Select
                                        value={aiSelectedRound}
                                        onChange={(e) => setAISelectedRound(e.target.value)}
                                        label={t("demo_stage.round")}
                                    >
                                        {rounds.map((round) => (
                                            <MenuItem key={round._id || round.id} value={round._id || round.id}>
                                                {round.name || t("demo_stage.round")}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    label={t("demo_stage.scheduling_prompt")}
                                    value={aiPrompt}
                                    onChange={(e) => setAIPrompt(e.target.value)}
                                    placeholder={t("demo_stage.scheduling_prompt_placeholder")}
                                    multiline
                                    minRows={3}
                                    fullWidth
                                />
                            </Stack>
                        )}
                        {aiStep === 2 && (
                            <Box>
                                <Typography variant="subtitle1" sx={{ mb: 2 }}>{t("demo_stage.schedule_preview")}</Typography>
                                <Box sx={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                        <thead>
                                            <tr>
                                                <th style={{ borderBottom: "1px solid #ccc", padding: 8 }}>{t("demo_stage.th_team")}</th>
                                                <th style={{ borderBottom: "1px solid #ccc", padding: 8 }}>{t("demo_stage.th_round")}</th>
                                                <th style={{ borderBottom: "1px solid #ccc", padding: 8 }}>{t("demo_stage.th_start_time")}</th>
                                                <th style={{ borderBottom: "1px solid #ccc", padding: 8 }}>{t("demo_stage.th_end_time")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {aiSchedulePreview.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{row.team?.name}</td>
                                                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{row.round?.name}</td>
                                                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                                                        <TextField
                                                            type="datetime-local"
                                                            value={row.startTime ? formatLocalDateTime(row.startTime) : ""}
                                                            onChange={e => {
                                                                const newVal = e.target.value;
                                                                // Save as ISO string
                                                                setAISchedulePreview(prev => prev.map((r, i) => i === idx ? { ...r, startTime: new Date(newVal).toISOString() } : r));
                                                            }}
                                                            size="small"
                                                            InputLabelProps={{ shrink: true }}
                                                        />
                                                    </td>
                                                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                                                        <TextField
                                                            type="datetime-local"
                                                            value={row.endTime ? formatLocalDateTime(row.endTime) : ""}
                                                            onChange={e => {
                                                                const newVal = e.target.value;
                                                                setAISchedulePreview(prev => prev.map((r, i) => i === idx ? { ...r, endTime: new Date(newVal).toISOString() } : r));
                                                            }}
                                                            size="small"
                                                            InputLabelProps={{ shrink: true }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Box>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowAIScheduleDialog(false)}>{t("common.cancel")}</Button>
                        {aiStep === 1 && (
                            <Button
                                variant="contained"
                                onClick={handleAIGeneratePreview}
                                disabled={aiLoading || !aiPrompt || !aiSelectedRound}
                            >
                                {aiLoading ? t("common.loading") : t("demo_stage.generate_schedule")}
                            </Button>
                        )}
                        {aiStep === 2 && (
                            <Button
                                variant="contained"
                                onClick={handleAIConfirmSchedule}
                                disabled={aiLoading || aiSchedulePreview.length === 0}
                            >
                                {aiLoading ? t("common.loading") : t("demo_stage.confirm_schedule")}
                            </Button>
                        )}
                        {aiStep === 2 && (
                            <Button
                                onClick={() => setAIStep(1)}
                                disabled={aiLoading}
                            >
                                {t("common.back")}
                            </Button>
                        )}
                    </DialogActions>
                </Dialog>
            </Stack>

            {filteredSessions.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: "center" }}>
                    <Typography color="text.secondary" mb={2}>
                        {t("demo_stage.no_sessions")}
                    </Typography>
                    {isOrganizer && teams.length > 0 && (
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => setShowCreateDialog(true)}
                        >
                            {t("demo_stage.schedule_first_session")}
                        </Button>
                    )}
                    {isOrganizer && teams.length === 0 && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            {t("demo_stage.no_teams_to_schedule")}
                        </Alert>
                    )}
                </Paper>
            ) : (
                <Stack spacing={2}>
                    {filteredSessions.map((session) => (
                        <Paper
                            key={session._id}
                            sx={{
                                p: 2,
                                border: activeSession?._id === session._id ? "2px solid #1976d2" : "1px solid #e0e0e0",
                                transition: "border-color 0.2s",
                            }}
                        >
                            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
                                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                                    {session.team?.name || t("demo_stage.unknown_team")}
                                </Typography>
                                {session.startTime && (
                                    <Typography variant="body2" color="text.secondary">
                                        {formatDateTime(session.startTime)}
                                    </Typography>
                                )}
                                {/* Organizer: stage dropdown */}
                                {isOrganizer && (
                                    <FormControl size="small" sx={{ minWidth: 120 }}>
                                        <Select
                                            value={session.stage || "scheduled"}
                                            onChange={e => handleStageChange(session._id, e.target.value)}
                                        >
                                            <MenuItem value="scheduled">{t("demo_stage.stage_scheduled")}</MenuItem>
                                            <MenuItem value="live">{t("demo_stage.stage_live")}</MenuItem>
                                            <MenuItem value="completed">{t("demo_stage.stage_completed")}</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}
                                <Button
                                    variant={activeSession?._id === session._id ? "contained" : "outlined"}
                                    size="small"
                                    onClick={() => setActiveSession(session)}
                                >
                                    {activeSession?._id === session._id ? t("demo_stage.viewing") : t("demo_stage.view")}
                                </Button>
                            </Stack>

                            {activeSession?._id === session._id && (
                                <Box mt={2} pt={2} sx={{ borderTop: "1px solid #e0e0e0" }}>
                                    {/* Video Section */}
                                    {/* Only show public videos to participants; organizers see all */}
                                    {((session.videoUrl && (isOrganizer || session.videoVisibility === "public")) || isOrganizer) && (
                                        <Box mb={3}>
                                            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                                                <VideoIcon color="action" />
                                                <Typography variant="subtitle1" fontWeight={600}>
                                                    {t("demo_stage.demo_video")}
                                                </Typography>
                                                <Chip
                                                    label={session.videoVisibility === "public" ? t("demo_stage.visibility_public") : t("demo_stage.visibility_draft")}
                                                    color={session.videoVisibility === "public" ? "success" : "default"}
                                                    size="small"
                                                    sx={{ ml: 1 }}
                                                />
                                                {isOrganizer && (
                                                    <>
                                                        <Button
                                                            size="small"
                                                            startIcon={<EditIcon />}
                                                            onClick={() => handleOpenEditSessionDialog(session)}
                                                        >
                                                            {t("common.edit")}
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            startIcon={<EditIcon />}
                                                            onClick={() => handleOpenVideoDialog(session)}
                                                        >
                                                            {session.videoUrl ? t("common.edit_video") : t("demo_stage.add_video")}
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            color="error"
                                                            startIcon={<DeleteIcon />}
                                                            onClick={() => handleDeleteSession(session._id)}
                                                        >
                                                            {t("common.delete")}
                                                        </Button>
                                                    </>
                                                )}
                                            </Stack>

                                            {/* Edit Session Dialog */}
                                            {showEditSessionDialog && editSessionData && (
                                                <Dialog open={showEditSessionDialog} onClose={() => setShowEditSessionDialog(false)}>
                                                    <DialogTitle>{t("demo_stage.edit_session")}</DialogTitle>
                                                    <DialogContent>
                                                        <TextField
                                                            margin="dense"
                                                            label={t("demo_stage.start_time")}
                                                            type="datetime-local"
                                                            fullWidth
                                                            value={formatLocalDateTime(editSessionData.startTime)}
                                                            onChange={e => handleEditSessionChange("startTime", e.target.value)}
                                                            InputLabelProps={{ shrink: true }}
                                                        />
                                                        <TextField
                                                            margin="dense"
                                                            label={t("demo_stage.end_time")}
                                                            type="datetime-local"
                                                            fullWidth
                                                            value={formatLocalDateTime(editSessionData.endTime)}
                                                            onChange={e => handleEditSessionChange("endTime", e.target.value)}
                                                            InputLabelProps={{ shrink: true }}
                                                        />
                                                        <FormControl fullWidth margin="dense">
                                                            <InputLabel>{t("demo_stage.round")}</InputLabel>
                                                            <Select
                                                                value={editSessionData.round?._id || editSessionData.round || ""}
                                                                onChange={e => handleEditSessionChange("round", e.target.value)}
                                                                label={t("demo_stage.round")}
                                                            >
                                                                {rounds.map(r => (
                                                                    <MenuItem key={r._id} value={r._id}>{r.name}</MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    </DialogContent>
                                                    <DialogActions>
                                                        <Button onClick={() => setShowEditSessionDialog(false)}>{t("common.cancel")}</Button>
                                                        <Button onClick={handleSaveEditSession} variant="contained">{t("common.save")}</Button>
                                                    </DialogActions>
                                                </Dialog>
                                            )}

                                            {session.videoUrl ? (
                                                (() => {
                                                    const embedInfo = getEmbedUrl(session.videoUrl);
                                                    if (embedInfo?.type === "video") {
                                                        // Native video for Cloudinary uploads
                                                        return (
                                                            <Box sx={{ maxWidth: 640, borderRadius: 1, overflow: "hidden" }}>
                                                                <video
                                                                    src={embedInfo.url}
                                                                    controls
                                                                    style={{ width: "100%", maxHeight: 360 }}
                                                                />
                                                            </Box>
                                                        );
                                                    } else if (embedInfo) {
                                                        // Embed iframe for YouTube, Vimeo, Loom
                                                        return (
                                                            <Box sx={{ position: "relative", paddingTop: "56.25%", width: "100%", maxWidth: 640, bgcolor: "#000", borderRadius: 1, overflow: "hidden" }}>
                                                                <iframe
                                                                    src={embedInfo}
                                                                    title="Demo Video"
                                                                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                    allowFullScreen
                                                                />
                                                            </Box>
                                                        );
                                                    } else {
                                                        // External link for other URLs
                                                        return (
                                                            <Button
                                                                variant="outlined"
                                                                href={session.videoUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                startIcon={<VideoIcon />}
                                                            >
                                                                {t("demo_stage.watch_video")}
                                                            </Button>
                                                        );
                                                    }
                                                })()
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    {t("demo_stage.no_video")}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}

                                    {session.aiSummary && (
                                        <Box mb={2}>
                                            <Typography variant="subtitle2">{t("demo_stage.ai_summary")}:</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {session.aiSummary}
                                            </Typography>
                                        </Box>
                                    )}

                                    {session.aiHighlights && (
                                        <Box mb={2}>
                                            <Typography variant="subtitle2">{t("demo_stage.highlights")}:</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {session.aiHighlights}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Show WebRTC component for organizers, judges, and team members */}
                                    {(isOrganizer || activeSession?.team?.members?.some(
                                        (m) => String(m._id || m) === String(user?._id)
                                    )) && (
                                            <Box mt={2}>
                                                <WebRTCStreamRecorder
                                                    sessionId={activeSession._id}
                                                    token={token}
                                                    myRole={myRole}
                                                    userName={user?.name || "You"}
                                                    onVideoUploaded={() => {
                                                        fetchSessions();
                                                    }}
                                                />
                                            </Box>
                                        )}
                                </Box>
                            )}
                        </Paper>
                    ))}
                </Stack>
            )}

            {/* Create Session Dialog */}
            <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t("demo_stage.schedule_session")}</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <FormControl fullWidth required>
                            <InputLabel>{t("demo_stage.select_team")}</InputLabel>
                            <Select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                label={t("demo_stage.select_team")}
                            >
                                {availableTeams.map((team) => (
                                    <MenuItem key={team._id} value={team._id}>
                                        {team.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth required sx={{ mt: 2 }}>
                            <InputLabel>{t("demo_stage.round")}</InputLabel>
                            <Select
                                value={selectedRound}
                                onChange={(e) => setSelectedRound(e.target.value)}
                                label={t("demo_stage.round")}
                            >
                                {rounds.map((round) => (
                                    <MenuItem key={round._id || round.id} value={round._id || round.id}>
                                        {round.name || t("demo_stage.round")}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label={t("demo_stage.start_time")}
                            type="datetime-local"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
                        <TextField
                            label={t("demo_stage.end_time")}
                            type="datetime-local"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
                        <TextField
                            label={t("demo_stage.video_url")}
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=... or https://loom.com/share/..."
                            helperText={t("demo_stage.video_url_help")}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowCreateDialog(false)}>{t("common.cancel")}</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateSession}
                        disabled={creating || !selectedTeam || !selectedRound}
                    >
                        {creating ? t("common.loading") : t("demo_stage.schedule")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Video Dialog */}
            <Dialog open={showVideoDialog} onClose={() => setShowVideoDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t("demo_stage.edit_video")}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            {t("demo_stage.video_url_help")}
                        </Typography>
                        <TextField
                            label={t("demo_stage.video_url")}
                            value={editVideoUrl}
                            onChange={(e) => setEditVideoUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=... or https://loom.com/share/..."
                            fullWidth
                            autoFocus
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={editVideoVisibility === "public"}
                                    onChange={e => setEditVideoVisibility(e.target.checked ? "public" : "draft")}
                                    color="primary"
                                    disabled={savingVideo}
                                />
                            }
                            label={editVideoVisibility === "public" ? t("demo_stage.visibility_public_desc") : t("demo_stage.visibility_draft_desc")}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowVideoDialog(false)}>{t("common.cancel")}</Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveVideo}
                        disabled={savingVideo}
                    >
                        {savingVideo ? t("common.loading") : t("common.update")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DemoStagePage;
