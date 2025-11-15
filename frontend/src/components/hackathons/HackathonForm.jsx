import React, { useState, useEffect } from "react";
import {
    Paper,
    Typography,
    TextField,
    Button,
    Stack,
    Checkbox,
    FormControlLabel,
    IconButton,
    Grid,
    FormHelperText,
    Box,
    CircularProgress,
} from "@mui/material";
import { Add, Delete, AutoAwesome, Lightbulb } from "@mui/icons-material";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import MDEditor from "@uiw/react-md-editor";
import { useTheme } from "@mui/material/styles";
import { formatHackathonDescription, suggestRound } from "../../api/hackathons";

const HackathonForm = ({ onSubmit, initialData, onCancel }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const colorScheme = theme.palette.mode === "dark" ? "dark" : "light";

    const [title, setTitle] = useState(initialData?.title || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [isActive, setIsActive] = useState(initialData?.isActive ?? false);
    const [minimumTeamSize, setMinimumTeamSize] = useState(initialData?.mnimumTeamSize || initialData?.minimumTeamSize || 1);
    const [maximumTeamSize, setMaximumTeamSize] = useState(initialData?.maximumTeamSize || 5);
    const [rounds, setRounds] = useState(initialData?.rounds || []);
    const [formatting, setFormatting] = useState(false);
    const [suggestingRound, setSuggestingRound] = useState(null); // Track which round is being suggested
    const token = localStorage.getItem("token");

    useEffect(() => {
        setTitle(initialData?.title || "");
        setDescription(initialData?.description || "");
        setIsActive(initialData?.isActive ?? false);
        setMinimumTeamSize(initialData?.mnimumTeamSize || initialData?.minimumTeamSize || 1);
        setMaximumTeamSize(initialData?.maximumTeamSize || 5);
        setRounds(initialData?.rounds || []);
    }, [initialData]);

    const handleAddRound = async (useAI = false) => {
        const newRound = { name: "", description: "", startDate: "", endDate: "", isActive: false, hideScores: false };
        
        if (useAI && title.trim()) {
            try {
                setSuggestingRound(rounds.length);
                const roundNumber = rounds.length + 1;
                const existingRounds = rounds.map((r, idx) => ({ name: r.name, roundNumber: idx + 1 }));
                const result = await suggestRound(title, description, roundNumber, existingRounds, null, token);
                
                if (result.round) {
                    newRound.name = result.round.name || "";
                    newRound.description = result.round.description || "";
                    newRound.startDate = result.round.startDate || "";
                    newRound.endDate = result.round.endDate || "";
                    newRound.isActive = result.round.isActive !== undefined ? result.round.isActive : true;
                    newRound.hideScores = result.round.hideScores !== undefined ? result.round.hideScores : false;
                    toast.success(t("hackathon.round_filled_success_plural"));
                }
            } catch (error) {
                console.error("Error suggesting round:", error);
                toast.error(t("hackathon.suggest_failed_empty"));
            } finally {
                setSuggestingRound(null);
            }
        }
        
        setRounds([...rounds, newRound]);
    };

    const handleRoundChange = (index, field, value) => {
        const updated = [...rounds];
        updated[index][field] = value;
        setRounds(updated);
    };

    const handleRemoveRound = (index) => {
        const updated = [...rounds];
        updated.splice(index, 1);
        setRounds(updated);
    };

    const handleFormatDescription = async () => {
        if (!title.trim() || !description.trim()) {
            toast.error(t("hackathon.all_fields_required") || "Title and description are required");
            return;
        }
        try {
            setFormatting(true);
            const result = await formatHackathonDescription(title, description, token);
            setTitle(result.formattedTitle || title);
            setDescription(result.formattedDescription || description);
            toast.success(t("hackathon.format_success"));
        } catch (error) {
            console.error("Error formatting hackathon description:", error);
            toast.error(error.response?.data?.message || t("hackathon.format_failed"));
        } finally {
            setFormatting(false);
        }
    };

    const handleSubmit = async () => {
        if (!title || !description) return toast.error(t("hackathon.all_fields_required"));
        
        // Validate team size
        if (minimumTeamSize < 1) {
            return toast.error(t("hackathon.min_team_size_invalid") || "Minimum team size must be at least 1");
        }
        if (maximumTeamSize < minimumTeamSize) {
            return toast.error(t("hackathon.max_team_size_invalid") || "Maximum team size must be greater than or equal to minimum team size");
        }

        const formattedRounds = rounds.map((r) => ({
            ...r,
            startDate: r.startDate && r.startDate.trim() ? new Date(r.startDate).toISOString() : undefined,
            endDate: r.endDate && r.endDate.trim() ? new Date(r.endDate).toISOString() : undefined,
            isActive: !!r.isActive,
            hideScores: !!r.hideScores,
            name: r.name?.trim() || "",
            description: r.description?.trim() || "",
        }));

        const payload = {
            title: title.trim(),
            description: description.trim(),
            isActive,
            mnimumTeamSize: minimumTeamSize,
            maximumTeamSize: maximumTeamSize,
            rounds: formattedRounds,
        };

        try {
            await onSubmit(payload);
            // Success toast is handled by parent component
            setTitle("");
            setDescription("");
            setIsActive(false);
            setMinimumTeamSize(1);
            setMaximumTeamSize(5);
            setRounds([]);
        } catch (err) {
            console.error("Hackathon submission error:", err);
            // Error toast is handled by parent component
        }
    };

    return (
        <Paper data-testid="hackathon-form" elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={600}>
                {initialData ? t("hackathon.edit_hackathon") : t("hackathon.create_hackathon")}
            </Typography>

            <Stack spacing={2} mt={2}>
                <TextField
                    fullWidth
                    label={t("hackathon.title")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    inputProps={{ "aria-label": "Hackathon Title" }}
                />

                {/* AI Format Button */}
                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={formatting ? <CircularProgress size={16} /> : <AutoAwesome />}
                        onClick={handleFormatDescription}
                        disabled={formatting || !title.trim() || !description.trim()}
                        sx={{ textTransform: "none", minWidth: "160px" }}
                    >
                        {formatting ? t("hackathon.formatting") : t("hackathon.format_with_ai")}
                    </Button>
                </Box>
                
                <div data-color-mode={colorScheme}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        {t("hackathon.description")}
                    </Typography>
                    {(!title.trim() || !description.trim()) && (
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                            {t("hackathon.format_help")}
                        </Typography>
                    )}
                    <MDEditor
                        value={description}
                        onChange={setDescription}
                        height={300}
                        preview="edit"
                        textareaProps={{ "data-testid": "md-editor", "aria-label": "Hackathon Description" }}
                    />
                </div>

                <FormControlLabel
                    control={<Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
                    label={t("hackathon.is_active")}
                />

                <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2 }}>
                    {t("hackathon.team_size") || "Team Size"}
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            type="number"
                            label={t("hackathon.minimum_team_size") || "Minimum Team Size"}
                            value={minimumTeamSize}
                            onChange={(e) => setMinimumTeamSize(Math.max(1, parseInt(e.target.value) || 1))}
                            inputProps={{ min: 1, "aria-label": "Minimum Team Size" }}
                            helperText={t("hackathon.minimum_team_size_help") || "Minimum number of members required in a team"}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            type="number"
                            label={t("hackathon.maximum_team_size") || "Maximum Team Size"}
                            value={maximumTeamSize}
                            onChange={(e) => setMaximumTeamSize(Math.max(minimumTeamSize, parseInt(e.target.value) || minimumTeamSize))}
                            inputProps={{ min: minimumTeamSize, "aria-label": "Maximum Team Size" }}
                            helperText={t("hackathon.maximum_team_size_help") || "Maximum number of members allowed in a team"}
                        />
                    </Grid>
                </Grid>

                <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2 }}>
                    {t("hackathon.rounds")}
                </Typography>

                {rounds.map((round, index) => (
                    <Paper data-testid="round-container" key={index} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label={t("hackathon.round_name")}
                                    value={round.name}
                                    onChange={(e) => handleRoundChange(index, "name", e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    startIcon={suggestingRound === index ? <CircularProgress size={16} /> : <Lightbulb />}
                                    onClick={async () => {
                                        if (!title.trim()) {
                                            toast.error(t("hackathon.title_required"));
                                            return;
                                        }
                                        try {
                                            setSuggestingRound(index);
                                            const roundNumber = index + 1;
                                            const existingRounds = rounds.map((r, idx) => ({ name: r.name, roundNumber: idx + 1 }));
                                            const result = await suggestRound(title, description, roundNumber, existingRounds, null, token);
                                            
                                            if (result.round) {
                                                handleRoundChange(index, "name", result.round.name || "");
                                                handleRoundChange(index, "description", result.round.description || "");
                                                handleRoundChange(index, "startDate", result.round.startDate || "");
                                                handleRoundChange(index, "endDate", result.round.endDate || "");
                                                handleRoundChange(index, "isActive", result.round.isActive !== undefined ? result.round.isActive : true);
                                                handleRoundChange(index, "hideScores", result.round.hideScores !== undefined ? result.round.hideScores : false);
                                                toast.success(t("hackathon.round_filled_success"));
                                            }
                                        } catch (error) {
                                            console.error("Error suggesting round:", error);
                                            toast.error(t("hackathon.suggest_failed"));
                                        } finally {
                                            setSuggestingRound(null);
                                        }
                                    }}
                                    disabled={suggestingRound === index || !title.trim()}
                                    sx={{ textTransform: "none", width: "100%" }}
                                >
                                    {suggestingRound === index ? t("hackathon.filling") : t("hackathon.fill_with_ai")}
                                </Button>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label={t("hackathon.round_description")}
                                    value={round.description}
                                    onChange={(e) => handleRoundChange(index, "description", e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label={t("hackathon.round_start_date")}
                                    value={round.startDate?.split("T")[0] || ""}
                                    onChange={(e) => handleRoundChange(index, "startDate", e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label={t("hackathon.round_end_date")}
                                    value={round.endDate?.split("T")[0] || ""}
                                    onChange={(e) => handleRoundChange(index, "endDate", e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={round.isActive ?? false}
                                            onChange={(e) => handleRoundChange(index, "isActive", e.target.checked)}
                                        />
                                    }
                                    label={t("hackathon.is_active")}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={round.hideScores ?? false}
                                            onChange={(e) => handleRoundChange(index, "hideScores", e.target.checked)}
                                        />
                                    }
                                    label={t("hackathon.hide_scores")}
                                />
                                <FormHelperText sx={{ ml: 4.5, mt: -0.5 }}>
                                    {t("hackathon.hide_scores_help")}
                                </FormHelperText>
                            </Grid>
                            <Grid item xs={12} sm={12}>
                                <IconButton color="error" onClick={() => handleRemoveRound(index)}>
                                    <Delete />
                                </IconButton>
                            </Grid>
                        </Grid>
                    </Paper>
                ))}

                <Stack direction="row" spacing={2}>
                    <Button 
                        startIcon={<Add />} 
                        onClick={() => handleAddRound(false)}
                        variant="outlined"
                    >
                        {t("hackathon.add_round")}
                    </Button>
                    <Button 
                        startIcon={suggestingRound === rounds.length ? <CircularProgress size={16} /> : <AutoAwesome />}
                        onClick={() => handleAddRound(true)}
                        variant="contained"
                        color="primary"
                        disabled={suggestingRound !== null || !title.trim()}
                        sx={{ textTransform: "none" }}
                    >
                        {suggestingRound === rounds.length ? t("hackathon.adding") : t("hackathon.add_round_with_ai")}
                    </Button>
                </Stack>

                <Stack direction="row" spacing={2} sx={{ alignSelf: "flex-start" }}>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                        sx={{ px: 4 }}
                >
                    {initialData ? t("hackathon.update") : t("hackathon.create")}
                </Button>
                    {onCancel && (
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={onCancel}
                            sx={{ px: 4 }}
                        >
                            {t("common.cancel")}
                        </Button>
                    )}
                </Stack>
            </Stack>
        </Paper>
    );
};

export default HackathonForm;
