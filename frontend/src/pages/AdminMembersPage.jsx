import React, { useState, useEffect, useContext } from "react";

// Routing & Context
import { AuthContext } from "../context/AuthContext";

// MUI Components
import {
    Container,
    Typography,
    Box,
    Card,
    CardContent,
    Chip,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Stack,
    Alert,
    CircularProgress,
    Autocomplete,
    InputAdornment,
} from "@mui/material";

// MUI Icons
import {
    PersonAdd as PersonAddIcon,
    Edit as EditIcon,
    Search as SearchIcon,
} from "@mui/icons-material";

// i18n
import { useTranslation } from "react-i18next";

// Internal Components
import DashboardLayout from "../components/dashboard/DashboardLayout";
import InfoModal from "../components/common/InfoModal";
import ConfirmDialog from "../components/common/ConfirmDialog";

// API Calls
import { getUsersWithHackathonRoles, updateUserRole } from "../api/users";
import { getAllHackathons, assignHackathonRole, removeHackathonRole } from "../api/hackathons";

const AdminMembersPage = () => {
    const { t } = useTranslation();
    const { user, token } = useContext(AuthContext);
    const [allUsers, setAllUsers] = useState([]);
    const [hackathons, setHackathons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedHackathon, setSelectedHackathon] = useState(null);
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [infoModal, setInfoModal] = useState({ open: false, type: "info", message: "" });
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: "", message: "", onConfirm: null });

    useEffect(() => {
        if (user?.role === "admin") {
            loadData();
        }
    }, [user, token]);

    // Listen for real-time hackathon role updates via WebSocket
    useEffect(() => {
        const handleRoleUpdate = (event) => {
            const { role } = event.detail;

            // Only refresh if organizer role was assigned/removed
            if (role?.role === "organizer" || role === "organizer") {
                // Reload data to refresh organizer roles
                loadData();
            }
        };

        window.addEventListener("hackathon_role_updated", handleRoleUpdate);

        return () => {
            window.removeEventListener("hackathon_role_updated", handleRoleUpdate);
        };
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [usersData, hackathonsData] = await Promise.all([
                getUsersWithHackathonRoles(token),
                getAllHackathons(token)
            ]);
            setAllUsers(usersData || []);
            setHackathons(hackathonsData?.hackathons || []);
        } catch (error) {
            console.error("Error loading data:", error);
            setInfoModal({ open: true, type: "error", message: t("user_management.load_failed") });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAssignDialog = (memberUser) => {
        if (String(memberUser._id) === String(user._id)) {
            setInfoModal({ open: true, type: "error", message: t("user_management.cannot_assign_to_self") });
            return;
        }
        setSelectedUser(memberUser);
        setSelectedHackathon(null);
        setShowAssignDialog(true);
    };

    const handleCloseAssignDialog = () => {
        setShowAssignDialog(false);
        setSelectedUser(null);
        setSelectedHackathon(null);
    };

    const handleAssignOrganizer = async () => {
        if (!selectedUser || !selectedHackathon) {
            setInfoModal({ open: true, type: "error", message: t("user_management.please_select_hackathon") });
            return;
        }

        try {
            setAssigning(true);
            await assignHackathonRole(selectedHackathon._id, selectedUser._id, "organizer", token);
            setInfoModal({
                open: true,
                type: "success",
                message: t("user_management.organizer_assigned_success", {
                    name: selectedUser.name,
                    hackathon: selectedHackathon.title
                })
            });
            handleCloseAssignDialog();
            loadData();
        } catch (error) {
            console.error("Error assigning organizer role:", error);
            setInfoModal({ open: true, type: "error", message: error.response?.data?.message || t("user_management.organizer_assigned_failed") });
        } finally {
            setAssigning(false);
        }
    };

    const handleRemoveOrganizer = async (userId, hackathonId, hackathonTitle) => {
        if (String(userId) === String(user._id)) {
            setInfoModal({ open: true, type: "error", message: t("user_management.cannot_remove_from_self") });
            return;
        }

        setConfirmDialog({
            open: true,
            title: t("common.confirm_title"),
            message: t("user_management.remove_organizer_confirm", { hackathon: hackathonTitle }),
            onConfirm: async () => {
                try {
                    await removeHackathonRole(hackathonId, userId, token);
                    setInfoModal({ open: true, type: "success", message: t("user_management.organizer_removed_success") });
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: null });
                    loadData();
                } catch (error) {
                    console.error("Error removing organizer role:", error);
                    setInfoModal({ open: true, type: "error", message: t("user_management.organizer_removed_failed") });
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: null });
                }
            },
        });
    };

    const handleAssignHackathonCreator = async (member) => {
        if (member.role === "admin") {
            setInfoModal({ open: true, type: "error", message: t("user_management.cannot_change_admin") });
            return;
        }

        setConfirmDialog({
            open: true,
            title: t("common.confirm_title"),
            message: t("user_management.assign_creator_confirm", { name: member.name }),
            onConfirm: async () => {
                try {
                    await updateUserRole(member._id, "hackathon_creator", token);
                    setInfoModal({ open: true, type: "success", message: t("user_management.creator_assigned_success", { name: member.name }) });
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: null });
                    loadData();
                } catch (error) {
                    console.error("Error assigning hackathon creator role:", error);
                    setInfoModal({ open: true, type: "error", message: error.response?.data?.message || t("user_management.creator_assigned_failed") });
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: null });
                }
            },
        });
    };

    const handleRemoveHackathonCreator = async (member) => {
        setConfirmDialog({
            open: true,
            title: t("common.confirm_title"),
            message: t("user_management.remove_creator_confirm", { name: member.name }),
            onConfirm: async () => {
                try {
                    await updateUserRole(member._id, "user", token);
                    setInfoModal({ open: true, type: "success", message: t("user_management.creator_removed_success", { name: member.name }) });
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: null });
                    loadData();
                } catch (error) {
                    console.error("Error removing hackathon creator role:", error);
                    setInfoModal({ open: true, type: "error", message: error.response?.data?.message || t("user_management.creator_removed_failed") });
                    setConfirmDialog({ open: false, title: "", message: "", onConfirm: null });
                }
            },
        });
    };

    if (user?.role !== "admin") {
        return (
            <DashboardLayout>
                <Container maxWidth="lg">
                    <Alert severity="error">{t("user_management.access_denied")}</Alert>
                </Container>
            </DashboardLayout>
        );
    }

    if (loading) {
        return (
            <DashboardLayout>
                <Container maxWidth="lg">
                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                        <CircularProgress />
                    </Box>
                </Container>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <Container maxWidth="lg">
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        {t("user_management.all_members")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t("user_management.all_members_description")}
                    </Typography>
                </Box>

                {/* Search Box */}
                <Box sx={{ mb: 3 }}>
                    <TextField
                        fullWidth
                        placeholder={t("members.search_placeholder", "Search by name or email...")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                backgroundColor: "background.paper",
                            },
                        }}
                    />
                </Box>

                <Stack spacing={3}>
                    {allUsers
                        .filter((member) => {
                            if (!searchTerm.trim()) return true;
                            const search = searchTerm.toLowerCase();
                            return (
                                member.name?.toLowerCase().includes(search) ||
                                member.email?.toLowerCase().includes(search)
                            );
                        })
                        .map((member) => (
                            <Card key={member._id} elevation={2}>
                                <CardContent>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                                                <Typography variant="h6" fontWeight={600}>
                                                    {member.name}
                                                </Typography>
                                                <Chip
                                                    label={t(`roles.${member.role}`)}
                                                    color={member.role === "admin" ? "error" : "primary"}
                                                    size="small"
                                                />
                                            </Box>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                {member.email}
                                            </Typography>

                                            {/* Show organizer roles for this user */}
                                            <Box sx={{ mt: 2 }}>
                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                    {t("user_management.organizer_roles_label")}
                                                </Typography>
                                                {member.organizerRoles && member.organizerRoles.length > 0 ? (
                                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                                        {member.organizerRoles.map((orgRole) => (
                                                            <Chip
                                                                key={orgRole.roleId}
                                                                label={orgRole.hackathonTitle || t("user_management.unknown_hackathon")}
                                                                size="small"
                                                                color="secondary"
                                                                onDelete={String(member._id) === String(user._id) ? undefined : () => handleRemoveOrganizer(member._id, orgRole.hackathonId, orgRole.hackathonTitle)}
                                                                deleteIcon={String(member._id) === String(user._id) ? undefined : <EditIcon />}
                                                            />
                                                        ))}
                                                    </Box>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                                        {t("user_management.no_organizer_roles")}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, ml: 2 }}>
                                            {String(member._id) !== String(user._id) && (
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<PersonAddIcon />}
                                                    onClick={() => handleOpenAssignDialog(member)}
                                                >
                                                    {t("user_management.assign_organizer")}
                                                </Button>
                                            )}
                                            {member.role !== "admin" && (
                                                member.role === "hackathon_creator" ? (
                                                    <Button
                                                        variant="outlined"
                                                        color="warning"
                                                        onClick={() => handleRemoveHackathonCreator(member)}
                                                        size="small"
                                                    >
                                                        {t("user_management.remove_creator")}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="contained"
                                                        color="success"
                                                        onClick={() => handleAssignHackathonCreator(member)}
                                                        size="small"
                                                    >
                                                        {t("user_management.make_creator")}
                                                    </Button>
                                                )
                                            )}
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                </Stack>

                {allUsers.length === 0 && !loading && (
                    <Alert severity="info" sx={{ mt: 3 }}>
                        {t("members.no_members", "No members found")}
                    </Alert>
                )}

                {allUsers.length > 0 &&
                    allUsers.filter((member) => {
                        if (!searchTerm.trim()) return true;
                        const search = searchTerm.toLowerCase();
                        return (
                            member.name?.toLowerCase().includes(search) ||
                            member.email?.toLowerCase().includes(search)
                        );
                    }).length === 0 && (
                        <Alert severity="info" sx={{ mt: 3 }}>
                            {t("members.no_search_results", "No members match your search criteria")}
                        </Alert>
                    )}

                {/* Assign Organizer Dialog */}
                <Dialog open={showAssignDialog} onClose={handleCloseAssignDialog} maxWidth="sm" fullWidth>
                    <DialogTitle>
                        {t("user_management.assign_organizer_role")}
                        {selectedUser && ` - ${selectedUser.name}`}
                    </DialogTitle>
                    <DialogContent>
                        <Stack spacing={3} sx={{ pt: 2 }}>
                            <Autocomplete
                                options={hackathons}
                                getOptionLabel={(option) => option.title}
                                value={selectedHackathon}
                                onChange={(event, newValue) => setSelectedHackathon(newValue)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={t("user_management.select_hackathon")}
                                        placeholder={t("user_management.choose_hackathon")}
                                    />
                                )}
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
                                {t("user_management.assign_organizer_info", { name: selectedUser?.name })}
                            </Alert>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseAssignDialog} disabled={assigning}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            onClick={handleAssignOrganizer}
                            variant="contained"
                            disabled={assigning || !selectedHackathon}
                        >
                            {assigning ? <CircularProgress size={24} /> : t("user_management.assign_organizer")}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Modals */}
                <InfoModal
                    open={infoModal.open}
                    onClose={() => setInfoModal({ open: false, type: "info", message: "" })}
                    type={infoModal.type}
                    message={infoModal.message}
                />
                <ConfirmDialog
                    open={confirmDialog.open}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={() => confirmDialog.onConfirm && confirmDialog.onConfirm()}
                    onCancel={() => setConfirmDialog({ open: false, title: "", message: "", onConfirm: null })}
                />
            </Container>
        </DashboardLayout>
    );
};

export default AdminMembersPage;

