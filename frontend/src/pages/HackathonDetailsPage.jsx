import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

import {
    Alert,
    Box,
    Container,
    Typography
} from "@mui/material";

import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

import { useAuth } from "../context/AuthContext";

import {
    getHackathonAnnouncements,
    getHackathonById,
    getHackathonMembers,
    getMyHackathonRole
} from "../api/hackathons";

import { getAllUsers } from "../api/users";

import {
    getHackathonTeams,
    getMyTeam
} from "../api/registrations";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import ConfirmDialog from "../components/common/ConfirmDialog";
import InfoModal from "../components/common/InfoModal";
import HackathonPageHeader from "../components/hackathons/HackathonPageHeader";
import OverviewTab from "../components/hackathons/OverviewTab";
import MembersTab from "../components/hackathons/MembersTab";
import AnnouncementsTab from "../components/hackathons/AnnouncementsTab";
import TeamsTab from "../components/hackathons/TeamsTab";
import HackathonRegisterModal from "../components/teams/HackathonRegisterModal";
import DemoStagePage from "./DemoStagePage";

import { getSocket } from "../services/socket";

const HackathonDetailsPage = () => {
    const { id } = useParams();
    const { token, user } = useAuth();
    const { t } = useTranslation();
    const [hackathon, setHackathon] = useState(null);
    const [myRole, setMyRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    // Members state
    const [members, setMembers] = useState([]);
    const [membersByRole, setMembersByRole] = useState({});
    const [allUsers, setAllUsers] = useState([]);

    // Teams state
    const [teams, setTeams] = useState([]);
    const [teamsLoading, setTeamsLoading] = useState(false);
    const [myTeam, setMyTeam] = useState(null);

    // Registration dialog
    const [showRegisterDialog, setShowRegisterDialog] = useState(false);

    // Callback to reload team and teams after registration/edit
    const handleRegistered = async () => {
        await loadHackathonData();
        await loadTeams();
    };

    // Announcements state
    const [announcements, setAnnouncements] = useState([]);
    const [announcementsLoading, setAnnouncementsLoading] = useState(false);

    // Modal states
    const [infoModal, setInfoModal] = useState({
        open: false,
        type: "info",
        message: "",
    });
    const [confirmDialog, setConfirmDialog] = useState({
        open: false,
        title: "",
        message: "",
        onConfirm: null,
    });

    useEffect(() => {
        loadHackathonData();
    }, [id, token]);

    useEffect(() => {
        // Calculate tab indices based on whether user has a role
        const announcementsTabIndex = myRole ? 2 : 1; // After Overview, and Members (if exists)
        const teamsTabIndex = myRole ? 3 : 2; // After Announcements
        const demoStageTabIndex = myRole ? 4 : 3; // After Teams

        if (myRole && activeTab === 1) {
            // Members tab (only visible when user has a role)
            loadMembers();
            if (user?.role === "admin" || myRole === "organizer") {
                loadAllUsers();
            }
        } else if (activeTab === announcementsTabIndex) {
            // Announcements tab
            loadAnnouncements();
        } else if (activeTab === teamsTabIndex) {
            // Teams tab
            loadTeams();
        } else if (activeTab === demoStageTabIndex) {
            // Demo Stage tab
            loadTeams();
        }
    }, [activeTab, myRole]);

    // Listen for real-time team updates via WebSocket
    useEffect(() => {
        const handleTeamUpdate = (event) => {
            const { eventType, team } = event.detail;

            // Only process updates for the current hackathon
            if (
                team.hackathon &&
                String(team.hackathon._id || team.hackathon) === String(id)
            ) {
                if (eventType === "created") {
                    setTeams((prev) => [team, ...prev]);
                    // Reload user's team if they registered
                    if (
                        team.members?.some(
                            (m) => String(m._id || m) === String(user?._id)
                        )
                    ) {
                        loadHackathonData();
                    }
                } else if (eventType === "updated") {
                    setTeams((prev) =>
                        prev.map((t) => (t._id === team._id ? team : t))
                    );
                } else if (eventType === "deleted") {
                    setTeams((prev) => prev.filter((t) => t._id !== team._id));
                    // Reload user's team if they withdrew
                    if (
                        team.members?.some(
                            (m) => String(m._id || m) === String(user?._id)
                        )
                    ) {
                        loadHackathonData();
                    }
                }
            }
        };

        window.addEventListener("team_updated", handleTeamUpdate);

        return () => {
            window.removeEventListener("team_updated", handleTeamUpdate);
        };
    }, [id, user?._id]);

    // Listen for real-time hackathon role updates via WebSocket
    useEffect(() => {
        const handleRoleUpdate = (event) => {
            const { hackathonId, userId } = event.detail;

            // Only process updates for the current hackathon
            if (String(hackathonId) === String(id)) {
                // Reload members to reflect the change
                if (myRole) {
                    loadMembers();
                }

                // If it's the current user's role, reload hackathon data
                if (String(userId) === String(user?._id)) {
                    loadHackathonData();
                }
            }
        };

        window.addEventListener("hackathon_role_updated", handleRoleUpdate);

        return () => {
            window.removeEventListener(
                "hackathon_role_updated",
                handleRoleUpdate
            );
        };
    }, [id, user?._id, myRole]);

    // Listen for real-time announcement updates via WebSocket
    useEffect(() => {
        const socket = getSocket();

        if (!socket) {
            return;
        }

        // Handle announcement deletion
        const handleAnnouncementDeleted = (data) => {
            // Only process deletions for announcements in this hackathon
            if (data.hackathonId && String(data.hackathonId) === String(id)) {
                // Refresh announcements list
                loadAnnouncements();
            }
        };

        // Handle announcement creation
        const handleAnnouncementCreated = (data) => {
            // Only process creations for this hackathon
            const announcementHackathonId =
                data.hackathonId ||
                (data.announcement?.hackathon
                    ? String(data.announcement.hackathon)
                    : null);
            if (
                announcementHackathonId &&
                String(announcementHackathonId) === String(id)
            ) {
                // Refresh announcements list
                loadAnnouncements();
            }
        };

        // Handle announcement updates
        const handleAnnouncementUpdated = (data) => {
            // Only process updates for announcements in this hackathon
            if (data.hackathonId && String(data.hackathonId) === String(id)) {
                // Refresh announcements list
                loadAnnouncements();
            }
        };

        // Register socket listeners
        socket.on("announcement_deleted", handleAnnouncementDeleted);
        socket.on("announcement_created", handleAnnouncementCreated);
        socket.on("announcement_updated", handleAnnouncementUpdated);

        // Cleanup listeners on unmount
        return () => {
            socket.off("announcement_deleted", handleAnnouncementDeleted);
            socket.off("announcement_created", handleAnnouncementCreated);
            socket.off("announcement_updated", handleAnnouncementUpdated);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const loadHackathonData = async () => {
        try {
            setLoading(true);
            const [hackathonData, roleData, teamData] = await Promise.all([
                getHackathonById(id, token),
                getMyHackathonRole(id, token),
                getMyTeam(id, token).catch(() => ({ team: null })), // Gracefully handle if no team
            ]);
            setHackathon(hackathonData.hackathon);
            setMyRole(roleData.hasRole ? roleData.role : null);
            setMyTeam(teamData.team || null);
        } catch (error) {
            console.error("Error loading hackathon:", error);
            toast.error(t("hackathon.fetch_failed"));
        } finally {
            setLoading(false);
        }
    };

    const loadMembers = async () => {
        try {
            const data = await getHackathonMembers(id, token);
            setMembers(data.members);
            setMembersByRole(data.membersByRole);
        } catch (error) {
            console.error("Error loading members:", error);
        }
    };

    const loadAllUsers = async () => {
        try {
            const users = await getAllUsers(token);
            setAllUsers(users || []);
        } catch (error) {
            console.error("Error loading users:", error);
            setAllUsers([]);
        }
    };

    const loadTeams = async () => {
        setTeamsLoading(true);
        try {
            const data = await getHackathonTeams(id, token);
            setTeams(data.teams || []);
        } catch (error) {
            console.error("Error loading teams:", error);
            setInfoModal({
                open: true,
                type: "error",
                message: t("hackathon_details.failed_to_load_teams"),
            });
        } finally {
            setTeamsLoading(false);
        }
    };

    const loadAnnouncements = async (page) => {
        setAnnouncementsLoading(true);
        try {
            const data = await getHackathonAnnouncements(id, token, page);
            setAnnouncements(data.announcements || []);
        } catch (error) {
            console.error("Error loading announcements:", error);
            setInfoModal({
                open: true,
                type: "error",
                message: t("hackathon_details.failed_to_load_announcements"),
            });
        } finally {
            setAnnouncementsLoading(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <Container maxWidth="lg">
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            minHeight: "60vh",
                        }}
                    >
                        <Typography variant="h5">
                            {t("common.loading")}
                        </Typography>
                    </Box>
                </Container>
            </DashboardLayout>
        );
    }

    if (!hackathon) {
        return (
            <DashboardLayout>
                <Container maxWidth="lg">
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            minHeight: "60vh",
                        }}
                    >
                        <Alert severity="error">
                            {t("hackathon.not_found")}
                        </Alert>
                    </Box>
                </Container>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <Container maxWidth="lg">
                {/* Header */}
                <HackathonPageHeader
                    hackathon={hackathon}
                    myRole={myRole}
                    myTeam={myTeam}
                    setConfirmDialog={setConfirmDialog}
                    setInfoModal={setInfoModal}
                    setMyTeam={setMyTeam}
                    loadHackathonData={loadHackathonData}
                    loadMembers={loadMembers}
                    loadTeams={loadTeams}
                    setShowRegisterDialog={setShowRegisterDialog}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                />

                {/* Tab Panels */}
                <Box>
                    {/* Overview Tab */}
                    {activeTab === 0 && (
                        <OverviewTab
                            hackathon={hackathon}
                            id={id}
                            activeTab={activeTab}
                            setInfoModal={setInfoModal}
                        />
                    )}

                    {/* Members Tab */}
                    {activeTab === 1 && myRole && (
                        <MembersTab
                            myRole={myRole}
                            id={id}
                            setConfirmDialog={setConfirmDialog}
                            setInfoModal={setInfoModal}
                            loadTeams={loadTeams}
                            loadMembers={loadMembers}
                            allUsers={allUsers}
                            members={members}
                            membersByRole={membersByRole}
                        />
                    )}

                    {/* Announcements Tab */}
                    {((myRole && activeTab === 2) ||
                        (!myRole && activeTab === 1)) && (
                            <AnnouncementsTab
                                myRole={myRole}
                                loadAnnouncements={loadAnnouncements}
                                announcementsLoading={announcementsLoading}
                                announcements={announcements}
                            />
                        )}

                    {/* Teams Tab */}
                    {((myRole && activeTab === 3) ||
                        (!myRole && activeTab === 2)) && (
                            <TeamsTab
                                teams={teams}
                                teamsLoading={teamsLoading}
                                myTeam={myTeam}
                                myRole={myRole}
                            />
                        )}

                    {/* Demo Stage Tab */}
                    {((myRole && activeTab === 4) ||
                        (!myRole && activeTab === 3)) && (
                            <DemoStagePage hackathonId={id} myRole={myRole} teams={teams} />
                        )}
                </Box>

                {/* Registration Dialog */}
                <HackathonRegisterModal
                    open={showRegisterDialog}
                    onClose={() => setShowRegisterDialog(false)}
                    hackathon={hackathon}
                    team={myTeam}
                    onRegistered={handleRegistered}
                />

                {/* Info Modal */}
                <InfoModal
                    open={infoModal.open}
                    onClose={() =>
                        setInfoModal({ open: false, type: "info", message: "" })
                    }
                    type={infoModal.type}
                    message={infoModal.message}
                />

                {/* Confirm Dialog */}
                <ConfirmDialog
                    open={confirmDialog.open}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={() => {
                        if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                    }}
                    onCancel={() =>
                        setConfirmDialog({
                            open: false,
                            title: "",
                            message: "",
                            onConfirm: null,
                        })
                    }
                />
            </Container>
        </DashboardLayout>
    );
};

export default HackathonDetailsPage;
