import React, { useContext, useState } from "react";

import {
    Alert,
    Box,
    Button,
    Stack,
    Typography,
} from "@mui/material";

import { Add as AddIcon } from "@mui/icons-material";

import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import toast from "react-hot-toast";

import { AuthContext } from "../../context/AuthContext";
import { updateHackathonAnnouncement } from "../../api/hackathons";

import AnnouncementList from "../announcements/AnnouncementList";
import AnnouncementCreateEditDialog from "../announcements/AnnouncementCreateEditDialog";

const AnnouncementsTab = ({ myRole, loadAnnouncements, announcementsLoading, announcements }) => {
    const { token, user } = useContext(AuthContext);
    const { t } = useTranslation();
    const { id } = useParams();
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);
    const [announcementForm, setAnnouncementForm] = useState({ title: "", message: "" });
    const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);

    const handleUpdateAnnouncement = async (announcementId, updatedData) => {
        try {
            await updateHackathonAnnouncement(id, announcementId, updatedData, token);
            toast.success(t("announcement.announcement_updated"));
            loadAnnouncements();
        } catch (error) {
            console.error("Error updating announcement:", error);
            toast.error(error.response?.data?.message || t("announcement.update_failed"));
        }
    };

    return (
        <>
            <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                    <Typography variant="h5" gutterBottom>
                        {t("announcement.announcements")}
                    </Typography>
                    {((myRole === "organizer" || user?.role === "admin")) && (
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => {
                                setEditingAnnouncement(null);
                                setAnnouncementForm({ title: "", message: "" });
                                setShowAnnouncementDialog(true);
                            }}
                        >
                            {t("announcement.create_announcement")}
                        </Button>
                    )}
                </Box>

                {announcementsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <Typography>{t("common.loading")}</Typography>
                    </Box>
                ) : announcements.length === 0 ? (
                    <Alert severity="info">
                        {t("announcement.no_announcements")}
                    </Alert>
                ) : (
                    <Stack spacing={2}>
                        <AnnouncementList />
                    </Stack>
                )}
            </Box>

            {/* Announcement Create/Edit Dialog */}
            <AnnouncementCreateEditDialog 
                id={id} announcementForm={announcementForm} 
                showAnnouncementDialog={showAnnouncementDialog} 
                setShowAnnouncementDialog={setShowAnnouncementDialog} 
                setAnnouncementForm={setAnnouncementForm} 
                loadAnnouncements={loadAnnouncements}
                editingAnnouncement={editingAnnouncement}
                setEditingAnnouncement={setEditingAnnouncement}
                handleUpdateAnnouncement={handleUpdateAnnouncement}
            />
        </>
    );
};

export default AnnouncementsTab;