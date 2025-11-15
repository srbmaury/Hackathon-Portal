import React, { useState, useEffect, useRef } from "react";
import {
    Box,
    Paper,
    TextField,
    IconButton,
    Typography,
    Avatar,
    Stack,
    CircularProgress,
    Alert,
} from "@mui/material";
import {
    Send as SendIcon,
    Message as MessageIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { getTeamMessages, sendTeamMessage } from "../../api/messages";
import InfoModal from "../common/InfoModal";

const ChatWindow = ({ teamId, teamName, onClose }) => {
    const { t } = useTranslation();
    const { token, user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [infoModal, setInfoModal] = useState({ open: false, type: "info", message: "" });
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);

    // Scroll to bottom when messages change
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load messages
    useEffect(() => {
        if (teamId && token) {
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

    const loadMessages = async () => {
        try {
            setLoading(true);
            const response = await getTeamMessages(teamId, token);
            setMessages(response.messages || []);
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
            const response = await sendTeamMessage(teamId, content, token);
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

    return (
        <Paper
            elevation={3}
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "500px",
                maxHeight: "80vh",
                width: "100%",
                maxWidth: "600px",
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

            <InfoModal
                open={infoModal.open}
                onClose={() => setInfoModal({ open: false, type: "info", message: "" })}
                type={infoModal.type}
                message={infoModal.message}
            />
        </Paper>
    );
};

export default ChatWindow;

