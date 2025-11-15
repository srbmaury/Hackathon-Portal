import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Typography,
    Paper,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Button,
    CircularProgress,
    Alert,
    Container,
} from "@mui/material";
import { Message as MessageIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import HackathonRegisterModal from "../components/teams/HackathonRegisterModal";
import { AuthContext } from "../context/AuthContext";
import { getMyTeams, withdrawTeam } from "../api/registrations";

const MyTeamsPage = () => {
    const { t } = useTranslation();
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editTeam, setEditTeam] = useState(null);
    const [openEdit, setOpenEdit] = useState(false);

    const fetchTeams = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await getMyTeams(token);
            console.log("My Teams API Response (full):", JSON.stringify(res, null, 2));
            // Handle both direct array and object with teams property
            const teamsData = Array.isArray(res) ? res : (res.teams || []);
            console.log("Teams data after processing:", teamsData);
            if (teamsData.length > 0) {
                console.log("First team sample:", JSON.stringify(teamsData[0], null, 2));
            }
            setTeams(teamsData);
        } catch (err) {
            console.error("Error fetching teams:", err);
            toast.error(t("teams.fetch_failed") || "Failed to fetch teams");
            setTeams([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // Listen for real-time team updates via WebSocket
    useEffect(() => {
        const handleTeamUpdate = (event) => {
            console.log("Team update received on My Teams page:", event.detail);
            // Refresh teams list when team is created, updated, or deleted
            fetchTeams();
        };

        window.addEventListener("team_updated", handleTeamUpdate);

        return () => {
            window.removeEventListener("team_updated", handleTeamUpdate);
        };
    }, []);

    const handleWithdraw = async (team) => {
        try {
            // Handle both populated object and ID string
            const hackathonId = typeof team.hackathon === "string" 
                ? team.hackathon 
                : team.hackathon?._id;
            
            if (!hackathonId) {
                toast.error(t("hackathon.withdraw_failed") || "Invalid hackathon data");
                return;
            }

            await withdrawTeam(hackathonId, team._id, token);
            toast.success(t("hackathon.withdraw_success") || "Withdrawn successfully");
            fetchTeams();
        } catch (err) {
            console.error("Withdraw error:", err);
            toast.error(t("hackathon.withdraw_failed") || "Withdraw failed");
        }
    };

    const getHackathonTitle = (team) => {
        if (!team) return "-";
        if (typeof team.hackathon === "string") return "-";
        if (team.hackathon && typeof team.hackathon === "object") {
            return team.hackathon.title || team.hackathon.name || "-";
        }
        return "-";
    };

    const getIdeaTitle = (team) => {
        if (!team) return "-";
        if (typeof team.idea === "string") return "-";
        if (team.idea && typeof team.idea === "object") {
            return team.idea.title || team.idea.name || "-";
        }
        return "-";
    };

    const getTeamName = (team) => {
        if (!team) return "-";
        return team.name || "-";
    };

    const getMembersList = (team) => {
        if (!team || !team.members) return "-";
        if (!Array.isArray(team.members)) return "-";
        if (team.members.length === 0) return "-";
        
        const memberNames = team.members
            .map((m) => {
                if (typeof m === "object" && m !== null) {
                    return m.name || m.email || "-";
                }
                return "-";
            })
            .filter((name) => name !== "-");
        
        return memberNames.length > 0 ? memberNames.join(", ") : "-";
    };

    return (
        <DashboardLayout>
            <Container maxWidth="lg">
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" fontWeight={700} gutterBottom>
                {t("teams.my_teams") || "My Teams"}
            </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t("teams.my_teams_description", "View and manage all teams you are a member of")}
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
                        <CircularProgress />
                    </Box>
                ) : teams.length === 0 ? (
                    <Alert severity="info" sx={{ mt: 3 }}>
                        {t("teams.no_teams", "You are not a member of any teams yet. Register for a hackathon to create or join a team.")}
                    </Alert>
                ) : (
                    <Paper variant="outlined" sx={{ overflow: "auto" }}>
                        <Table>
                    <TableHead>
                        <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>
                                        {t("hackathon.name") || "Hackathon"}
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>
                                        {t("team.name") || "Team Name"}
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>
                                        {t("team.idea") || "Idea"}
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>
                                        {t("team.members") || "Members"}
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600 }} align="right">
                                        {t("common.actions") || "Actions"}
                                    </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                                {teams.map((team) => {
                                    const teamName = getTeamName(team);
                                    const hackathonTitle = getHackathonTitle(team);
                                    const ideaTitle = getIdeaTitle(team);
                                    const membersList = getMembersList(team);
                                    
                                    console.log("Rendering team:", team._id, {
                                        rawName: team.name,
                                        processedName: teamName,
                                        rawHackathon: team.hackathon,
                                        processedHackathon: hackathonTitle,
                                        rawIdea: team.idea,
                                        processedIdea: ideaTitle,
                                        rawMembers: team.members,
                                        processedMembers: membersList,
                                        fullTeam: team
                                    });
                                    
                                    return (
                                    <TableRow key={team._id} hover>
                                        <TableCell>{hackathonTitle}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={500}>
                                                {teamName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{ideaTitle}</TableCell>
                                        <TableCell>{membersList}</TableCell>
                                        <TableCell align="right">
                                            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<MessageIcon />}
                                                    onClick={() => navigate(`/teams/${team._id}/chat`)}
                                                >
                                                    {t("chat.open_chat") || "Chat"}
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    onClick={() => {
                                                        setEditTeam(team);
                                                        setOpenEdit(true);
                                                    }}
                                                >
                                                {t("common.edit") || "Edit"}
                                            </Button>
                                                <Button
                                                    variant="outlined"
                                                    color="error"
                                                    size="small"
                                                    onClick={() => handleWithdraw(team)}
                                                >
                                                {t("hackathon.withdraw") || "Withdraw"}
                                            </Button>
                                            </Box>
                                        </TableCell>
                            </TableRow>
                                    );
                                })}
                    </TableBody>
                </Table>
            </Paper>
                )}

                    <HackathonRegisterModal
                        open={openEdit}
                    onClose={() => {
                        setOpenEdit(false);
                        setEditTeam(null);
                    }}
                        hackathon={editTeam?.hackathon}
                        team={editTeam}
                        onRegistered={() => {
                            // refresh list after edit
                            fetchTeams();
                            setOpenEdit(false);
                            setEditTeam(null);
                        }}
                    />
            </Container>
        </DashboardLayout>
    );
};

export default MyTeamsPage;
