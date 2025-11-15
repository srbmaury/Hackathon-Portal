import React, { useContext, useRef } from "react";
import { Typography } from "@mui/material";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useTranslation } from "react-i18next";
import AnnouncementList from "../components/announcements/AnnouncementList";
import AnnouncementCreate from "../components/announcements/AnnouncementCreate";
import { AuthContext } from "../context/AuthContext";

const AnnouncementsPage = () => {
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);
    const announcementListRef = useRef(null);

    const handleAnnouncementCreated = () => {
        // Trigger refresh by calling fetchAnnouncements directly instead of remounting
        if (announcementListRef.current) {
            announcementListRef.current.refresh();
        }
    };

    return (
        <DashboardLayout>
            <Typography variant="h4" gutterBottom>
                {t("announcement.announcements")}
            </Typography>

            {(user.role === "admin" || user.role === "organizer") && (
                <AnnouncementCreate onCreated={handleAnnouncementCreated} />
            )}

            <AnnouncementList ref={announcementListRef} />
        </DashboardLayout>
    );
};

export default AnnouncementsPage;
