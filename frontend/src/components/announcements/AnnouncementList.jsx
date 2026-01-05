import React, {
    forwardRef,
    useCallback,
    useContext,
    useEffect,
    useImperativeHandle,
    useState,
} from "react";

import {
    Alert,
    Box,
    CircularProgress,
    Pagination,
    Paper,
    Typography,
} from "@mui/material";

import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AuthContext } from "../../context/AuthContext";
import { getSocket } from "../../services/socket";
import { getHackathonAnnouncements } from "../../api/hackathons";

import AnnouncementItem from "./AnnouncementItem";

const AnnouncementList = forwardRef((props, ref) => {
    const { id } = useParams();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    const { t } = useTranslation();
    const { user, token } = useContext(AuthContext);

    const fetchAnnouncements = useCallback(async (pageNum = 1) => {
        if (!token) {
            setError(t("announcement.get_failed") || "Authentication required");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const response = await getHackathonAnnouncements(id, token, pageNum, limit);
            setAnnouncements(response.announcements || []);
            setTotalPages(response.totalPages || 1);
            setTotal(response.total || 0);
        } catch (err) {
            console.error("Error fetching announcements:", err);
            setError(err.response?.data?.message || t("announcement.get_failed") || "Failed to fetch announcements");
            setAnnouncements([]);
        } finally {
            setLoading(false);
        }
    }, [id, token, t]);

    // Expose refresh method to parent component
    useImperativeHandle(ref, () => ({
        refresh: () => {
            fetchAnnouncements(page);
        },
    }));

    useEffect(() => {
        fetchAnnouncements(page);
    }, [page, fetchAnnouncements]);

    // Set up WebSocket listeners for real-time updates
    useEffect(() => {
        const socket = getSocket();

        if (!socket) {
            return;
        }

        // Handle announcement deletion from WebSocket
        const handleAnnouncementDeleted = (data) => {
            // Immediately remove the announcement from the list
            setAnnouncements((prevAnnouncements) => {
                const filtered = prevAnnouncements.filter(
                    (announcement) => announcement._id !== data.announcementId
                );

                // If we're on a page that becomes empty, go to previous page
                if (filtered.length === 0 && page > 1) {
                    setPage(page - 1);
                }

                return filtered;
            });

            // Update total count
            setTotal((prevTotal) => Math.max(0, prevTotal - 1));
        };

        // Handle new announcement creation
        const handleAnnouncementCreated = () => {
            // Refresh the list to get the new announcement
            // The backend getAll() returns all announcements for the organization
            // so we refresh to see if the new announcement should appear on current page
            fetchAnnouncements(page);
        };

        // Handle announcement updates from WebSocket
        const handleAnnouncementUpdatedFromSocket = (data) => {
            setAnnouncements((prevAnnouncements) =>
                prevAnnouncements.map((announcement) =>
                    announcement._id === data.announcementId
                        ? { ...announcement, ...data.updates }
                        : announcement
                )
            );
        };

        // Register socket listeners
        socket.on("announcement_deleted", handleAnnouncementDeleted);
        socket.on("announcement_created", handleAnnouncementCreated);
        socket.on("announcement_updated", handleAnnouncementUpdatedFromSocket);

        // Cleanup listeners on unmount
        return () => {
            socket.off("announcement_deleted", handleAnnouncementDeleted);
            socket.off("announcement_created", handleAnnouncementCreated);
            socket.off("announcement_updated", handleAnnouncementUpdatedFromSocket);
        };
    }, [page, fetchAnnouncements]);

    const handlePageChange = (event, value) => {
        setPage(value);
        // Scroll to top when page changes
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleAnnouncementUpdated = (announcementId, updates) => {
        setAnnouncements((prevAnnouncements) =>
            prevAnnouncements.map((announcement) =>
                announcement._id === announcementId
                    ? { ...announcement, ...updates }
                    : announcement
            )
        );
    };

    if (loading && announcements.length === 0) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "400px",
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                {error}
            </Alert>
        );
    }

    if (announcements.length === 0) {
        return (
            <Paper
                sx={{
                    p: 4,
                    mt: 2,
                    textAlign: "center",
                    backgroundColor: "background.paper",
                }}
            >
                <Typography variant="h6" color="text.secondary">
                    {t("announcement.no_announcements") || "No announcements yet"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t("announcement.no_announcements_subtext") || "Check back later for updates"}
                </Typography>
            </Paper>
        );
    }

    return (
        <Box sx={{ mt: 3 }}>
            {/* Announcements List */}
            <Box sx={{ mb: 3 }}>
                {announcements.map((announcement) => (
                    <AnnouncementItem
                        key={announcement._id}
                        announcement={announcement}
                        user={user}
                        onUpdated={(updates) => handleAnnouncementUpdated(announcement._id, updates)}
                        hackathonId={announcement.hackathon?._id || null}
                        myRole={props?.myRole}
                    />
                ))}
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        mt: 4,
                        mb: 2,
                    }}
                >
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={handlePageChange}
                        color="primary"
                        size="large"
                        showFirstButton
                        showLastButton
                    />
                </Box>
            )}

            {/* Results count */}
            {total > 0 && (
                <Box sx={{ textAlign: "center", mt: 2, mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t("announcement.showing_results", {
                            start: (page - 1) * limit + 1,
                            end: Math.min(page * limit, total),
                            total: total,
                        }) || `Showing ${(page - 1) * limit + 1}-${Math.min(page * limit, total)} of ${total} announcements`}
                    </Typography>
                </Box>
            )}
        </Box>
    );
});

AnnouncementList.displayName = "AnnouncementList";

export default AnnouncementList;

