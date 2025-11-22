import React, { useContext, useState } from "react";

import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext";

import {
    assignHackathonRole,
    assignMentorsToTeams,
    removeHackathonRole,
} from "../../api/hackathons";

import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

import {
    AutoAwesome as AutoAwesomeIcon,
    PersonAdd as PersonAddIcon,
} from "@mui/icons-material";

const MembersTab = ({ myRole, id, setConfirmDialog, setInfoModal, loadTeams, loadMembers, allUsers, members, membersByRole }) => {
    const [assigningMentors, setAssigningMentors] = useState(false);
    const { user, token } = useContext(AuthContext);
    const { t } = useTranslation();
    const canManageHackathon = user?.role === "admin" || myRole === "organizer";

    // Add member state (for organizers)
    const [memberForm, setMemberForm] = useState({ userId: "", role: "participant" });

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

    return (
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
    );
}

export default MembersTab;