import React, { useState, useEffect, useContext } from "react";
import {
    Container,
    Typography,
    Card,
    CardContent,
    TextField,
    Button,
    Stack,
    Box,
    Avatar,
    Divider,
    CircularProgress,
    Alert,
    Chip,
} from "@mui/material";
import {
    Person as PersonIcon,
    Email as EmailIcon,
    Business as BusinessIcon,
    Work as WorkIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
} from "@mui/icons-material";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { AuthContext } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import i18n from "../i18n/i18n";
import toast from "react-hot-toast";
import { getMyProfile, updateMyProfile } from "../api/users";

const ProfilePage = () => {
    const { t } = useTranslation();
    const { user: authUser, token, login } = useContext(AuthContext);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        expertise: "",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const fetchProfile = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const userData = await getMyProfile(token);
            setProfile(userData);
            setFormData({
                name: userData.name || "",
                expertise: userData.expertise || "",
            });
        } catch (err) {
            console.error("Error fetching profile:", err);
            toast.error(t("profile.fetch_failed") || "Failed to fetch profile");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = () => {
        setEditing(true);
    };

    const handleCancel = () => {
        setEditing(false);
        setFormData({
            name: profile?.name || "",
            expertise: profile?.expertise || "",
        });
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error(t("profile.name_required") || "Name is required");
            return;
        }

        setSaving(true);
        try {
            const updatedUser = await updateMyProfile(formData, token);
            setProfile(updatedUser);
            setEditing(false);
            
            // Update auth context with new user data
            const updatedAuthUser = {
                ...authUser,
                name: updatedUser.name,
                expertise: updatedUser.expertise,
            };
            login(updatedAuthUser, token);
            
            toast.success(t("profile.update_success") || "Profile updated successfully");
        } catch (err) {
            console.error("Error updating profile:", err);
            toast.error(t("profile.update_failed") || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const getRoleLabel = (role) => {
        const roleMap = {
            user: t("roles.user"),
            hackathon_creator: t("roles.hackathon_creator"),
            admin: t("roles.admin"),
        };
        return roleMap[role] || role;
    };

    const getRoleColor = (role) => {
        const colorMap = {
            user: "default",
            hackathon_creator: "primary",
            admin: "error",
        };
        return colorMap[role] || "default";
    };

    if (loading) {
        return (
            <DashboardLayout>
                <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
                        <CircularProgress />
                    </Box>
                </Container>
            </DashboardLayout>
        );
    }

    if (!profile) {
        return (
            <DashboardLayout>
                <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
                    <Alert severity="error">
                        {t("profile.not_found") || "Profile not found"}
                    </Alert>
                </Container>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                        {t("profile.title") || "My Profile"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t("profile.description") || "View and edit your profile information"}
                    </Typography>
                </Box>

                <Card
                    sx={{
                        borderRadius: 3,
                        overflow: "hidden",
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                    }}
                >
                    <CardContent>
                        <Stack spacing={3}>
                            {/* Header Section */}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <Avatar
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        bgcolor: "primary.main",
                                        fontSize: "2rem",
                                    }}
                                >
                                    {profile.name?.charAt(0)?.toUpperCase() || "U"}
                                </Avatar>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="h5" fontWeight={600}>
                                        {profile.name}
                                    </Typography>
                                    <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                                        <Chip
                                            label={getRoleLabel(profile.role)}
                                            color={getRoleColor(profile.role)}
                                            size="small"
                                        />
                                    </Box>
                                </Box>
                                {!editing && (
                                    <Button
                                        variant="outlined"
                                        startIcon={<EditIcon />}
                                        onClick={handleEdit}
                                    >
                                        {t("common.edit") || "Edit"}
                                    </Button>
                                )}
                            </Box>

                            <Divider />

                            {/* Profile Information */}
                            <Stack spacing={3}>
                                {/* Name Field */}
                                <Box>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                        <PersonIcon color="action" fontSize="small" />
                                        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                                            {t("profile.name") || "Name"}
                                        </Typography>
                                    </Box>
                                    {editing ? (
                                        <TextField
                                            fullWidth
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            variant="outlined"
                                            required
                                        />
                                    ) : (
                                        <Typography variant="body1">{profile.name || t("common.none") || "-"}</Typography>
                                    )}
                                </Box>

                                {/* Email Field (Read-only) */}
                                <Box>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                        <EmailIcon color="action" fontSize="small" />
                                        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                                            {t("profile.email") || "Email"}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body1">{profile.email || t("common.none") || "-"}</Typography>
                                </Box>

                                {/* Organization Field (Read-only) */}
                                <Box>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                        <BusinessIcon color="action" fontSize="small" />
                                        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                                            {t("profile.organization") || "Organization"}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body1">
                                        {profile.organization?.name || t("common.none") || "-"}
                                    </Typography>
                                </Box>

                                {/* Expertise Field */}
                                <Box>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                        <WorkIcon color="action" fontSize="small" />
                                        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                                            {t("profile.expertise") || "Expertise"}
                                        </Typography>
                                    </Box>
                                    {editing ? (
                                        <TextField
                                            fullWidth
                                            name="expertise"
                                            value={formData.expertise}
                                            onChange={handleChange}
                                            variant="outlined"
                                            placeholder={t("profile.expertise_placeholder") || "e.g., Full Stack Developer, Data Scientist"}
                                            multiline
                                            rows={2}
                                        />
                                    ) : (
                                        <Typography variant="body1">
                                            {profile.expertise || t("profile.no_expertise") || "Not specified"}
                                        </Typography>
                                    )}
                                </Box>

                                {/* Account Created Date */}
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
                                        {t("profile.member_since") || "Member Since"}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {profile.createdAt
                                            ? new Date(profile.createdAt).toLocaleDateString(
                                                  i18n.language === "hi" ? "hi-IN" : i18n.language === "te" ? "te-IN" : "en-US",
                                                  {
                                                      year: "numeric",
                                                      month: "long",
                                                      day: "numeric",
                                                  }
                                              )
                                            : t("common.none") || "-"}
                                    </Typography>
                                </Box>
                            </Stack>

                            {/* Action Buttons */}
                            {editing && (
                                <>
                                    <Divider />
                                    <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                                        <Button
                                            variant="outlined"
                                            startIcon={<CancelIcon />}
                                            onClick={handleCancel}
                                            disabled={saving}
                                        >
                                            {t("common.cancel") || "Cancel"}
                                        </Button>
                                        <Button
                                            variant="contained"
                                            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                                            onClick={handleSave}
                                            disabled={saving}
                                        >
                                            {saving
                                                ? t("profile.saving") || t("common.updating") || "Saving..."
                                                : t("common.update") || "Save Changes"}
                                        </Button>
                                    </Box>
                                </>
                            )}
                        </Stack>
                    </CardContent>
                </Card>
            </Container>
        </DashboardLayout>
    );
};

export default ProfilePage;

