import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
    Container,
    Box,
    Paper,
    TextField,
    IconButton,
    Typography,
    Avatar,
    Stack,
    CircularProgress,
    Alert,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Divider,
} from "@mui/material";

import {
    ArrowBack as ArrowBackIcon,
    AutoAwesome as AutoAwesomeIcon,
    Message as MessageIcon,
    Send as SendIcon,
    Summarize as SummarizeIcon,
} from "@mui/icons-material";

import { useAuth } from "../context/AuthContext";

import {
    getTeamMessages,
    sendTeamMessage,
    generateMeetingSummary,
} from "../api/messages";

import { getMyTeams } from "../api/registrations";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import InfoModal from "../components/common/InfoModal";

const ChatPage = () => {
    const { teamId } = useParams();
    const { t } = useTranslation();
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [infoModal, setInfoModal] = useState({ open: false, type: "info", message: "" });
    const [teamName, setTeamName] = useState("");
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [summaryDialog, setSummaryDialog] = useState({ open: false, summary: null });
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);

    // Scroll to bottom when messages change
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load team name and messages
    useEffect(() => {
        if (teamId && token) {
            loadTeamName();
            loadMessages();
        }
    }, [teamId, token]);

    // Listen for real-time messages
    useEffect(() => {
        const handleTeamMessage = (event) => {
            const { teamId: eventTeamId, eventType, message } = event.detail;

            if (eventTeamId === teamId && eventType === "new_message") {
                setMessages((prev) => [...prev, message]);
            }
        };

        window.addEventListener("team_message", handleTeamMessage);

        return () => {
            window.removeEventListener("team_message", handleTeamMessage);
        };
    }, [teamId]);

    const loadTeamName = async () => {
        try {
            // First try to get from my teams (if user is a member)
            const res = await getMyTeams(token);
            const teamsData = Array.isArray(res) ? res : (res.teams || []);
            const team = teamsData.find(t => String(t._id) === String(teamId));
            if (team) {
                setTeamName(team.name);
                return;
            }
        } catch (error) {
            console.error("Error loading team name from my teams:", error);
        }

        // If not found in my teams, get from messages response (includes teamName)
        // This works for mentors, organizers, and admins too
        try {
            const messagesRes = await getTeamMessages(teamId, token);
            if (messagesRes.teamName) {
                setTeamName(messagesRes.teamName);
            }
        } catch (error) {
            console.error("Error getting team name from messages:", error);
        }
    };

    const loadMessages = async () => {
        try {
            setLoading(true);
            const response = await getTeamMessages(teamId, token);
            setMessages(response.messages || []);
            // Also set team name from response if available
            if (response.teamName && !teamName) {
                setTeamName(response.teamName);
            }
        } catch (error) {
            console.error("Error loading messages:", error);
            setInfoModal({
                open: true,
                type: "error",
                message: error.response?.data?.message || t("chat.fetch_failed"),
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageText.trim() || sending) return;

        const content = messageText.trim();
        setMessageText("");
        setSending(true);

        try {
            await sendTeamMessage(teamId, content, token);
            // Message will be added via WebSocket event
        } catch (error) {
            console.error("Error sending message:", error);
            setInfoModal({
                open: true,
                type: "error",
                message: error.response?.data?.message || t("chat.send_failed"),
            });
            // Restore message text on error
            setMessageText(content);
        } finally {
            setSending(false);
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t("chat.just_now");
        if (diffMins < 60) return `${diffMins} ${t("chat.minutes_ago")}`;
        if (diffHours < 24) return `${diffHours} ${t("chat.hours_ago")}`;
        if (diffDays < 7) return `${diffDays} ${t("chat.days_ago")}`;

        return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const isMyMessage = (message) => {
        return String(message.sender?._id || message.sender) === String(user?._id);
    };

    const isAIMessage = (message) => {
        return message.isAI || !message.sender;
    };

    const handleGenerateSummary = async () => {
        try {
            setGeneratingSummary(true);
            const response = await generateMeetingSummary(teamId, token);
            setSummaryDialog({ open: true, summary: response.summary });
        } catch (error) {
            console.error("Error generating summary:", error);
            setInfoModal({
                open: true,
                type: "error",
                message: error.response?.data?.message || t("chat.summary_failed"),
            });
        } finally {
            setGeneratingSummary(false);
        }
    };

    return (
        <DashboardLayout>
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(-1)}
                    sx={{ mb: 3 }}
                >
                    {t("common.back")}
                </Button>

                <Paper
                    elevation={3}
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        height: "calc(100vh - 200px)",
                        minHeight: "600px",
                        maxHeight: "800px",
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            p: 2,
                            borderBottom: 1,
                            borderColor: "divider",
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <MessageIcon color="primary" />
                        <Typography variant="h6" sx={{ flex: 1 }}>
                            {teamName || t("chat.team_chat")}
                        </Typography>
                        {messages.length > 0 && (
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={generatingSummary ? <CircularProgress size={16} /> : <SummarizeIcon />}
                                onClick={handleGenerateSummary}
                                disabled={generatingSummary}
                                sx={{ textTransform: "none" }}
                            >
                                {generatingSummary ? t("chat.generating") : t("chat.summarize")}
                            </Button>
                        )}
                    </Box>

                    {/* Messages Container */}
                    <Box
                        ref={messagesContainerRef}
                        sx={{
                            flex: 1,
                            overflowY: "auto",
                            p: 2,
                            bgcolor: "background.default",
                        }}
                    >
                        {loading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                                <CircularProgress />
                            </Box>
                        ) : messages.length === 0 ? (
                            <Alert severity="info">{t("chat.no_messages")}</Alert>
                        ) : (
                            <Stack spacing={2}>
                                {messages.map((message) => {
                                    const myMessage = isMyMessage(message);
                                    const aiMessage = isAIMessage(message);
                                    return (
                                        <Box
                                            key={message._id}
                                            sx={{
                                                display: "flex",
                                                justifyContent: myMessage ? "flex-end" : "flex-start",
                                                gap: 1,
                                            }}
                                        >
                                            {!myMessage && (
                                                <Avatar sx={{
                                                    width: 32,
                                                    height: 32,
                                                    bgcolor: aiMessage ? "secondary.main" : "primary.main"
                                                }}>
                                                    {aiMessage ? "🤖" : (message.sender?.name?.charAt(0)?.toUpperCase() || "?")}
                                                </Avatar>
                                            )}
                                            <Box
                                                sx={{
                                                    maxWidth: "70%",
                                                    bgcolor: myMessage
                                                        ? "primary.main"
                                                        : aiMessage
                                                            ? "secondary.light"
                                                            : "background.paper",
                                                    color: myMessage ? "primary.contrastText" : "text.primary",
                                                    p: 1.5,
                                                    borderRadius: 2,
                                                    boxShadow: 1,
                                                    border: aiMessage ? "1px solid" : "none",
                                                    borderColor: aiMessage ? "secondary.main" : "transparent",
                                                }}
                                            >
                                                {!myMessage && (
                                                    <Typography variant="caption" sx={{ display: "block", mb: 0.5, opacity: 0.8 }}>
                                                        {aiMessage ? t("chat.ai_assistant") : (message.sender?.name || t("chat.unknown_user"))}
                                                    </Typography>
                                                )}
                                                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                                                    {message.content}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        display: "block",
                                                        mt: 0.5,
                                                        opacity: 0.7,
                                                        textAlign: myMessage ? "right" : "left",
                                                    }}
                                                >
                                                    {formatTime(message.createdAt)}
                                                </Typography>
                                            </Box>
                                            {myMessage && (
                                                <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }}>
                                                    {user?.name?.charAt(0)?.toUpperCase() || "?"}
                                                </Avatar>
                                            )}
                                        </Box>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </Stack>
                        )}
                    </Box>

                    {/* Input Area */}
                    <Box
                        component="form"
                        onSubmit={handleSendMessage}
                        sx={{
                            p: 2,
                            borderTop: 1,
                            borderColor: "divider",
                            display: "flex",
                            gap: 1,
                        }}
                    >
                        <TextField
                            fullWidth
                            size="small"
                            placeholder={t("chat.type_message")}
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            disabled={sending}
                            multiline
                            maxRows={3}
                            helperText={t("chat.ai_mention_hint")}
                            FormHelperTextProps={{ sx: { fontSize: "0.7rem", mt: 0.5 } }}
                        />
                        <IconButton
                            type="submit"
                            color="primary"
                            disabled={!messageText.trim() || sending}
                            sx={{ alignSelf: "flex-end" }}
                        >
                            {sending ? <CircularProgress size={20} /> : <SendIcon />}
                        </IconButton>
                    </Box>
                </Paper>

                <InfoModal
                    open={infoModal.open}
                    onClose={() => setInfoModal({ open: false, type: "info", message: "" })}
                    type={infoModal.type}
                    message={infoModal.message}
                />

                {/* Summary Dialog */}
                <Dialog
                    open={summaryDialog.open}
                    onClose={() => setSummaryDialog({ open: false, summary: null })}
                    maxWidth="md"
                    fullWidth
                >
                    <DialogTitle>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <SummarizeIcon color="primary" />
                            <Typography variant="h6">{t("chat.meeting_summary")}</Typography>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        {summaryDialog.summary && (
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                {summaryDialog.summary.summary && (
                                    <>
                                        <Typography variant="subtitle1" fontWeight={600}>{t("chat.summary")}</Typography>
                                        <Typography variant="body2">{summaryDialog.summary.summary}</Typography>
                                    </>
                                )}
                                {summaryDialog.summary.decisions && summaryDialog.summary.decisions.length > 0 && (
                                    <>
                                        <Divider />
                                        <Typography variant="subtitle1" fontWeight={600}>{t("chat.decisions")}</Typography>
                                        <Stack spacing={1}>
                                            {summaryDialog.summary.decisions.map((decision, idx) => (
                                                <Typography key={idx} variant="body2">• {decision}</Typography>
                                            ))}
                                        </Stack>
                                    </>
                                )}
                                {summaryDialog.summary.actionItems && summaryDialog.summary.actionItems.length > 0 && (
                                    <>
                                        <Divider />
                                        <Typography variant="subtitle1" fontWeight={600}>{t("chat.action_items")}</Typography>
                                        <Stack spacing={1}>
                                            {summaryDialog.summary.actionItems.map((item, idx) => (
                                                <Typography key={idx} variant="body2">
                                                    • <strong>{item.person || t("chat.team")}</strong>: {item.task}
                                                </Typography>
                                            ))}
                                        </Stack>
                                    </>
                                )}
                                {summaryDialog.summary.topics && summaryDialog.summary.topics.length > 0 && (
                                    <>
                                        <Divider />
                                        <Typography variant="subtitle1" fontWeight={600}>{t("chat.topics_discussed")}</Typography>
                                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                            {summaryDialog.summary.topics.map((topic, idx) => (
                                                <Chip key={idx} label={topic} size="small" />
                                            ))}
                                        </Box>
                                    </>
                                )}
                            </Stack>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setSummaryDialog({ open: false, summary: null })}>
                            {t("common.close")}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </DashboardLayout>
    );
};

export default ChatPage;

