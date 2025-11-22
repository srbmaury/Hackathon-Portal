import React, { useContext, useState } from "react";

import {
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";

import {
    Assessment,
    AutoAwesome,
    Delete,
    Edit,
    Lightbulb,
    Search,
} from "@mui/icons-material";

import toast from "react-hot-toast";

import { useTranslation } from "react-i18next";

import { AuthContext } from "../../context/AuthContext";

import ConfirmDialog from "../common/ConfirmDialog";

import {
    deleteIdea,
    editIdea,
    evaluateIdea,
    findSimilarIdeas,
    getIdeaImprovements,
} from "../../api/ideas";

const IdeasTable = ({ ideas = [], filter, onIdeaUpdated, showActions = false }) => {
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);
    const token = localStorage.getItem("token");

    const [selectedIdea, setSelectedIdea] = useState(null);
    const [editData, setEditData] = useState({ title: "", description: "", isPublic: true });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, ideaId: null, ideaTitle: "" });

    // AI features state
    const [evaluationDialog, setEvaluationDialog] = useState({ open: false, idea: null, evaluation: null, loading: false });
    const [similarIdeasDialog, setSimilarIdeasDialog] = useState({ open: false, idea: null, similarIdeas: [], loading: false });
    const [improvementsDialog, setImprovementsDialog] = useState({ open: false, idea: null, improvements: null, loading: false });

    const handleEditClick = (idea) => {
        setSelectedIdea(idea);
        setEditData({ title: idea.title, description: idea.description, isPublic: idea.isPublic });
    };

    const handleCloseEdit = () => setSelectedIdea(null);

    const handleSave = async () => {
        try {
            await editIdea(selectedIdea._id, editData, token);
            toast.success(t("idea.idea_updated"));
            handleCloseEdit();
            onIdeaUpdated();
        } catch (err) {
            console.error(err);
            toast.error(t("idea.idea_update_failed"));
        }
    };

    // ✨ NEW delete modal logic
    const handleOpenDelete = (idea) => {
        setDeleteDialog({ open: true, ideaId: idea._id, ideaTitle: idea.title });
    };

    const handleCloseDelete = () => {
        setDeleteDialog({ open: false, ideaId: null, ideaTitle: "" });
    };

    const handleConfirmDelete = async () => {
        try {
            await deleteIdea(deleteDialog.ideaId, token);
            toast.success(t("idea.idea_deleted"));
            handleCloseDelete();
            onIdeaUpdated();
        } catch (err) {
            console.error(err);
            toast.error(t("idea.idea_delete_failed"));
        }
    };

    // AI feature handlers
    const handleEvaluateIdea = async (idea) => {
        setEvaluationDialog({ open: true, idea, evaluation: null, loading: true });
        try {
            const result = await evaluateIdea(idea._id, token);
            setEvaluationDialog({ open: true, idea, evaluation: result.evaluation, loading: false });
        } catch (err) {
            console.error(err);
            toast.error(t("idea.evaluate_failed"));
            setEvaluationDialog({ open: false, idea: null, evaluation: null, loading: false });
        }
    };

    const handleFindSimilarIdeas = async (idea) => {
        setSimilarIdeasDialog({ open: true, idea, similarIdeas: [], loading: true });
        try {
            const result = await findSimilarIdeas(idea._id, token);
            setSimilarIdeasDialog({ open: true, idea, similarIdeas: result.similarIdeas || [], loading: false });
        } catch (err) {
            console.error(err);
            toast.error(t("idea.similar_failed"));
            setSimilarIdeasDialog({ open: false, idea: null, similarIdeas: [], loading: false });
        }
    };

    const handleGetImprovements = async (idea) => {
        setImprovementsDialog({ open: true, idea, improvements: null, loading: true });
        try {
            const result = await getIdeaImprovements(idea._id, token);
            setImprovementsDialog({ open: true, idea, improvements: result, loading: false });
        } catch (err) {
            console.error(err);
            toast.error(t("idea.improvements_failed"));
            setImprovementsDialog({ open: false, idea: null, improvements: null, loading: false });
        }
    };

    const isIdeaOwner = (idea) => idea.submitter?._id === user._id;
    const isOrganizerOrAdmin = user.role === "admin" || user.role === "organizer";

    const filteredIdeas =
        filter === "all"
            ? ideas
            : filter === "mine"
                ? ideas.filter((idea) => idea.submitter._id === user._id)
                : filter === "others"
                    ? ideas.filter((idea) => idea.submitter._id !== user._id)
                    : filter === "public"
                        ? ideas.filter((idea) => idea.isPublic)
                        : ideas.filter((idea) => !idea.isPublic);

    return (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table>
                <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                        <TableCell><b>{t("idea.number")}</b></TableCell>
                        <TableCell><b>{t("idea.title")}</b></TableCell>
                        <TableCell><b>{t("idea.description")}</b></TableCell>
                        <TableCell><b>{t("idea.visibility")}</b></TableCell>
                        <TableCell><b>{t("idea.submitter")}</b></TableCell>
                        <TableCell align="right">
                            <b>{t("idea.actions")}</b>
                        </TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>
                    {filteredIdeas.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} align="center">
                                <Typography variant="body2" color="text.secondary">
                                    {t("idea.no_ideas")}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredIdeas.map((idea, index) => (
                            <TableRow
                                key={idea._id}
                                sx={{
                                    "&:hover": { bgcolor: "action.hover" },
                                    transition: "background-color 0.2s"
                                }}
                            >
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{idea.title}</TableCell>
                                <TableCell
                                    sx={{
                                        maxWidth: 350,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis"
                                    }}
                                >
                                    {idea.description}
                                </TableCell>
                                <TableCell>
                                    {idea.isPublic ? t("idea.public") : t("idea.private")}
                                </TableCell>
                                <TableCell>
                                    {idea.submitter?.name || idea.submitter?.email || "Unknown"}
                                </TableCell>
                                <TableCell align="right">
                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                                        {/* AI buttons - always visible */}
                                        <IconButton
                                            size="small"
                                            onClick={() => handleEvaluateIdea(idea)}
                                            title={t("idea.evaluate_with_ai")}
                                            color="primary"
                                        >
                                            <Assessment fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleFindSimilarIdeas(idea)}
                                            title={t("idea.find_similar")}
                                            color="info"
                                        >
                                            <Search fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleGetImprovements(idea)}
                                            title={t("idea.get_improvements")}
                                            color="warning"
                                        >
                                            <Lightbulb fontSize="small" />
                                        </IconButton>

                                        {/* Edit/Delete buttons - only when showActions is true */}
                                        {showActions && (
                                            <>
                                                <IconButton
                                                    onClick={() => handleEditClick(idea)}
                                                    data-testid="edit-button"
                                                >
                                                    <Edit />
                                                </IconButton>
                                                <IconButton
                                                    onClick={() => handleOpenDelete(idea)}
                                                    data-testid="delete-button"
                                                >
                                                    <Delete color="error" />
                                                </IconButton>
                                            </>
                                        )}
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* ✨ Edit Modal */}
            {showActions && (
                <Dialog open={!!selectedIdea} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
                    <DialogTitle>{t("idea.edit_idea")}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField
                                fullWidth
                                label={t("idea.title")}
                                value={editData.title}
                                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                            />
                            <TextField
                                fullWidth
                                multiline
                                rows={4}
                                label={t("idea.description")}
                                value={editData.description}
                                onChange={(e) =>
                                    setEditData({ ...editData, description: e.target.value })
                                }
                            />
                            <Stack direction="row" alignItems="center">
                                <Checkbox
                                    checked={editData.isPublic}
                                    onChange={(e) =>
                                        setEditData({ ...editData, isPublic: e.target.checked })
                                    }
                                />
                                <Typography>{t("idea.make_public")}</Typography>
                            </Stack>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseEdit} color="inherit">
                            {t("idea.cancel")}
                        </Button>
                        <Button onClick={handleSave} variant="contained" color="primary">
                            {t("idea.save_changes")}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            <ConfirmDialog
                open={deleteDialog.open}
                title={t("idea.confirm_delete_message")}
                message={`${deleteDialog.ideaTitle}\n${t("idea.delete_warning")}`}
                confirmText={t("idea.confirm_delete")}
                cancelText={t("idea.cancel")}
                confirmColor="error"
                onConfirm={handleConfirmDelete}
                onCancel={handleCloseDelete}
            />

            {/* AI Evaluation Dialog */}
            <Dialog open={evaluationDialog.open} onClose={() => setEvaluationDialog({ open: false, idea: null, evaluation: null, loading: false })} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <AutoAwesome color="primary" />
                        <Typography variant="h6">{t("idea.idea_evaluation")}</Typography>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {evaluationDialog.loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : evaluationDialog.evaluation ? (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="h6">{evaluationDialog.idea?.title}</Typography>
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
                    <Button onClick={() => setEvaluationDialog({ open: false, idea: null, evaluation: null, loading: false })}>{t("common.close")}</Button>
                </DialogActions>
            </Dialog>

            {/* Similar Ideas Dialog */}
            <Dialog open={similarIdeasDialog.open} onClose={() => setSimilarIdeasDialog({ open: false, idea: null, similarIdeas: [], loading: false })} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Search color="info" />
                        <Typography variant="h6">{t("idea.similar_ideas")}</Typography>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {similarIdeasDialog.loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : similarIdeasDialog.similarIdeas.length === 0 ? (
                        <Typography>{t("idea.no_similar_ideas")}</Typography>
                    ) : (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                {t("idea.found_similar", { count: similarIdeasDialog.similarIdeas.length, title: similarIdeasDialog.idea?.title })}
                            </Typography>
                            {similarIdeasDialog.similarIdeas.map((similar, idx) => (
                                <Paper key={idx} sx={{ p: 2, bgcolor: "action.hover" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", mb: 1 }}>
                                        <Typography variant="subtitle1" fontWeight={600}>{similar.idea?.title}</Typography>
                                        <Chip label={t("idea.similarity_score", { score: similar.similarityScore })} size="small" color="info" />
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">{similar.idea?.description}</Typography>
                                    {similar.reason && (
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                                            {t("idea.reason")}: {similar.reason}
                                        </Typography>
                                    )}
                                </Paper>
                            ))}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSimilarIdeasDialog({ open: false, idea: null, similarIdeas: [], loading: false })}>{t("common.close")}</Button>
                </DialogActions>
            </Dialog>

            {/* Improvements Dialog */}
            <Dialog open={improvementsDialog.open} onClose={() => setImprovementsDialog({ open: false, idea: null, improvements: null, loading: false })} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Lightbulb color="warning" />
                        <Typography variant="h6">{t("idea.improvement_suggestions")}</Typography>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {improvementsDialog.loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : improvementsDialog.improvements ? (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="h6">{improvementsDialog.idea?.title}</Typography>
                            {improvementsDialog.improvements.suggestions && improvementsDialog.improvements.suggestions.length > 0 && (
                                <>
                                    <Typography variant="subtitle1" fontWeight={600}>{t("idea.suggestions")}</Typography>
                                    {improvementsDialog.improvements.suggestions.map((suggestion, idx) => (
                                        <Paper key={idx} sx={{ p: 2, bgcolor: "action.hover" }}>
                                            <Typography variant="subtitle2" fontWeight={600} color="primary">
                                                {suggestion.category}
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 1 }}>
                                                {suggestion.suggestion}
                                            </Typography>
                                        </Paper>
                                    ))}
                                </>
                            )}
                            {improvementsDialog.improvements.improvedTitle && (
                                <>
                                    <Divider />
                                    <Typography variant="subtitle1" fontWeight={600}>{t("idea.suggested_improved_title")}</Typography>
                                    <Typography variant="body1">{improvementsDialog.improvements.improvedTitle}</Typography>
                                </>
                            )}
                            {improvementsDialog.improvements.improvedDescription && (
                                <>
                                    <Divider />
                                    <Typography variant="subtitle1" fontWeight={600}>{t("idea.suggested_improved_description")}</Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                                        {improvementsDialog.improvements.improvedDescription}
                                    </Typography>
                                </>
                            )}
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setImprovementsDialog({ open: false, idea: null, improvements: null, loading: false })}>{t("common.close")}</Button>
                </DialogActions>
            </Dialog>
        </TableContainer>
    );
};

export default IdeasTable;
