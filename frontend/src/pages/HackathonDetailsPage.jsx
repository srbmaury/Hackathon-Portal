import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Container,
    Box,
    Typography,
    Tabs,
    Tab,
    Paper,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Card,
    CardContent,
    Chip,
    Alert,
    Divider,
    Grid,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Autocomplete,
    CircularProgress,
    IconButton,
} from "@mui/material";
import {
        ArrowBack as ArrowBackIcon,
        Add as AddIcon,
        PersonAdd as PersonAddIcon,
        HowToReg as HowToRegIcon,
        Description as DescriptionIcon,
        CalendarToday as CalendarIcon,
        Timer as TimerIcon,
        CheckCircle as CheckCircleIcon,
        Cancel as CancelIcon,
        ExitToApp as ExitToAppIcon,
        AutoAwesome as AutoAwesomeIcon,
        Message as MessageIcon,
    } from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import { 
    getHackathonById, 
    getMyHackathonRole,
    getHackathonMembers,
    assignHackathonRole,
    removeHackathonRole,
    getHackathonAnnouncements,
    createHackathonAnnouncement,
    updateHackathonAnnouncement,
    assignMentorsToTeams,
} from "../api/hackathons";
import { getAllUsers } from "../api/users";
import { getUserIdeas } from "../api/ideas";
import { registerForHackathon, getHackathonTeams, getMyTeam, withdrawTeam } from "../api/registrations";
import { formatAnnouncement } from "../api/announcements";
import { useTranslation } from "react-i18next";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import toast from "react-hot-toast";
import AnnouncementItem from "../components/announcements/AnnouncementItem";
import { Announcement as AnnouncementIcon } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import MDEditor from "@uiw/react-md-editor";
import InfoModal from "../components/common/InfoModal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import { getSocket } from "../services/socket";

const HackathonDetailsPage = () => {
    const { id } = useParams();
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const theme = useTheme();

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
    const [registrationForm, setRegistrationForm] = useState({
        teamName: "",
        ideaId: "",
        memberIds: []
    });
    const [userIdeas, setUserIdeas] = useState([]);
    
    // Add member state (for organizers)
    const [memberForm, setMemberForm] = useState({ userId: "", role: "participant" });

    // Announcements state
    const [announcements, setAnnouncements] = useState([]);
    const [announcementsLoading, setAnnouncementsLoading] = useState(false);
    const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
    const [announcementForm, setAnnouncementForm] = useState({ title: "", message: "" });
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);
    const [formattingAnnouncement, setFormattingAnnouncement] = useState(false);

    // Modal states
    const [infoModal, setInfoModal] = useState({ open: false, type: "info", message: "" });
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: "", message: "", onConfirm: null });
    const [assigningMentors, setAssigningMentors] = useState(false);

    useEffect(() => {
        loadHackathonData();
    }, [id, token]);

    useEffect(() => {
        // Calculate tab indices based on whether user has a role
        const announcementsTabIndex = myRole ? 2 : 1; // After Overview, and Members (if exists)
        const teamsTabIndex = myRole ? 3 : 2; // After Announcements
        
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
        }
    }, [activeTab, myRole]);

    // Listen for real-time team updates via WebSocket
    useEffect(() => {
        const handleTeamUpdate = (event) => {
            const { eventType, team } = event.detail;
            
            // Only process updates for the current hackathon
            if (team.hackathon && String(team.hackathon._id || team.hackathon) === String(id)) {
                console.log("Team update received:", eventType, team);
                
                if (eventType === "created") {
                    setTeams((prev) => [team, ...prev]);
                    // Reload user's team if they registered
                    if (team.members?.some(m => String(m._id || m) === String(user?._id))) {
                        loadHackathonData();
                    }
                } else if (eventType === "updated") {
                    setTeams((prev) =>
                        prev.map((t) => (t._id === team._id ? team : t))
                    );
                } else if (eventType === "deleted") {
                    setTeams((prev) => prev.filter((t) => t._id !== team._id));
                    // Reload user's team if they withdrew
                    if (team.members?.some(m => String(m._id || m) === String(user?._id))) {
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
            const { eventType, hackathonId, userId, role } = event.detail;
            
            // Only process updates for the current hackathon
            if (String(hackathonId) === String(id)) {
                console.log("Hackathon role update received:", eventType, userId, role);
                
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
            window.removeEventListener("hackathon_role_updated", handleRoleUpdate);
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
            const announcementHackathonId = data.hackathonId || (data.announcement?.hackathon ? String(data.announcement.hackathon) : null);
            if (announcementHackathonId && String(announcementHackathonId) === String(id)) {
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
                getMyTeam(id, token).catch(() => ({ team: null })) // Gracefully handle if no team
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
            setInfoModal({ open: true, type: "error", message: t("hackathon_details.failed_to_load_teams") });
        } finally {
            setTeamsLoading(false);
        }
    };

    const loadAnnouncements = async () => {
        setAnnouncementsLoading(true);
        try {
            const data = await getHackathonAnnouncements(id, token);
            setAnnouncements(data.announcements || []);
        } catch (error) {
            console.error("Error loading announcements:", error);
            setInfoModal({ open: true, type: "error", message: t("hackathon_details.failed_to_load_announcements") });
        } finally {
            setAnnouncementsLoading(false);
        }
    };

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

    const handleDeleteAnnouncement = async (announcementId) => {
        // Note: This function is kept for backward compatibility but is no longer used
        // Deletion is now handled via WebSocket in AnnouncementItem component
        // The WebSocket listener above will refresh the list automatically
    };

    // Load user ideas and users when opening registration dialog
    const handleOpenRegisterDialog = async () => {
        setShowRegisterDialog(true);
        try {
            const [ideas, users] = await Promise.all([
                getUserIdeas(token),
                getAllUsers(token)
            ]);
            setUserIdeas(Array.isArray(ideas) ? ideas : []);
            setAllUsers(Array.isArray(users) ? users : []);
        } catch (error) {
            console.error("Error loading registration data:", error);
            setInfoModal({ open: true, type: "error", message: t("hackathon_details.failed_to_load_registration_data") });
            setUserIdeas([]);
            setAllUsers([]);
        }
    };

    // Helper functions for team size validation
    const getTeamSizeConstraints = () => {
        if (!hackathon) return { min: 1, max: 5 };
        return {
            min: hackathon.mnimumTeamSize || hackathon.minimumTeamSize || 1,
            max: hackathon.maximumTeamSize || 5,
        };
    };

    const getCurrentTeamSize = () => {
        // Include the current user + selected members
        return 1 + (registrationForm.memberIds?.length || 0);
    };

    const isTeamSizeValid = () => {
        const size = getCurrentTeamSize();
        const constraints = getTeamSizeConstraints();
        return size >= constraints.min && size <= constraints.max;
    };

    const handleRegister = async () => {
        try {
            if (!registrationForm.teamName.trim()) {
                setInfoModal({ open: true, type: "error", message: t("hackathon_details.please_enter_team_name") });
                return;
            }
            if (!registrationForm.ideaId) {
                setInfoModal({ open: true, type: "error", message: t("hackathon_details.please_select_idea") });
                return;
            }

            // Validate team size
            const constraints = getTeamSizeConstraints();
            const currentSize = getCurrentTeamSize();
            
            if (currentSize < constraints.min) {
                setInfoModal({ 
                    open: true, 
                    type: "error", 
                    message: t("hackathon.team_size_too_small", { min: constraints.min, current: currentSize }) 
                });
                return;
            }
            
            if (currentSize > constraints.max) {
                setInfoModal({ 
                    open: true, 
                    type: "error", 
                    message: t("hackathon.team_size_too_large", { max: constraints.max, current: currentSize }) 
                });
                return;
            }

            const registrationData = {
                teamName: registrationForm.teamName,
                ideaId: registrationForm.ideaId,
                memberIds: registrationForm.memberIds
            };

            await registerForHackathon(id, registrationData, token);
            setInfoModal({ open: true, type: "success", message: t("hackathon_details.register_success") });
            setShowRegisterDialog(false);
            setRegistrationForm({
                teamName: "",
                ideaId: "",
                memberIds: []
            });
            loadHackathonData();
            loadMembers();
            loadTeams();
        } catch (error) {
            console.error("Error registering:", error);
            setInfoModal({ open: true, type: "error", message: error.response?.data?.message || t("hackathon_details.register_failed") });
        }
    };

    const handleWithdraw = async () => {
        if (!myTeam) return;
        
        setConfirmDialog({
            open: true,
            title: t("hackathon_details.withdraw_confirm_title"),
            message: t("hackathon_details.withdraw_confirm_message"),
            onConfirm: async () => {
                try {
                    await withdrawTeam(id, myTeam._id, token);
                    setInfoModal({ open: true, type: "success", message: t("hackathon_details.withdraw_success") });
                    setMyTeam(null);
                    loadHackathonData();
                    loadMembers();
                    loadTeams();
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: null });
                } catch (error) {
                    console.error("Error withdrawing:", error);
                    setInfoModal({ open: true, type: "error", message: error.response?.data?.message || t("hackathon_details.withdraw_failed") });
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: null });
                }
            }
        });
    };

    const handleAssignRole = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!memberForm.userId) {
                setInfoModal({ open: true, type: "error", message: t("hackathon_details.please_select_user") });
                return;
            }
            await assignHackathonRole(id, memberForm.userId, memberForm.role, token);
            setMemberForm({ userId: "", role: "participant" });
            loadMembers();
            setInfoModal({ open: true, type: "success", message: t("hackathon_details.role_assigned_success") });
        } catch (error) {
            console.error("Error assigning role:", error);
            setInfoModal({ open: true, type: "error", message: error.response?.data?.message || t("hackathon_details.role_assigned_failed") });
        }
    };

    const handleChangeRole = async (userId, newRole) => {
        try {
            await assignHackathonRole(id, userId, newRole, token);
            loadMembers();
            setInfoModal({ open: true, type: "success", message: t("hackathon_details.role_changed_success") });
        } catch (error) {
            console.error("Error changing role:", error);
            setInfoModal({ open: true, type: "error", message: error.response?.data?.message || t("hackathon_details.role_changed_failed") });
        }
    };

    // Handle opening round details - navigate to page if active, otherwise show info
    const handleOpenRound = (round) => {
        if (isRoundCurrentlyActive(round)) {
            // Navigate to round details page
            navigate(`/hackathons/${id}/rounds/${round._id}`);
        } else {
            // Show info that round is not active
            setInfoModal({ open: true, type: "info", message: t("hackathon_details.round_not_active") });
        }
    };


    // Check if round is currently active (within date range and isActive flag)
    const isRoundCurrentlyActive = (round) => {
        if (!round.isActive) return false;
        const now = new Date();
        if (round.startDate && now < new Date(round.startDate)) return false;
        if (round.endDate && now > new Date(round.endDate)) return false;
        return true;
    };

    const handleRemoveRole = async (userId) => {
        setConfirmDialog({
            open: true,
            title: t("common.confirm_title"),
            message: t("hackathon_details.remove_member_confirm"),
            onConfirm: async () => {
                try {
                    await removeHackathonRole(id, userId, token);
                    loadMembers();
                    setInfoModal({ open: true, type: "success", message: t("hackathon_details.member_removed_success") });
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: null });
                } catch (error) {
                    console.error("Error removing role:", error);
                    setInfoModal({ open: true, type: "error", message: t("hackathon_details.member_removed_failed") });
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: null });
                }
            }
        });
    };

    const canManageHackathon = user?.role === "admin" || myRole === "organizer";

    const handleAssignMentors = async () => {
        setAssigningMentors(true);
        try {
            const result = await assignMentorsToTeams(id, token);
            setInfoModal({
                open: true,
                type: "success",
                message: t("mentor.assignment_success_message", {
                    totalTeams: result.totalTeams,
                    totalMentors: result.totalMentors,
                }) || `Successfully assigned ${result.totalTeams} teams to ${result.totalMentors} mentors`,
            });
            // Reload teams to show mentor assignments
            loadTeams();
            loadMembers();
        } catch (error) {
            console.error("Error assigning mentors:", error);
            setInfoModal({
                open: true,
                type: "error",
                message: error.response?.data?.message || t("mentor.assignment_failed"),
            });
        } finally {
            setAssigningMentors(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <Container maxWidth="lg">
                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                        <Typography variant="h5">{t("common.loading")}</Typography>
                    </Box>
                </Container>
            </DashboardLayout>
        );
    }

    if (!hackathon) {
        return (
            <DashboardLayout>
                <Container maxWidth="lg">
                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                        <Alert severity="error">{t("hackathon.not_found")}</Alert>
                    </Box>
                </Container>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <Container maxWidth="lg">
                {/* Header */}
                <Box sx={{ mb: 4 }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate("/hackathons")}
                        sx={{ mb: 2 }}
                    >
                        {t("common.back")}
                    </Button>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <Typography variant="h4" fontWeight={700}>
                                {hackathon.title}
                            </Typography>
                            {myRole && (
                                <Chip 
                                    label={t(`roles.${myRole}`)} 
                                    color="primary" 
                                    size="medium"
                                />
                            )}
                        </Box>
                        {myTeam && hackathon.isActive && (
                            <Button
                                variant="outlined"
                                color="error"
                                size="large"
                                startIcon={<ExitToAppIcon />}
                                onClick={handleWithdraw}
                            >
                                Withdraw
                            </Button>
                        )}
                        {!myTeam && !myRole && hackathon.isActive && (
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={<HowToRegIcon />}
                                onClick={handleOpenRegisterDialog}
                            >
                                Register
                            </Button>
                        )}
                    </Box>
                </Box>

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                    <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                        <Tab label={t("hackathon.overview")} />
                        {myRole && <Tab label={t("members.title")} />}
                        <Tab label={t("announcement.announcements")} icon={<AnnouncementIcon />} iconPosition="start" />
                        <Tab label={t("teams.title")} />
                    </Tabs>
                </Box>

                {/* Tab Panels */}
                <Box>
                    {/* Overview Tab */}
                    {activeTab === 0 && (
                        <Stack spacing={3}>
                            {/* Description Card */}
                            <Card elevation={2}>
                                <CardContent sx={{ p: 4 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                                        <DescriptionIcon color="primary" />
                                        <Typography variant="h5" fontWeight={600}>
                                            {t("hackathon.description")}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body1" sx={{ 
                                        lineHeight: 1.8, 
                                        whiteSpace: "pre-wrap",
                                        color: "text.secondary" 
                                    }}>
                                        {hackathon.description}
                                    </Typography>
                                </CardContent>
                            </Card>

                            {/* Quick Info Cards */}
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                    <Card elevation={1} sx={{ 
                                        height: "100%",
                                        background: hackathon.isActive 
                                            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                                            : "linear-gradient(135deg, #bdc3c7 0%, #7f8c8d 100%)",
                                        color: "white"
                                    }}>
                                        <CardContent>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                                {hackathon.isActive ? (
                                                    <CheckCircleIcon sx={{ fontSize: 32 }} />
                                                ) : (
                                                    <CancelIcon sx={{ fontSize: 32 }} />
                                                )}
                                                <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                                                    {t("hackathon.status")}
                                                </Typography>
                                            </Box>
                                            <Typography variant="h5" fontWeight={700}>
                                                {hackathon.isActive ? t("hackathon.active") : t("hackathon.inactive")}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <Card elevation={1} sx={{ 
                                        height: "100%",
                                        background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                                        color: "white"
                                    }}>
                                        <CardContent>
                                            <Typography variant="subtitle2" sx={{ opacity: 0.9, mb: 1 }}>
                                                {t("hackathon.created_by")}
                                            </Typography>
                                            <Typography variant="h5" fontWeight={700}>
                                                {hackathon.createdBy?.name}
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                                                {hackathon.createdBy?.email}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>

                            {/* Rounds Section */}
                            {hackathon.rounds && hackathon.rounds.length > 0 && (
                                <Card elevation={2}>
                                    <CardContent sx={{ p: 4 }}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                                            <TimerIcon color="primary" />
                                            <Typography variant="h5" fontWeight={600}>
                                                {t("hackathon.rounds")} ({hackathon.rounds.length})
                                            </Typography>
                                        </Box>
                                        <Stack spacing={2}>
                                            {hackathon.rounds.map((round, index) => (
                                                <Card 
                                                    key={round._id} 
                                                    variant="outlined"
                                                    onClick={() => handleOpenRound(round)}
                                                    sx={{ 
                                                        borderLeft: 4,
                                                        borderLeftColor: round.isActive ? "success.main" : "grey.300",
                                                        transition: "all 0.3s",
                                                        cursor: isRoundCurrentlyActive(round) ? "pointer" : "default",
                                                        "&:hover": {
                                                            boxShadow: isRoundCurrentlyActive(round) ? 3 : 1,
                                                            transform: isRoundCurrentlyActive(round) ? "translateX(4px)" : "none"
                                                        }
                                                    }}
                                                >
                                                    <CardContent>
                                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                                                            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                                                <Chip 
                                                                    label={t("hackathon.round_label", { number: index + 1 })} 
                                                                    size="small"
                                                                    color="primary"
                                                                    variant="outlined"
                                                                />
                                                                <Typography variant="h6" fontWeight={600}>
                                                                    {round.name}
                                                                </Typography>
                                                            </Box>
                                                            <Chip 
                                                                label={round.isActive ? t("hackathon.active") : t("hackathon.inactive")}
                                                                size="small"
                                                                color={round.isActive ? "success" : "default"}
                                                            />
                                                        </Box>
                                                        
                                                        {round.description && (
                                                            <Typography 
                                                                variant="body2" 
                                                                color="text.secondary" 
                                                                sx={{ mb: 2, lineHeight: 1.6 }}
                                                            >
                                                                {round.description}
                                                            </Typography>
                                                        )}
                                                        
                                                        {round.startDate && round.endDate && (
                                                            <Box sx={{ 
                                                                display: "flex", 
                                                                alignItems: "center", 
                                                                gap: 1,
                                                                p: 1.5,
                                                                bgcolor: "action.hover",
                                                                borderRadius: 1
                                                            }}>
                                                                <CalendarIcon sx={{ fontSize: 20, color: "text.secondary" }} />
                                                                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                                                    {new Date(round.startDate).toLocaleDateString("en-US", { 
                                                                        month: "short", 
                                                                        day: "numeric", 
                                                                        year: "numeric" 
                                                                    })}
                                                                    {" → "}
                                                                    {new Date(round.endDate).toLocaleDateString("en-US", { 
                                                                        month: "short", 
                                                                        day: "numeric", 
                                                                        year: "numeric" 
                                                                    })}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            )}
                        </Stack>
                    )}

                    {/* Members Tab */}
                    {activeTab === 1 && myRole && (
                        <Box>
                            {/* Assign Mentors Section */}
                            {canManageHackathon && (
                                <Card elevation={2} sx={{ mb: 3 }}>
                                    <CardContent>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                                            <Box>
                                                <Typography variant="h6" gutterBottom>
                                                    {t("mentor.assign_teams")}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t("mentor.assign_teams_description")}
                                                </Typography>
                                            </Box>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                onClick={handleAssignMentors}
                                                disabled={assigningMentors}
                                                startIcon={assigningMentors ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
                                            >
                                                {assigningMentors ? t("mentor.assigning") : t("mentor.assign_mentors")}
                                            </Button>
                                        </Box>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Add Member Section */}
                            {canManageHackathon && (
                                <Card elevation={2} sx={{ mb: 3 }}>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            {t("members.add")}
                                        </Typography>
                                        <Stack spacing={2}>
                                            <Autocomplete
                                                options={allUsers.filter(u => u.role === "user")}
                                                getOptionLabel={(option) => `${option.name} (${option.email})`}
                                                value={allUsers.find(u => u._id === memberForm.userId && u.role === "user") || null}
                                                onChange={(event, newValue) => {
                                                    setMemberForm({ ...memberForm, userId: newValue?._id || "" });
                                                }}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label={t("members.select_user")}
                                                        placeholder={t("members.choose_user")}
                                                    />
                                                )}
                                                filterOptions={(options, { inputValue }) => {
                                                    // Filter out users who already have a role in this hackathon
                                                    // Only show users with organization role = "user"
                                                    const existingUserIds = members.map(m => m.user?._id);
                                                    return options.filter(
                                                        option =>
                                                            option.role === "user" &&
                                                            !existingUserIds.includes(option._id) &&
                                                            (option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                                                                option.email.toLowerCase().includes(inputValue.toLowerCase()))
                                                    );
                                                }}
                                            />
                                            <Box sx={{ display: "flex", gap: 2 }}>
                                                <FormControl sx={{ minWidth: 200 }}>
                                                    <InputLabel>{t("members.role")}</InputLabel>
                                                    <Select
                                                        value={memberForm.role}
                                                        onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                                                        label={t("members.role")}
                                                    >
                                                        <MenuItem value="participant">{t("roles.participant")}</MenuItem>
                                                        <MenuItem value="mentor">{t("roles.mentor")}</MenuItem>
                                                        <MenuItem value="judge">{t("roles.judge")}</MenuItem>
                                                        <MenuItem value="organizer">{t("roles.organizer")}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <Button
                                                    variant="contained"
                                                    startIcon={<PersonAddIcon />}
                                                    onClick={handleAssignRole}
                                                    disabled={!memberForm.userId}
                                                >
                                                    {t("members.assign")}
                                                </Button>
                                            </Box>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Members List by Role */}
                            <Stack spacing={3}>
                                {["organizer", "judge", "mentor", "participant"].map((role) => (
                                    membersByRole[role] && membersByRole[role].length > 0 && (
                                        <Card key={role} elevation={2}>
                                            <CardContent>
                                                <Typography variant="h6" gutterBottom sx={{ textTransform: "capitalize", mb: 2 }}>
                                                    {t(`roles.${role}_plural`, { defaultValue: `${t(`roles.${role}`)}s` })} ({membersByRole[role].length})
                                                </Typography>
                                                <Stack spacing={2}>
                                                    {membersByRole[role].map((member) => (
                                                        <Card key={member._id} variant="outlined">
                                                            <CardContent>
                                                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                                    <Box sx={{ flex: 1 }}>
                                                                        <Typography variant="body1" fontWeight={600}>
                                                                            {member.user?.name}
                                                                        </Typography>
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            {member.user?.email}
                                                                        </Typography>
                                                                        {member.user?.expertise && (
                                                                            <Chip 
                                                                                label={member.user.expertise} 
                                                                                size="small" 
                                                                                sx={{ mt: 1 }}
                                                                            />
                                                                        )}
                                                                    </Box>
                                                                    {canManageHackathon && (
                                                                        <Box sx={{ display: "flex", gap: 1 }}>
                                                                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                                                                <Select
                                                                                    value={member.role}
                                                                                    onChange={(e) => handleChangeRole(member.user._id, e.target.value)}
                                                                                >
                                                                                    <MenuItem value="participant">{t("roles.participant")}</MenuItem>
                                                                                    <MenuItem value="mentor">{t("roles.mentor")}</MenuItem>
                                                                                    <MenuItem value="judge">{t("roles.judge")}</MenuItem>
                                                                                    <MenuItem value="organizer">{t("roles.organizer")}</MenuItem>
                                                                                </Select>
                                                                            </FormControl>
                                                                            <Button
                                                                                size="small"
                                                                                color="error"
                                                                                variant="outlined"
                                                                                onClick={() => handleRemoveRole(member.user._id)}
                                                                            >
                                                                                {t("common.remove")}
                                                                            </Button>
                                                                        </Box>
                                                                    )}
                                                                </Box>
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    )
                                ))}
                                {members.length === 0 && (
                                    <Alert severity="info">
                                        {t("members.no_members")}
                                    </Alert>
                                )}
                            </Stack>

                            {members.length === 0 && (
                                <Paper sx={{ p: 4, textAlign: "center" }}>
                                    <Typography color="text.secondary">
                                        {t("members.no_members")}
                                    </Typography>
                                </Paper>
                            )}
                        </Box>
                    )}

                    {/* Announcements Tab */}
                    {((myRole && activeTab === 2) || (!myRole && activeTab === 1)) && (
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
                                    {announcements.map((announcement) => (
                                        <AnnouncementItem
                                            key={announcement._id}
                                            announcement={announcement}
                                            user={user}
                                            onUpdated={(updatedData) => handleUpdateAnnouncement(announcement._id, updatedData)}
                                            hackathonId={id}
                                            myRole={myRole}
                                        />
                                    ))}
                                </Stack>
                            )}
                        </Box>
                    )}

                    {/* Teams Tab */}
                    {((myRole && activeTab === 3) || (!myRole && activeTab === 2)) && (
                        <Box>
                            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                                {t("hackathon_details.registered_teams")} ({teams.length})
                            </Typography>

                            {teamsLoading ? (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                                    <Typography>{t("hackathon_details.loading_teams")}</Typography>
                                </Box>
                            ) : teams.length === 0 ? (
                                <Alert severity="info">
                                    {t("hackathon_details.no_teams_registered")}
                                </Alert>
                            ) : (
                                <Stack spacing={2}>
                                    {teams.map((team) => (
                                        <Card key={team._id} variant="outlined">
                                            <CardContent>
                                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography variant="h6" fontWeight={600} gutterBottom>
                                                            {team.name}
                                                        </Typography>
                                                        {team.idea && (
                                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                                <strong>{t("hackathon_details.idea_label")}</strong> {team.idea.title}
                                                            </Typography>
                                                        )}
                                                        <Typography variant="body2" color="text.secondary">
                                                            <strong>{t("hackathon_details.members_label")}</strong> {team.members && team.members.length > 0 
                                                                ? team.members.map((m, idx) => (
                                                                    <span key={m._id}>
                                                                        {m.name}
                                                                        {String(team.leader) === String(m._id) && ` (${t("hackathon_details.leader")})`}
                                                                        {idx < team.members.length - 1 && ", "}
                                                                    </span>
                                                                ))
                                                                : t("hackathon_details.none")}
                                                        </Typography>
                                                        {team.mentor && (
                                                            <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                                                                <strong>{t("mentor.assigned_mentor")}:</strong> {typeof team.mentor === "object" ? team.mentor.name : t("common.loading")}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    <Box>
                                                        {(myTeam?._id === team._id || 
                                                          myRole === "organizer" || 
                                                          myRole === "mentor" ||
                                                          (team.mentor && String(team.mentor._id || team.mentor) === String(user?._id)) ||
                                                          user?.role === "admin") && (
                                                            <Button
                                                                variant="outlined"
                                                                size="small"
                                                                startIcon={<MessageIcon />}
                                                                onClick={() => navigate(`/teams/${team._id}/chat`)}
                                                            >
                                                                {t("chat.open_chat")}
                                                            </Button>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </Box>
                    )}
                </Box>

                {/* Registration Dialog */}
                <Dialog open={showRegisterDialog} onClose={() => setShowRegisterDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Register Team for Hackathon</DialogTitle>
                    <DialogContent>
                        <Box sx={{ pt: 2 }}>
                            <Typography variant="body1" paragraph>
                                Register your team for <strong>{hackathon.title}</strong>
                            </Typography>
                            
                            <Stack spacing={3}>
                                {/* Team Name */}
                                <TextField
                                    label={t("hackathon.team_name")}
                                    fullWidth
                                    required
                                    value={registrationForm.teamName}
                                    onChange={(e) => setRegistrationForm({ ...registrationForm, teamName: e.target.value })}
                                    placeholder={t("hackathon.team_name")}
                                />

                                {/* Select Idea */}
                                <FormControl fullWidth required>
                                    <InputLabel>{t("hackathon.idea")}</InputLabel>
                                    <Select
                                        value={registrationForm.ideaId}
                                        onChange={(e) => setRegistrationForm({ ...registrationForm, ideaId: e.target.value })}
                                        label={t("hackathon.idea")}
                                    >
                                        {(!userIdeas || userIdeas.length === 0) && (
                                            <MenuItem disabled>{t("idea.no_ideas")}</MenuItem>
                                        )}
                                        {userIdeas && userIdeas.map((idea) => (
                                            <MenuItem key={idea._id} value={idea._id}>
                                                {idea.title}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {(!userIdeas || userIdeas.length === 0) && (
                                    <Alert severity="warning">
                                        {t("idea.no_ideas")} {t("dashboard.submit_idea")}
                                        <Button 
                                            size="small" 
                                            onClick={() => navigate("/ideas")}
                                            sx={{ ml: 1 }}
                                        >
                                            {t("dashboard.submit_idea")}
                                        </Button>
                                    </Alert>
                                )}

                                {/* Team Size Information */}
                                {(() => {
                                    const constraints = getTeamSizeConstraints();
                                    const currentSize = getCurrentTeamSize();
                                    const isValid = isTeamSizeValid();
                                    const isMaxReached = currentSize >= constraints.max;
                                    return (
                                        <Box sx={{ 
                                            p: 2, 
                                            bgcolor: isMaxReached ? "warning.light" : (isValid ? "success.light" : "error.light"),
                                            borderRadius: 1,
                                            border: `1px solid ${isMaxReached ? "warning.main" : (isValid ? "success.main" : "error.main")}`
                                        }}>
                                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                                {t("hackathon.team_size_requirement", {
                                                    min: constraints.min,
                                                    max: constraints.max,
                                                }) || `Team Size Requirement: ${constraints.min} - ${constraints.max} members`}
                                            </Typography>
                                            <Typography 
                                                variant="body2" 
                                                color={isValid ? "success.dark" : "error.dark"}
                                                fontWeight={500}
                                            >
                                                {t("hackathon.current_team_size", {
                                                    current: currentSize,
                                                    min: constraints.min,
                                                    max: constraints.max,
                                                }) || `Current: ${currentSize} member(s) of ${constraints.max} maximum`}
                                            </Typography>
                                            {isMaxReached && (
                                                <Alert severity="info" sx={{ mt: 1 }}>
                                                    {t("hackathon.max_team_size_reached", {
                                                        max: constraints.max,
                                                    }) || `Maximum team size (${constraints.max}) reached. You cannot add more members.`}
                                                </Alert>
                                            )}
                                            {!isValid && !isMaxReached && (
                                                <Alert severity="warning" sx={{ mt: 1 }}>
                                                    {currentSize < constraints.min
                                                        ? t("hackathon.team_size_too_small_alert", {
                                                              min: constraints.min,
                                                              current: currentSize,
                                                          }) || `Team must have at least ${constraints.min} member(s). Currently: ${currentSize}`
                                                        : t("hackathon.team_size_too_large_alert", {
                                                              max: constraints.max,
                                                              current: currentSize,
                                                          }) || `Team cannot have more than ${constraints.max} member(s). Currently: ${currentSize}`}
                                                </Alert>
                                            )}
                                        </Box>
                                    );
                                })()}

                                {/* Select Team Members */}
                                <Autocomplete
                                    multiple
                                    options={(allUsers || []).filter(u => u._id !== user._id && u.role === "user")}
                                    getOptionLabel={(option) => `${option.name} (${option.email})`}
                                    value={(allUsers || []).filter(u => registrationForm.memberIds.includes(u._id) && u.role === "user")}
                                    onChange={(event, newValue) => {
                                        const constraints = getTeamSizeConstraints();
                                        const maxAdditionalMembers = constraints.max - 1;
                                        const currentSelected = registrationForm.memberIds.length;
                                        
                                        // Allow removal (when newValue.length < currentSelected)
                                        // Prevent addition when at max (when newValue.length > currentSelected and at max)
                                        if (newValue.length > currentSelected && currentSelected >= maxAdditionalMembers) {
                                            toast.error(`Maximum team size is ${constraints.max}. You can only add ${maxAdditionalMembers} additional member(s).`);
                                            return;
                                        }
                                        
                                        setRegistrationForm({ 
                                            ...registrationForm, 
                                            memberIds: newValue.map(u => u._id) 
                                        });
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={t("hackathon.members")}
                                            placeholder={t("members.choose_user")}
                                            helperText={(() => {
                                                const constraints = getTeamSizeConstraints();
                                                const maxAdditional = constraints.max - 1;
                                                const currentSelected = registrationForm.memberIds.length;
                                                if (currentSelected >= maxAdditional) {
                                                    return `Maximum team size reached. You can remove members but cannot add more.`;
                                                }
                                                return `You can add up to ${maxAdditional} additional member(s) (you are automatically included)`;
                                            })()}
                                        />
                                    )}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => (
                                            <Chip
                                                label={option.name}
                                                {...getTagProps({ index })}
                                                size="small"
                                            />
                                        ))
                                    }
                                    getOptionDisabled={(option) => {
                                        // Disable options that are not already selected when at max
                                        const constraints = getTeamSizeConstraints();
                                        const maxAdditionalMembers = constraints.max - 1;
                                        const isSelected = registrationForm.memberIds.includes(option._id);
                                        return !isSelected && registrationForm.memberIds.length >= maxAdditionalMembers;
                                    }}
                                    PopperProps={{
                                        placement: "bottom-start",
                                        modifiers: [
                                            {
                                                name: "preventOverflow",
                                                enabled: true,
                                            },
                                            {
                                                name: "flip",
                                                enabled: false,
                                            },
                                        ],
                                    }}
                                />

                                <Alert severity="info">
                                    You will be automatically added as a team member. Select additional team members if needed.
                                </Alert>
                            </Stack>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowRegisterDialog(false)}>
                            {t("common.cancel") || "Cancel"}
                        </Button>
                        <Button 
                            onClick={handleRegister} 
                            variant="contained"
                            disabled={
                                !userIdeas || 
                                userIdeas.length === 0 || 
                                !registrationForm.teamName.trim() || 
                                !registrationForm.ideaId ||
                                !isTeamSizeValid()
                            }
                        >
                            {t("hackathon.register")}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Announcement Create/Edit Dialog */}
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

                {/* Info Modal */}
                <InfoModal
                    open={infoModal.open}
                    onClose={() => setInfoModal({ open: false, type: "info", message: "" })}
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
                    onCancel={() => setConfirmDialog({ open: false, title: "", message: "", onConfirm: null })}
                />
            </Container>
        </DashboardLayout>
    );
};

export default HackathonDetailsPage;
