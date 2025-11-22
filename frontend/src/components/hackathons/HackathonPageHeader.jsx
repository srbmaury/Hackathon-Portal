import React, { useContext } from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
    Box,
    Button,
    Chip,
    Tab,
    Tabs,
    Typography,
} from "@mui/material";

import {
    Announcement as AnnouncementIcon,
    ArrowBack as ArrowBackIcon,
    ExitToApp as ExitToAppIcon,
    HowToReg as HowToRegIcon,
} from "@mui/icons-material";

import { useTranslation } from "react-i18next";

import { withdrawTeam } from "../../api/registrations";
import { AuthContext } from "../../context/AuthContext";

const HackathonPageHeader = ({ hackathon, myRole, myTeam, setConfirmDialog, setInfoModal, setMyTeam, loadHackathonData, loadMembers, loadTeams,
    setShowRegisterDialog, activeTab, setActiveTab
}) => {
    const navigate = useNavigate();
    const { token } = useContext(AuthContext);
    const { t } = useTranslation();
    const { id } = useParams();

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

    // Load user ideas and users when opening registration dialog
    const handleOpenRegisterDialog = async () => {
        setShowRegisterDialog(true);
    };

    return (
        <>
            <Box sx={{ mb: 4 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate("/hackathons")}
                    sx={{ mb: 2 }}
                >
                    {t("common.back")}
                </Button>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        mb: 2,
                    }}
                >
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
                            {t("hackathon.withdraw")}
                        </Button>
                    )}
                    {!myTeam && !myRole && hackathon.isActive && (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<HowToRegIcon />}
                            onClick={handleOpenRegisterDialog}
                        >
                            {t("hackathon.register")}
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                <Tabs
                    value={activeTab}
                    onChange={(e, newValue) => setActiveTab(newValue)}
                >
                    <Tab label={t("hackathon.overview")} />
                    {myRole && <Tab label={t("members.title")} />}
                    {myRole && (
                        <Tab
                            label={t("announcement.announcements")}
                            icon={<AnnouncementIcon />}
                            iconPosition="start"
                        />
                    )}
                    {myRole && <Tab label={t("teams.title")} />}
                </Tabs>
            </Box>
        </>
    );
};

export default HackathonPageHeader;
