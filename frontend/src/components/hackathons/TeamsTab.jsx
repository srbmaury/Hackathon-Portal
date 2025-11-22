import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";

import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Stack,
    Typography,
} from "@mui/material";

import { Message as MessageIcon } from "@mui/icons-material";

import { useTranslation } from "react-i18next";

import { AuthContext } from "../../context/AuthContext";

const TeamsTab = ({ teams, teamsLoading, myTeam, myRole }) => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { t } = useTranslation();
    return (
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
    )
};

export default TeamsTab;