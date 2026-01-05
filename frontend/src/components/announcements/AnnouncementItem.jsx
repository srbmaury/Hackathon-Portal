import React, { useState } from "react";

import {
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import CircularProgress from "@mui/material/CircularProgress";

import dayjs from "dayjs";
import MDEditor from "@uiw/react-md-editor";
import toast from "react-hot-toast";

import { useTranslation } from "react-i18next";

import MarkdownViewer from "../common/MarkdownViewer";

import { getSocket } from "../../services/socket";
import { updateHackathonAnnouncement } from "../../api/hackathons";
import { updateAnnouncement, formatAnnouncement } from "../../api/announcements";

const AnnouncementItem = ({ announcement, user, onUpdated, hackathonId, myRole }) => {
    const [editing, setEditing] = useState(false);
    const [editedMessage, setEditedMessage] = useState(announcement.message);
    const [editedTitle, setEditedTitle] = useState(announcement.title);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [formattingAnnouncement, setFormattingAnnouncement] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const token = localStorage.getItem("token");
    const theme = useTheme();
    const { t } = useTranslation();

    // For hackathon-specific announcements, organizers can edit/delete any announcement
    // For general announcements, only the creator can edit/delete
    const isAdmin = user.role === "admin";
    const isHackathonOrganizer = myRole === "organizer";
    const canEdit = isAdmin || (isHackathonOrganizer && announcement.createdBy?._id === user._id);
    const canDelete = isAdmin || (isHackathonOrganizer && announcement.createdBy?._id === user._id);

    // Determine color scheme based on theme
    const colorScheme = theme.palette.mode === "dark" ? "dark" : "light";

    // Delete using websocket
    const handleDelete = () => {
        const socket = getSocket();

        // Check if socket exists and is connected
        if (!socket) {
            toast.error(t("announcement.websocket_not_connected") || "WebSocket not initialized. Please refresh the page.");
            setConfirmOpen(false);
            return;
        }

        // Wait for socket to be connected
        if (!socket.connected) {
            // Try to connect if not connected
            socket.connect();

            // Wait for connection with timeout
            const connectionTimeout = setTimeout(() => {
                if (!socket.connected) {
                    toast.error(t("announcement.websocket_not_connected") || "WebSocket connection failed. Please refresh the page.");
                    setConfirmOpen(false);
                }
            }, 3000);

            socket.once("connect", () => {
                clearTimeout(connectionTimeout);
                proceedWithDelete();
            });

            return;
        }

        proceedWithDelete();

        function proceedWithDelete() {
            setDeleting(true);
            const announcementId = announcement._id;

            // Set up timeout
            const timeoutId = setTimeout(() => {
                socket.off("announcement_deleted", successHandler);
                socket.off("announcement_delete_error", errorHandler);
                setDeleting(false);
                setConfirmOpen(false);
                toast.error(t("announcement.delete_timeout") || "Delete request timed out. Please try again.");
            }, 10000);

            // Set up error handler
            const errorHandler = (data) => {
                if (data.announcementId === announcementId) {
                    clearTimeout(timeoutId);
                    socket.off("announcement_deleted", successHandler);
                    socket.off("announcement_delete_error", errorHandler);
                    setDeleting(false);
                    setConfirmOpen(false);
                    const errorMsg = data.error || t("announcement.delete_failed");
                    toast.error(errorMsg);
                }
            };

            // Set up success handler
            const successHandler = (data) => {
                if (data.announcementId === announcementId) {
                    clearTimeout(timeoutId);
                    socket.off("announcement_deleted", successHandler);
                    socket.off("announcement_delete_error", errorHandler);
                    setDeleting(false);
                    setConfirmOpen(false);
                    toast.success(t("announcement.announcement_deleted"));

                    // Don't call onDeleted callback here - the WebSocket listener in AnnouncementList
                    // will handle the list update automatically to avoid duplicate updates
                }
            };

            // Register handlers
            socket.on("announcement_deleted", successHandler);
            socket.on("announcement_delete_error", errorHandler);

            // Emit delete request
            socket.emit("delete_announcement", {
                announcementId: announcementId,
                hackathonId: hackathonId || null
            });
        }
    };

    // Format announcement with AI
    const handleFormatAnnouncement = async () => {
        if (!editedTitle.trim() || !editedMessage.trim()) {
            toast.error(t("announcement.all_fields_required"));
            return;
        }
        if (!hackathonId) {
            toast.error(t("announcement.format_failed") || "Formatting not available for general announcements");
            return;
        }
        try {
            setFormattingAnnouncement(true);
            const result = await formatAnnouncement(hackathonId, editedTitle, editedMessage, token);
            setEditedTitle(result.formattedTitle || editedTitle);
            setEditedMessage(result.formattedMessage || editedMessage);
            toast.success(t("announcement.format_success"));
        } catch (error) {
            console.error("Error formatting announcement:", error);
            toast.error(error.response?.data?.message || t("announcement.format_failed"));
        } finally {
            setFormattingAnnouncement(false);
        }
    };

    // Update using appropriate API
    const handleUpdate = async () => {
        try {
            const updateData = { title: editedTitle, message: editedMessage };
            if (hackathonId) {
                await updateHackathonAnnouncement(hackathonId, announcement._id, updateData, token);
            } else {
                await updateAnnouncement(announcement._id, updateData, token);
            }
            toast.success(t("announcement.announcement_updated"));
            setEditing(false);
            onUpdated?.(updateData);
        } catch (err) {
            toast.error(err.response?.data?.message || t("announcement.update_failed"));
        }
    };

    if (editing) {
        return (
            <Card sx={{ mb: 3, borderRadius: 3, boxShadow: 3 }}>
                <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="h6">
                            {t("announcement.edit_announcement")}
                        </Typography>
                        {hackathonId && (
                            <Button
                                variant="outlined"
                                color="primary"
                                size="small"
                                startIcon={formattingAnnouncement ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                                onClick={handleFormatAnnouncement}
                                disabled={formattingAnnouncement || !editedTitle.trim() || !editedMessage.trim()}
                                sx={{ textTransform: "none", minWidth: "160px" }}
                            >
                                {formattingAnnouncement ? t("announcement.formatting") : t("announcement.format_with_ai")}
                            </Button>
                        )}
                    </Box>
                    <TextField
                        label={t("announcement.title_label")}
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        fullWidth
                        sx={{ mb: 2 }}
                    />
                    <Box data-color-mode={colorScheme}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            {t("announcement.message")}
                        </Typography>
                        <MDEditor value={editedMessage} onChange={setEditedMessage} height={300} preview="edit" />
                    </Box>
                    <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                        <Button variant="contained" color="primary" onClick={handleUpdate}>
                            {t("announcement.update")}
                        </Button>
                        <Button variant="outlined" onClick={() => setEditing(false)}>
                            {t("announcement.cancel")}
                        </Button>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card sx={{ mb: 3, borderRadius: 3, boxShadow: 3 }}>
                {/* Title bar */}
                <Box
                    sx={{
                        backgroundColor: "primary.main",
                        color: "primary.contrastText",
                        px: 2,
                        py: 1.5,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {announcement.title}
                    </Typography>
                    <Box>
                        {canEdit && (
                            <IconButton size="small" sx={{ color: "white" }} onClick={() => setEditing(true)}>
                                <EditIcon data-testid="EditIcon" />
                            </IconButton>
                        )}
                        {canDelete && (
                            <IconButton size="small" sx={{ color: "white" }} onClick={() => setConfirmOpen(true)}>
                                <DeleteIcon data-testid="DeleteIcon" />
                            </IconButton>
                        )}
                    </Box>
                </Box>

                <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5, fontSize: "0.875rem", color: "text.secondary" }}>
                        <span>{t("announcement.posted_by_with_name", { name: announcement.createdBy?.name || t("announcement.unknown") })}</span>
                        <span>{dayjs(announcement.createdAt).format("DD MMM YYYY, h:mm A")}</span>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    <MarkdownViewer content={announcement.message} colorScheme={colorScheme} />
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <DialogTitle>{t("announcement.confirm_delete")}</DialogTitle>
                <DialogContent>
                    {t("announcement.delete_confirmation")}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>
                        {t("announcement.cancel")}
                    </Button>
                    <Button
                        color="error"
                        onClick={handleDelete}
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={16} /> : null}
                    >
                        {deleting ? t("announcement.deleting") || "Deleting..." : t("announcement.delete")}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default AnnouncementItem;
