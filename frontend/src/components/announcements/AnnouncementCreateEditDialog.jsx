import React, { useContext, useState } from "react";

import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";

import { AutoAwesome as AutoAwesomeIcon } from "@mui/icons-material";

import MDEditor from "@uiw/react-md-editor";
import toast from "react-hot-toast";

import { useTranslation } from "react-i18next";

import { AuthContext } from "../../context/AuthContext";

import { formatAnnouncement } from "../../api/announcements";
import { createHackathonAnnouncement } from "../../api/hackathons";

const AnnouncementCreateEditDialog = ({ id, announcementForm, showAnnouncementDialog, setShowAnnouncementDialog,
    setAnnouncementForm, loadAnnouncements, editingAnnouncement, setEditingAnnouncement, handleUpdateAnnouncement }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const { token } = useContext(AuthContext);
    const [formattingAnnouncement, setFormattingAnnouncement] = useState(false);

    const handleFormatAnnouncement = async () => {
        if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
            toast.error(t("announcement.all_fields_required"));
            return;
        }
        try {
            setFormattingAnnouncement(true);
            const result = await formatAnnouncement(id, announcementForm.title, announcementForm.message, token);
            setAnnouncementForm({
                title: result.formattedTitle || announcementForm.title,
                message: result.formattedMessage || announcementForm.message,
            });
            toast.success(t("announcement.format_success"));
        } catch (error) {
            console.error("Error formatting announcement:", error);
            toast.error(error.response?.data?.message || t("announcement.format_failed"));
        } finally {
            setFormattingAnnouncement(false);
        }
    };

    const handleCreateAnnouncement = async () => {
        if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
            toast.error(t("announcement.all_fields_required"));
            return;
        }
        try {
            await createHackathonAnnouncement(id, announcementForm, token);
            toast.success(t("announcement.announcement_created"));
            setShowAnnouncementDialog(false);
            setAnnouncementForm({ title: "", message: "" });
            loadAnnouncements();
        } catch (error) {
            console.error("Error creating announcement:", error);
            toast.error(error.response?.data?.message || t("announcement.creation_failed"));
        }
    };

    return (
        <Dialog
            open={showAnnouncementDialog}
            onClose={() => {
                setShowAnnouncementDialog(false);
                setAnnouncementForm({ title: "", message: "" });
                setEditingAnnouncement(null);
            }}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                {editingAnnouncement
                    ? t("announcement.edit_announcement")
                    : t("announcement.create_announcement")
                }
            </DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={formattingAnnouncement ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                            onClick={handleFormatAnnouncement}
                            disabled={formattingAnnouncement || !announcementForm.title.trim() || !announcementForm.message.trim()}
                            sx={{ textTransform: "none", minWidth: "160px" }}
                        >
                            {formattingAnnouncement ? t("announcement.formatting") : t("announcement.format_with_ai")}
                        </Button>
                    </Box>
                    <TextField
                        label={t("announcement.title_label")}
                        fullWidth
                        required
                        value={announcementForm.title}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                        sx={{ mb: 2 }}
                    />
                    <Box data-color-mode={theme.palette.mode === "dark" ? "dark" : "light"}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            {t("announcement.message")}
                        </Typography>
                        <MDEditor
                            value={announcementForm.message}
                            onChange={(value) => setAnnouncementForm({ ...announcementForm, message: value || "" })}
                            height={300}
                            preview="edit"
                        />
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => {
                    setShowAnnouncementDialog(false);
                    setAnnouncementForm({ title: "", message: "" });
                    setEditingAnnouncement(null);
                }}>
                    {t("common.cancel")}
                </Button>
                <Button
                    variant="contained"
                    onClick={editingAnnouncement
                        ? () => {
                            handleUpdateAnnouncement(editingAnnouncement._id, announcementForm);
                            setShowAnnouncementDialog(false);
                            setEditingAnnouncement(null);
                        }
                        : handleCreateAnnouncement
                    }
                    disabled={!announcementForm.title.trim() || !announcementForm.message.trim()}
                >
                    {editingAnnouncement ? t("announcement.update") : t("announcement.create")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AnnouncementCreateEditDialog;
