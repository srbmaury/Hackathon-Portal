import React from "react";

import {
    Box,
    Card,
    CardContent,
    Chip,
    Grid,
    Stack,
    Typography,
} from "@mui/material";

import {
    CalendarToday as CalendarIcon,
    Cancel as CancelIcon,
    CheckCircle as CheckCircleIcon,
    Description as DescriptionIcon,
    Timer as TimerIcon,
} from "@mui/icons-material";

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import MarkdownViewer from "../common/MarkdownViewer";

const OverviewTab = ({ hackathon, id, setInfoModal }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Check if round is currently active (within date range and isActive flag)
    const isRoundCurrentlyActive = (round) => {
        if (!round.isActive) return false;
        const now = new Date();
        if (round.startDate && now < new Date(round.startDate)) return false;
        if (round.endDate && now > new Date(round.endDate)) return false;
        return true;
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

    return (
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
                    <MarkdownViewer content={hackathon.description} />
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
    );
}

export default OverviewTab;