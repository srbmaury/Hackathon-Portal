import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";

import {
    ArrowBack as ArrowBackIcon,
    Assessment as AssessmentIcon,
    AutoAwesome as AutoAwesomeIcon,
    CalendarToday as CalendarIcon,
    CompareArrows as CompareArrowsIcon,
    Timer as TimerIcon,
} from "@mui/icons-material";

import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";

import {
    getHackathonById,
    getMyHackathonRole,
} from "../api/hackathons";

import { getMyTeam } from "../api/registrations";

import {
    compareSubmissions,
    evaluateSubmission,
    generateSubmissionFeedback,
    getAllSubmissions,
    getMySubmission,
    getStandings,
    submitForRound,
    updateSubmission,
} from "../api/submissions";

import {
    analyzeTeamRisk,
    getAtRiskTeams,
    sendReminder,
} from "../api/reminders";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import InfoModal from "../components/common/InfoModal";
import ScoreFeedbackDialog from "../components/common/ScoreFeedbackDialog";

const RoundDetailsPage = () => {
    const { hackathonId, roundId } = useParams();
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [round, setRound] = useState(null);
    const [myRole, setMyRole] = useState(null);
    const [myTeam, setMyTeam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    // Submission state
    const [mySubmission, setMySubmission] = useState(null);
    const [allSubmissions, setAllSubmissions] = useState([]);
    const [standings, setStandings] = useState([]);
    const [hideScores, setHideScores] = useState(false);
    const [submissionForm, setSubmissionForm] = useState({ link: "", file: null });
    const [submitting, setSubmitting] = useState(false);
    const [filePreview, setFilePreview] = useState(null);

    // Modal states
    const [infoModal, setInfoModal] = useState({ open: false, type: "info", message: "" });
    const [scoreFeedbackDialog, setScoreFeedbackDialog] = useState({ 
        open: false, 
        submissionId: null, 
        allowScore: false, 
        allowFeedback: true 
    });
    
    // AI features state
    const [evaluationDialog, setEvaluationDialog] = useState({ open: false, submission: null, evaluation: null, loading: false });
    const [comparisonDialog, setComparisonDialog] = useState({ open: false, insights: null, loading: false });
    
    // Deadline reminder state
    const [atRiskTeams, setAtRiskTeams] = useState([]);
    const [loadingAtRisk, setLoadingAtRisk] = useState(false);
    const [riskDialog, setRiskDialog] = useState({ open: false, team: null, analysis: null, loading: false });

    useEffect(() => {
        loadData();
    }, [hackathonId, roundId, token]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load hackathon data
            const hackathonResponse = await getHackathonById(hackathonId, token);
            const hackathonData = hackathonResponse.hackathon || hackathonResponse;

            // Find the round
            const foundRound = hackathonData.rounds?.find(r => r._id === roundId);
            if (!foundRound) {
                setInfoModal({ open: true, type: "error", message: t("round.not_found") });
                navigate(`/hackathons/${hackathonId}`);
                return;
            }
            setRound(foundRound);

            // Get user's role
            try {
                const roleData = await getMyHackathonRole(hackathonId, token);
                setMyRole(roleData.role || null);
            } catch {
                setMyRole(null);
            }

            // Get user's team
            try {
                const teamData = await getMyTeam(hackathonId, token);
                setMyTeam(teamData.team || null);
            } catch {
                setMyTeam(null);
            }

            // Load submission data (need to wait for myRole to be set)
            if (myRole !== undefined) {
                await loadSubmissionData(foundRound._id);
            }
        } catch (error) {
            console.error("Error loading data:", error);
            setInfoModal({ open: true, type: "error", message: t("round.load_failed") });
            navigate(`/hackathons/${hackathonId}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (round && myRole !== undefined) {
            loadSubmissionData(round._id);
        }
    }, [round, myRole, user?.role]);

    const loadSubmissionData = async (roundId) => {
        try {
            const [mySubData, standingsData, allSubsData] = await Promise.all([
                getMySubmission(roundId, token).catch(() => ({ submission: null })),
                getStandings(roundId, token).catch(() => ({ standings: [], hideScores: false })),
                (myRole === "organizer" || myRole === "judge" || user?.role === "admin") 
                    ? getAllSubmissions(roundId, token).catch(() => ({ submissions: [] }))
                    : Promise.resolve({ submissions: [] })
            ]);

            setMySubmission(mySubData.submission || null);
            setStandings(standingsData.standings || []);
            setHideScores(standingsData.hideScores || false);
            setAllSubmissions(allSubsData.submissions || []);

            // Pre-fill form if submission exists
            if (mySubData.submission) {
                setSubmissionForm({
                    link: mySubData.submission.link || "",
                    file: null, // Don't pre-fill file, user needs to re-upload if they want to change
                });
                setFilePreview(mySubData.submission.file || null);
            } else {
                setSubmissionForm({ link: "", file: null });
                setFilePreview(null);
            }
        } catch (error) {
            console.error("Error loading submission data:", error);
        }
    };

    // Check if round is currently active (within date range and isActive flag)
    const isRoundCurrentlyActive = (round) => {
        if (!round || !round.isActive) return false;
        const now = new Date();
        if (round.startDate && now < new Date(round.startDate)) return false;
        if (round.endDate && now > new Date(round.endDate)) return false;
        return true;
    };

    // Handle file change
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSubmissionForm({ ...submissionForm, file });
            // Create preview URL for display
            setFilePreview(URL.createObjectURL(file));
        }
    };

    // Check if text is a link
    const isLink = (text) => {
        if (!text) return false;
        const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
        return urlPattern.test(text.trim());
    };

    // Handle submission
    const handleSubmitSubmission = async () => {
        if (!round) return;

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("link", submissionForm.link || "");
            if (submissionForm.file) {
                formData.append("file", submissionForm.file);
            }

            await submitForRound(round._id, formData, token);
            setInfoModal({ open: true, type: "success", message: t("submission.submitted") });
            // Reload data
            await loadSubmissionData(round._id);
            // Reset file input
            setSubmissionForm({ ...submissionForm, file: null });
            setFilePreview(null);
        } catch (error) {
            console.error("Error submitting:", error);
                setInfoModal({ open: true, type: "error", message: error.response?.data?.message || t("submission.submit_failed") });
        } finally {
            setSubmitting(false);
        }
    };

    // Handle update submission (judges can update scores, organizers can update feedback)
    const handleUpdateSubmission = (submissionId) => {
        const isJudge = myRole === "judge" || user?.role === "admin";
        
        // Find the submission to get current values
        const submission = allSubmissions.find(s => s._id === submissionId);
        
        setScoreFeedbackDialog({
            open: true,
            submissionId: submissionId,
            allowScore: isJudge,
            allowFeedback: true,
            initialScore: submission?.score?.toString() || "",
            initialFeedback: submission?.feedback || "",
        });
    };

    const handleSubmitScoreFeedback = async (updateData) => {
        try {
            await updateSubmission(scoreFeedbackDialog.submissionId, updateData, token);
            setInfoModal({ open: true, type: "success", message: t("submission.submission_updated") });
            await loadSubmissionData(round._id);
        } catch (error) {
            setInfoModal({ open: true, type: "error", message: error.response?.data?.message || t("submission.submission_update_failed") });
        }
    };

    // AI feature handlers
    const handleEvaluateSubmission = async (submission) => {
        setEvaluationDialog({ open: true, submission, evaluation: null, loading: true });
        try {
            const result = await evaluateSubmission(submission._id, token);
            setEvaluationDialog({ open: true, submission, evaluation: result.evaluation, loading: false });
        } catch (error) {
            console.error("Error evaluating submission:", error);
            setInfoModal({ open: true, type: "error", message: t("submission.evaluate_failed") });
            setEvaluationDialog({ open: false, submission: null, evaluation: null, loading: false });
        }
    };

    const handleGenerateFeedback = async (submissionId, score) => {
        try {
            const result = await generateSubmissionFeedback(submissionId, score, token);
            setScoreFeedbackDialog({
                open: true,
                submissionId: submissionId,
                allowScore: myRole === "judge" || user?.role === "admin",
                allowFeedback: true,
                initialScore: score?.toString() || "",
                initialFeedback: result.feedback || "",
            });
        } catch (error) {
            console.error("Error generating feedback:", error);
            setInfoModal({ open: true, type: "error", message: t("submission.generate_feedback_failed") });
        }
    };

    const handleCompareSubmissions = async () => {
        setComparisonDialog({ open: true, insights: null, loading: true });
        try {
            const result = await compareSubmissions(roundId, token);
            setComparisonDialog({ open: true, insights: result, loading: false });
        } catch (error) {
            console.error("Error comparing submissions:", error);
            setInfoModal({ open: true, type: "error", message: t("submission.compare_failed") });
            setComparisonDialog({ open: false, insights: null, loading: false });
        }
    };

    // Deadline reminder handlers
    const loadAtRiskTeams = async () => {
        if (!roundId || (myRole !== "organizer" && user?.role !== "admin")) return;
        
        setLoadingAtRisk(true);
        try {
            const result = await getAtRiskTeams(roundId, 50, token);
            setAtRiskTeams(result.atRiskTeams || []);
        } catch (error) {
            console.error("Error loading at-risk teams:", error);
            setInfoModal({ open: true, type: "error", message: t("reminder.fetch_failed") });
        } finally {
            setLoadingAtRisk(false);
        }
    };

    const handleViewRisk = async (team) => {
        setRiskDialog({ open: true, team, analysis: null, loading: true });
        try {
            const result = await analyzeTeamRisk(team._id, roundId, token);
            setRiskDialog({ open: true, team, analysis: result.analysis, loading: false });
        } catch (error) {
            console.error("Error analyzing risk:", error);
            setInfoModal({ open: true, type: "error", message: t("reminder.analysis_failed") });
            setRiskDialog({ open: false, team: null, analysis: null, loading: false });
        }
    };

    const handleSendReminder = async (team) => {
        try {
            await sendReminder(team._id, roundId, token);
            setInfoModal({ open: true, type: "success", message: t("reminder.sent_successfully") });
            // Reload at-risk teams
            await loadAtRiskTeams();
        } catch (error) {
            console.error("Error sending reminder:", error);
            setInfoModal({ open: true, type: "error", message: t("reminder.send_failed") });
        }
    };

    // Load at-risk teams when tab is active
    useEffect(() => {
        const isAtRiskTab = (myRole === "organizer" || user?.role === "admin") && 
            (myRole === "participant" ? activeTab === 3 : activeTab === 2);
        if (isAtRiskTab && roundId) {
            loadAtRiskTeams();
        }
    }, [activeTab, roundId, myRole, user?.role]);

    if (loading) {
        return (
            <DashboardLayout>
                <Container maxWidth="lg" sx={{ mt: 3, display: "flex", justifyContent: "center", p: 4 }}>
                    <CircularProgress />
                </Container>
            </DashboardLayout>
        );
    }

    if (!round) {
        return null;
    }

    return (
        <DashboardLayout>
            <Container maxWidth="lg" sx={{ mt: 3 }}>
                {/* Header */}
                <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate(`/hackathons/${hackathonId}`)}
                    >
                        {t("common.back") || "Back"}
                    </Button>
                    <Typography variant="h4" fontWeight={600}>
                        {round.name}
                    </Typography>
                </Box>

                {/* Round Info Card */}
                <Card elevation={2} sx={{ mb: 3 }}>
                    <CardContent>
                        <Stack spacing={2}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                {isRoundCurrentlyActive(round) ? (
                                    <Chip 
                                        label={t("round.currently_active")}
                                        size="small"
                                        color="success"
                                    />
                                ) : (
                                    <Chip 
                                        label={round.isActive ? t("hackathon.active") : t("hackathon.inactive")}
                                        size="small"
                                        color={round.isActive ? "success" : "default"}
                                    />
                                )}
                            </Box>
                            
                            {round.description && (
                                <Typography variant="body1" color="text.secondary">
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
                        </Stack>
                    </CardContent>
                </Card>

                {/* Tabs */}
                <Paper elevation={2} sx={{ mb: 3 }}>
                    <Tabs 
                        value={activeTab} 
                        onChange={(e, newValue) => setActiveTab(newValue)}
                        sx={{ borderBottom: 1, borderColor: "divider" }}
                    >
                        {myRole === "participant" && (
                            <Tab label={t("submission.submit") || "Submit"} />
                        )}
                        <Tab label={t("submission.standings") || "Standings"} />
                        {(myRole === "organizer" || myRole === "judge" || user?.role === "admin") && (
                            <Tab label={t("submission.all_submissions") || "All Submissions"} />
                        )}
                        {(myRole === "organizer" || user?.role === "admin") && (
                            <Tab label={t("reminder.at_risk_teams") || "Teams at Risk"} />
                        )}
                    </Tabs>
                </Paper>

                {/* Submit Tab (only for participants) */}
                {myRole === "participant" && activeTab === 0 && (
                    <Card elevation={2}>
                        <CardContent>
                            {!myTeam ? (
                                <Alert severity="warning">
                                    {t("submission.team_required") || "You need to register a team before submitting."}
                                </Alert>
                            ) : !isRoundCurrentlyActive(round) ? (
                                <Alert severity="info">
                                    {t("submission.round_not_active") || "This round is not currently active."}
                                </Alert>
                            ) : (
                                <Stack spacing={3}>
                                    <TextField
                                        fullWidth
                                        label={t("submission.link") || "Link (Optional)"}
                                        value={submissionForm.link}
                                        onChange={(e) => setSubmissionForm({ ...submissionForm, link: e.target.value })}
                                        placeholder="https://..."
                                        helperText={isLink(submissionForm.link) 
                                            ? t("submission.link_detected") || "✓ Link detected" 
                                            : (t("submission.link_help") || "Enter a link (e.g., GitHub repo, demo URL, etc.)")}
                                        InputProps={{
                                            endAdornment: isLink(submissionForm.link) && (
                                                <Button 
                                                    size="small" 
                                                    href={submissionForm.link} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    sx={{ ml: 1 }}
                                                >
                                                    Open
                                                </Button>
                                            )
                                        }}
                                    />
                                    
                                    <Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>
                                            {t("submission.file") || "File Upload (Optional)"}
                                        </Typography>
                                        <input
                                            accept="*/*"
                                            style={{ display: "none" }}
                                            id="file-upload"
                                            type="file"
                                            onChange={handleFileChange}
                                        />
                                        <label htmlFor="file-upload">
                                            <Button
                                                variant="outlined"
                                                component="span"
                                                fullWidth
                                                sx={{ mb: 1 }}
                                            >
                                                {submissionForm.file ? submissionForm.file.name : (t("submission.choose_file") || "Choose File")}
                                            </Button>
                                        </label>
                                        {(filePreview || mySubmission?.file) && (
                                            <Box sx={{ mt: 1 }}>
                                                {mySubmission?.file && !submissionForm.file && (
                                                    <Alert severity="info" sx={{ mb: 1 }}>
                                                        {t("submission.current_file") || "Current file:"} 
                                                        <Button 
                                                            size="small" 
                                                            href={mySubmission.file} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            sx={{ ml: 1 }}
                                                        >
                                                            View
                                                        </Button>
                                                    </Alert>
                                                )}
                                                {submissionForm.file && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t("submission.new_file_selected") || "New file selected:"} {submissionForm.file.name}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                            {t("submission.file_help") || "Upload your submission file (PPT, PDF, ZIP, etc.) - Max 50MB"}
                                        </Typography>
                                    </Box>

                                    {mySubmission && (
                                        <Alert severity="success">
                                            {t("submission.already_submitted") || "You have already submitted for this round. You can update your submission."}
                                        </Alert>
                                    )}
                                    <Button
                                        variant="contained"
                                        onClick={handleSubmitSubmission}
                                        disabled={submitting || (!submissionForm.link && !submissionForm.file)}
                                        sx={{ alignSelf: "flex-start" }}
                                    >
                                        {submitting 
                                            ? (t("common.loading") || "Submitting...")
                                            : (mySubmission 
                                                ? (t("submission.update") || "Update Submission") 
                                                : (t("submission.submit") || "Submit"))}
                                    </Button>
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Standings Tab */}
                {(myRole === "participant" ? activeTab === 1 : activeTab === 0) && (
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                {t("submission.standings") || "Standings"}
                            </Typography>
                            {standings.length === 0 ? (
                                <Alert severity="info">
                                    {t("submission.no_standings") || "No submissions yet."}
                                </Alert>
                            ) : (
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>{t("submission.rank") || "Rank"}</strong></TableCell>
                                            <TableCell><strong>{t("team.name") || "Team"}</strong></TableCell>
                                            {!hideScores && <TableCell><strong>{t("submission.score") || "Score"}</strong></TableCell>}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {standings.map((submission, index) => (
                                            <TableRow key={submission._id}>
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell>{submission.team?.name || "-"}</TableCell>
                                                {!hideScores && (
                                                    <TableCell>{submission.score !== undefined ? submission.score : "-"}</TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* All Submissions Tab (Organizer/Judge/Admin only) */}
                {(myRole === "organizer" || myRole === "judge" || user?.role === "admin") && (myRole === "participant" ? activeTab === 2 : activeTab === 1) && (
                    <Card elevation={2}>
                        <CardContent>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                                <Typography variant="h6">
                                    {t("submission.all_submissions") || "All Submissions"}
                                </Typography>
                                {allSubmissions.length > 1 && (
                                    <Button
                                        variant="outlined"
                                        startIcon={<CompareArrowsIcon />}
                                        onClick={handleCompareSubmissions}
                                        size="small"
                                    >
                                        {t("submission.compare_all")}
                                    </Button>
                                )}
                            </Box>
                            {allSubmissions.length === 0 ? (
                                <Alert severity="info">
                                    {t("submission.no_submissions") || "No submissions yet."}
                                </Alert>
                            ) : (
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>{t("team.name")}</strong></TableCell>
                                            <TableCell><strong>{t("submission.link")}</strong></TableCell>
                                            <TableCell><strong>{t("submission.file")}</strong></TableCell>
                                            <TableCell><strong>{t("submission.score")}</strong></TableCell>
                                            <TableCell><strong>{t("submission.feedback")}</strong></TableCell>
                                            <TableCell><strong>{t("common.actions")}</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {allSubmissions.map((submission) => (
                                            <TableRow key={submission._id}>
                                                <TableCell>{submission.team?.name || "-"}</TableCell>
                                                <TableCell>
                                                    {submission.link ? (
                                                        <Button size="small" href={submission.link} target="_blank" rel="noopener noreferrer">
                                                            View
                                                        </Button>
                                                    ) : "-"}
                                                </TableCell>
                                                <TableCell>
                                                    {submission.file ? (
                                                        <Button size="small" href={submission.file} target="_blank" rel="noopener noreferrer">
                                                            View
                                                        </Button>
                                                    ) : "-"}
                                                </TableCell>
                                                <TableCell>
                                                    {submission.score !== undefined ? submission.score : "-"}
                                                </TableCell>
                                                <TableCell>{submission.feedback || "-"}</TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1}>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            startIcon={<AssessmentIcon />}
                                                            onClick={() => handleEvaluateSubmission(submission)}
                                                        >
                                                            {t("submission.evaluate")}
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            startIcon={<AutoAwesomeIcon />}
                                                            onClick={() => handleGenerateFeedback(submission._id, submission.score)}
                                                        >
                                                            {t("submission.ai_feedback")}
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            onClick={() => handleUpdateSubmission(submission._id)}
                                                        >
                                                            {myRole === "judge" || user?.role === "admin" ? t("submission.edit_score_feedback") : t("submission.edit_feedback")}
                                                        </Button>
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Teams at Risk Tab (Organizer/Admin only) */}
                {(myRole === "organizer" || user?.role === "admin") && 
                 (myRole === "participant" ? activeTab === 3 : activeTab === 2) && (
                    <Card elevation={2}>
                        <CardContent>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                                <Typography variant="h6">{t("reminder.at_risk_teams")}</Typography>
                                <Button
                                    variant="outlined"
                                    onClick={loadAtRiskTeams}
                                    disabled={loadingAtRisk}
                                    startIcon={loadingAtRisk ? <CircularProgress size={16} /> : <TimerIcon />}
                                >
                                    {t("common.refresh")}
                                </Button>
                            </Box>
                            {loadingAtRisk ? (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                                    <CircularProgress />
                                </Box>
                            ) : atRiskTeams.length === 0 ? (
                                <Alert severity="info">{t("reminder.no_at_risk_teams")}</Alert>
                            ) : (
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>{t("team.name")}</strong></TableCell>
                                            <TableCell><strong>{t("reminder.risk_score")}</strong></TableCell>
                                            <TableCell><strong>{t("reminder.risk_level")}</strong></TableCell>
                                            <TableCell><strong>{t("reminder.predicted_probability")}</strong></TableCell>
                                            <TableCell align="right"><strong>{t("common.actions")}</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {atRiskTeams.map((item) => {
                                            const riskLevel = item.analysis?.riskLevel || "medium";
                                            const riskColor = 
                                                riskLevel === "critical" ? "error" :
                                                riskLevel === "high" ? "warning" :
                                                riskLevel === "medium" ? "info" : "success";
                                            return (
                                                <TableRow key={item.team._id}>
                                                    <TableCell>{item.team.name}</TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={`${item.analysis?.riskScore || 0}/100`} 
                                                            color={riskColor}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={t(`reminder.${riskLevel}`)} 
                                                            color={riskColor}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.analysis?.predictedProbability || 0}%
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                onClick={() => handleViewRisk(item.team)}
                                                            >
                                                                {t("reminder.view_risk")}
                                                            </Button>
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                color="primary"
                                                                onClick={() => handleSendReminder(item.team)}
                                                            >
                                                                {t("reminder.send_reminder")}
                                                            </Button>
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Risk Analysis Dialog */}
                <Dialog 
                    open={riskDialog.open} 
                    onClose={() => setRiskDialog({ open: false, team: null, analysis: null, loading: false })} 
                    maxWidth="md" 
                    fullWidth
                >
                    <DialogTitle>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <TimerIcon color="primary" />
                            <Typography variant="h6">{t("reminder.risk_analysis")} - {riskDialog.team?.name}</Typography>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        {riskDialog.loading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : riskDialog.analysis ? (
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                                    <Typography variant="subtitle1" fontWeight={600}>{t("reminder.risk_score")}:</Typography>
                                    <Chip 
                                        label={`${riskDialog.analysis.riskScore}/100`} 
                                        color={
                                            riskDialog.analysis.riskLevel === "critical" ? "error" :
                                            riskDialog.analysis.riskLevel === "high" ? "warning" :
                                            riskDialog.analysis.riskLevel === "medium" ? "info" : "success"
                                        }
                                    />
                                    <Typography variant="subtitle1" fontWeight={600}>{t("reminder.risk_level")}:</Typography>
                                    <Chip 
                                        label={t(`reminder.${riskDialog.analysis.riskLevel}`)} 
                                        color={
                                            riskDialog.analysis.riskLevel === "critical" ? "error" :
                                            riskDialog.analysis.riskLevel === "high" ? "warning" :
                                            riskDialog.analysis.riskLevel === "medium" ? "info" : "success"
                                        }
                                    />
                                </Box>
                                <Divider />
                                {riskDialog.analysis.reasons && riskDialog.analysis.reasons.length > 0 && (
                                    <>
                                        <Typography variant="subtitle1" fontWeight={600}>{t("reminder.reasons")}</Typography>
                                        <Stack spacing={1}>
                                            {riskDialog.analysis.reasons.map((reason, idx) => (
                                                <Typography key={idx} variant="body2">• {reason}</Typography>
                                            ))}
                                        </Stack>
                                        <Divider />
                                    </>
                                )}
                                {riskDialog.analysis.recommendations && riskDialog.analysis.recommendations.length > 0 && (
                                    <>
                                        <Typography variant="subtitle1" fontWeight={600}>{t("reminder.recommendations")}</Typography>
                                        <Stack spacing={1}>
                                            {riskDialog.analysis.recommendations.map((rec, idx) => (
                                                <Typography key={idx} variant="body2">• {rec}</Typography>
                                            ))}
                                        </Stack>
                                    </>
                                )}
                            </Stack>
                        ) : null}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setRiskDialog({ open: false, team: null, analysis: null, loading: false })}>
                            {t("common.close")}
                        </Button>
                        {riskDialog.team && (
                            <Button 
                                variant="contained" 
                                onClick={() => {
                                    handleSendReminder(riskDialog.team);
                                    setRiskDialog({ open: false, team: null, analysis: null, loading: false });
                                }}
                            >
                                {t("reminder.send_reminder")}
                            </Button>
                        )}
                    </DialogActions>
                </Dialog>

                {/* Info Modal */}
                <InfoModal
                    open={infoModal.open}
                    onClose={() => setInfoModal({ open: false, type: "info", message: "" })}
                    type={infoModal.type}
                    message={infoModal.message}
                />

                {/* Score/Feedback Dialog */}
                <ScoreFeedbackDialog
                    open={scoreFeedbackDialog.open}
                    onClose={() => setScoreFeedbackDialog({ open: false, submissionId: null, allowScore: false, allowFeedback: true })}
                    onSubmit={handleSubmitScoreFeedback}
                    allowScore={scoreFeedbackDialog.allowScore}
                    allowFeedback={scoreFeedbackDialog.allowFeedback}
                    initialScore={scoreFeedbackDialog.initialScore}
                    initialFeedback={scoreFeedbackDialog.initialFeedback}
                />

                {/* AI Evaluation Dialog */}
                <Dialog open={evaluationDialog.open} onClose={() => setEvaluationDialog({ open: false, submission: null, evaluation: null, loading: false })} maxWidth="md" fullWidth>
                    <DialogTitle>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <AutoAwesomeIcon color="primary" />
                            <Typography variant="h6">{t("submission.submission_evaluation")}</Typography>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        {evaluationDialog.loading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : evaluationDialog.evaluation ? (
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                <Typography variant="h6">{evaluationDialog.submission?.team?.name || "Submission"}</Typography>
                                {evaluationDialog.evaluation.evaluation?.scores && (
                                    <>
                                        <Typography variant="subtitle1" fontWeight={600}>{t("submission.scores")}</Typography>
                                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                            {Object.entries(evaluationDialog.evaluation.evaluation.scores).map(([key, value]) => (
                                                <Chip
                                                    key={key}
                                                    label={`${key}: ${value}/100`}
                                                    color={value >= 80 ? "success" : value >= 60 ? "warning" : "error"}
                                                />
                                            ))}
                                        </Box>
                                        <Chip
                                            label={`${t("submission.overall_score")}: ${evaluationDialog.evaluation.evaluation.overallScore}/100`}
                                            color="primary"
                                            size="large"
                                            sx={{ fontSize: "1rem", fontWeight: 600 }}
                                        />
                                    </>
                                )}
                                {evaluationDialog.evaluation.evaluation?.strengths && (
                                    <>
                                        <Divider />
                                        <Typography variant="subtitle1" fontWeight={600}>{t("submission.strengths")}</Typography>
                                        <Stack spacing={1}>
                                            {evaluationDialog.evaluation.evaluation.strengths.map((strength, idx) => (
                                                <Typography key={idx} variant="body2">• {strength}</Typography>
                                            ))}
                                        </Stack>
                                    </>
                                )}
                                {evaluationDialog.evaluation.evaluation?.areasForImprovement && (
                                    <>
                                        <Divider />
                                        <Typography variant="subtitle1" fontWeight={600}>{t("submission.areas_for_improvement")}</Typography>
                                        <Stack spacing={1}>
                                            {evaluationDialog.evaluation.evaluation.areasForImprovement.map((area, idx) => (
                                                <Typography key={idx} variant="body2">• {area}</Typography>
                                            ))}
                                        </Stack>
                                    </>
                                )}
                                {evaluationDialog.evaluation.evaluation?.detailedFeedback && (
                                    <>
                                        <Divider />
                                        <Typography variant="subtitle1" fontWeight={600}>{t("submission.detailed_feedback")}</Typography>
                                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                                            {evaluationDialog.evaluation.evaluation.detailedFeedback}
                                        </Typography>
                                    </>
                                )}
                            </Stack>
                        ) : null}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEvaluationDialog({ open: false, submission: null, evaluation: null, loading: false })}>{t("common.close")}</Button>
                    </DialogActions>
                </Dialog>

                {/* Comparison Dialog */}
                <Dialog open={comparisonDialog.open} onClose={() => setComparisonDialog({ open: false, insights: null, loading: false })} maxWidth="md" fullWidth>
                    <DialogTitle>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <CompareArrowsIcon color="info" />
                            <Typography variant="h6">{t("submission.submission_comparison")}</Typography>
                        </Box>
                    </DialogTitle>
                    <DialogContent>
                        {comparisonDialog.loading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : comparisonDialog.insights ? (
                            <Stack spacing={2} sx={{ mt: 1 }}>
                                {comparisonDialog.insights.summary && (
                                    <>
                                        <Typography variant="subtitle1" fontWeight={600}>{t("submission.summary")}</Typography>
                                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                                            {comparisonDialog.insights.summary}
                                        </Typography>
                                    </>
                                )}
                                {comparisonDialog.insights.insights && comparisonDialog.insights.insights.length > 0 && (
                                    <>
                                        <Divider />
                                        <Typography variant="subtitle1" fontWeight={600}>{t("submission.insights")}</Typography>
                                        {comparisonDialog.insights.insights.map((insight, idx) => (
                                            <Paper key={idx} sx={{ p: 2, bgcolor: "action.hover" }}>
                                                <Chip
                                                    label={insight.type}
                                                    size="small"
                                                    color={insight.type === "trend" ? "info" : insight.type === "strength" ? "success" : insight.type === "weakness" ? "error" : "warning"}
                                                    sx={{ mb: 1 }}
                                                />
                                                <Typography variant="subtitle2" fontWeight={600}>{insight.title}</Typography>
                                                <Typography variant="body2" sx={{ mt: 1 }}>
                                                    {insight.description}
                                                </Typography>
                                            </Paper>
                                        ))}
                                    </>
                                )}
                            </Stack>
                        ) : null}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setComparisonDialog({ open: false, insights: null, loading: false })}>{t("common.close")}</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </DashboardLayout>
    );
};

export default RoundDetailsPage;

