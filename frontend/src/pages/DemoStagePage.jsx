import React, { useEffect, useState, useCallback } from "react";
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
    Alert
} from "@mui/material";
import { Add as AddIcon, PlayArrow as PlayIcon, VideoCall as VideoIcon, Edit as EditIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import API from "../api/apiConfig";
import WebRTCStreamRecorder from "./WebRTCStreamRecorder";

const DemoStagePage = ({ hackathonId: propHackathonId, myRole, teams = [] }) => {
    const { hackathonId: paramHackathonId } = useParams();
    const hackathonId = propHackathonId || paramHackathonId;
    const { t } = useTranslation();
    const { token, user } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSession, setActiveSession] = useState(null);

    // Session creation state
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [creating, setCreating] = useState(false);

    // Edit video dialog state
    const [showVideoDialog, setShowVideoDialog] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [editVideoUrl, setEditVideoUrl] = useState("");
    const [savingVideo, setSavingVideo] = useState(false);

    // Judges have the same access as organizers
    const isOrganizer = myRole === "organizer" || myRole === "judge" || user?.role === "admin";

    // Get teams that don't have a session yet
    const availableTeams = teams.filter(
        (team) => !sessions.some((s) => s.team?._id === team._id)
    );

    // Fetch demo sessions
    const fetchSessions = useCallback(async () => {
        if (!hackathonId) return;
        setLoading(true);
        try {
            const res = await API.get(`/demo-stage/sessions/${hackathonId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSessions(res.data);
        } catch {
            setSessions([]);
        }
        setLoading(false);
    }, [hackathonId, token]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const handleCreateSession = async () => {
        if (!selectedTeam) {
            toast.error(t("demo_stage.select_team_required"));
            return;
        }
        setCreating(true);
        try {
            const payload = {
                hackathon: hackathonId,
                team: selectedTeam,
                startTime: startTime || undefined,
                endTime: endTime || undefined,
                videoUrl: videoUrl || undefined,
            };
            await API.post("/demo-stage/sessions", payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success(t("demo_stage.session_created"));
            setShowCreateDialog(false);
            setSelectedTeam("");
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
        setShowVideoDialog(true);
    };

    const handleSaveVideo = async () => {
        if (!editingSession) return;
        setSavingVideo(true);
        try {
            await API.patch(`/demo-stage/sessions/${editingSession._id}`,
                { videoUrl: editVideoUrl },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(t("demo_stage.video_saved"));
            setShowVideoDialog(false);
            setEditingSession(null);
            setEditVideoUrl("");
            fetchSessions();
        } catch {
            toast.error(t("demo_stage.video_save_failed"));
        } finally {
            setSavingVideo(false);
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

    const handleSetLive = async (sessionId) => {
        try {
            await API.patch(`/demo-stage/sessions/${sessionId}/status`,
                { status: "live" },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(t("demo_stage.session_now_live"));
            fetchSessions();
        } catch {
            toast.error(t("demo_stage.status_update_failed"));
        }
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleString();
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
                {isOrganizer && (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setShowCreateDialog(true)}
                        disabled={availableTeams.length === 0}
                    >
                        {t("demo_stage.schedule_session")}
                    </Button>
                )}
            </Stack>

            {sessions.length === 0 ? (
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
                    {sessions.map((session) => (
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
                                <Chip
                                    label={session.status || "scheduled"}
                                    color={session.status === "live" ? "success" : session.status === "completed" ? "default" : "warning"}
                                    size="small"
                                />
                                {session.startTime && (
                                    <Typography variant="body2" color="text.secondary">
                                        {formatDateTime(session.startTime)}
                                    </Typography>
                                )}
                                {isOrganizer && session.status !== "live" && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="success"
                                        startIcon={<PlayIcon />}
                                        onClick={() => handleSetLive(session._id)}
                                    >
                                        {t("demo_stage.go_live")}
                                    </Button>
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
                                    {(session.videoUrl || isOrganizer) && (
                                        <Box mb={3}>
                                            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                                                <VideoIcon color="action" />
                                                <Typography variant="subtitle1" fontWeight={600}>
                                                    {t("demo_stage.demo_video")}
                                                </Typography>
                                                {isOrganizer && (
                                                    <Button
                                                        size="small"
                                                        startIcon={<EditIcon />}
                                                        onClick={() => handleOpenVideoDialog(session)}
                                                    >
                                                        {session.videoUrl ? t("common.edit") : t("demo_stage.add_video")}
                                                    </Button>
                                                )}
                                            </Stack>
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
                        disabled={creating || !selectedTeam}
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
