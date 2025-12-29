import React, { useContext, useEffect, useState } from "react";

import {
    Box,
    Paper,
    Card,
    CardContent,
    Typography,
    Stack,
    Button,
    useTheme,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@mui/material";

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import toast from "react-hot-toast";
import dayjs from "dayjs";

import { AuthContext } from "../../context/AuthContext";
import { getMyTeam, withdrawTeam } from "../../api/registrations";

import MarkdownViewer from "../common/MarkdownViewer";
import RegisterTeamModal from "../teams/HackathonRegisterModal";

const HackathonItem = ({ hackathon, onEdit, onDelete }) => {
    const { t } = useTranslation();
    const { token, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const theme = useTheme();
    const colorScheme = theme.palette.mode === "dark" ? "dark" : "light";

    const [openRegister, setOpenRegister] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [myTeam, setMyTeam] = useState(null);
    const [loadingWithdraw, setLoadingWithdraw] = useState(false);

    useEffect(() => {
        let mounted = true;
        const fetchMyTeam = async () => {
            if (!user || !hackathon) return;
            try {
                const res = await getMyTeam(hackathon._id, token);
                if (!mounted) return;
                if (res?.team) {
                    setIsRegistered(true);
                    setMyTeam(res.team);
                } else {
                    setIsRegistered(false);
                    setMyTeam(null);
                }
            } catch (err) {
                // if 404, user not registered — that's expected
                if (err?.response?.status === 404) {
                    setIsRegistered(false);
                    setMyTeam(null);
                } else {
                    console.error("fetchMyTeam error", err);
                }
            }
        };
        fetchMyTeam();
        return () => (mounted = false);
    }, [hackathon, user, token]);

    const showDate =
        hackathon.createdAt === hackathon.updatedAt
            ? `${t("hackathon.created_at")}: ${dayjs(hackathon.createdAt).format("DD MMM YYYY")}`
            : `${t("hackathon.last_updated_at")}: ${dayjs(hackathon.updatedAt).format("DD MMM YYYY")}`;

    return (
        <>
            <Card sx={{ mb: 3, position: "relative" }}>
                <CardContent>
                    <Box sx={{ position: "absolute", top: 16, right: 16 }}>
                        <Typography variant="caption" color="text.secondary">
                            {showDate}
                        </Typography>
                    </Box>

                    <Typography variant="h6">{hackathon.title}</Typography>
                    <MarkdownViewer content={hackathon.description} colorScheme={colorScheme} />
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        {t("hackathon.status")}:{" "}
                        {hackathon.isActive ? t("hackathon.active") : t("hackathon.inactive")}
                    </Typography>

                    {hackathon.rounds?.length > 0 && (
                        <Paper variant="outlined" sx={{ mb: 2, overflowX: "auto" }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t("hackathon.round_number")}</TableCell>
                                        <TableCell>{t("hackathon.round_name")}</TableCell>
                                        <TableCell>{t("hackathon.round_description")}</TableCell>
                                        <TableCell>{t("hackathon.round_start_date")}</TableCell>
                                        <TableCell>{t("hackathon.round_end_date")}</TableCell>
                                        <TableCell>{t("hackathon.status")}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {hackathon.rounds.map((round, index) => (
                                        <TableRow key={round._id}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>{round.name}</TableCell>
                                            <TableCell>{round.description}</TableCell>
                                            <TableCell>{round.startDate?.split("T")[0]}</TableCell>
                                            <TableCell>{round.endDate?.split("T")[0]}</TableCell>
                                            <TableCell>
                                                {round.isActive
                                                    ? t("hackathon.active")
                                                    : t("hackathon.inactive")}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Paper>
                    )}

                    <Stack direction="row" spacing={1}>
                        <Button
                            variant="contained"
                            size="small"
                            onClick={() => navigate(`/hackathons/${hackathon._id}`)}
                        >
                            {t("hackathon.view_details") || "View Details"}
                        </Button>
                        {(user.role === "admin" || hackathon.myRole === "organizer") && (
                            <>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => onEdit(hackathon)}
                                >
                                    {t("hackathon.edit")}
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    color="error"
                                    onClick={() => onDelete(hackathon._id)}
                                >
                                    {t("hackathon.delete")}
                                </Button>
                            </>
                        )}
                        {user.role === "user" && (!hackathon.myRole || hackathon.myRole === "participant") && (
                            !isRegistered ? (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    sx={{ mt: 1 }}
                                    onClick={() => setOpenRegister(true)}
                                >
                                    {t("hackathon.register")}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        sx={{ mt: 1 }}
                                        onClick={async () => {
                                            setOpenRegister(true);
                                            const res = await getMyTeam(hackathon._id, token);
                                            setMyTeam(res.team);
                                        }}
                                    >
                                        {t("hackathon.edit") || "Edit"}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        color="error"
                                        sx={{ mt: 1 }}
                                        onClick={async () => {
                                            try {
                                                setLoadingWithdraw(true);
                                                await withdrawTeam(hackathon._id, myTeam._id, token);
                                                setIsRegistered(false);
                                                setMyTeam(null);
                                                toast.success(t("hackathon.withdraw_success") || "Withdrawn successfully");
                                            } catch (err) {
                                                console.error(err);
                                                toast.error(t("hackathon.withdraw_failed") || "Withdraw failed");
                                            } finally {
                                                setLoadingWithdraw(false);
                                            }
                                        }}
                                    >
                                        {loadingWithdraw ? t("common.loading") : t("hackathon.withdraw")}
                                    </Button>
                                </>
                            )
                        )}
                    </Stack>
                </CardContent>
            </Card >

            {/* Registration Modal */}
            < RegisterTeamModal
                open={openRegister}
                onClose={() => { setOpenRegister(false); }}
                hackathon={hackathon}
                team={myTeam}
            />
        </>
    );
};

export default HackathonItem;
