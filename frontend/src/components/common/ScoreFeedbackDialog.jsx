import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Stack,
} from "@mui/material";
import { useTranslation } from "react-i18next";

const ScoreFeedbackDialog = ({
    open,
    onClose,
    onSubmit,
    allowScore = true,
    allowFeedback = true,
    initialScore = "",
    initialFeedback = "",
}) => {
    const { t } = useTranslation();
    const [score, setScore] = useState(initialScore);
    const [feedback, setFeedback] = useState(initialFeedback);
    const [scoreError, setScoreError] = useState("");

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (open) {
            setScore(initialScore);
            setFeedback(initialFeedback);
            setScoreError("");
        }
    }, [open, initialScore, initialFeedback]);

    // Validate score and set error state (for onChange)
    const validateScoreAndSetError = (value) => {
        if (value.trim() === "") {
            setScoreError("");
            return true;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            setScoreError(t("submission.score_invalid") || "Score must be a number");
            return false;
        }
        if (numValue < 0 || numValue > 100) {
            setScoreError(t("submission.score_range") || "Score must be between 0 and 100");
            return false;
        }
        setScoreError("");
        return true;
    };

    // Validate score without setting state (for form validation)
    const checkScoreValid = (value) => {
        if (value.trim() === "") {
            return true;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            return false;
        }
        if (numValue < 0 || numValue > 100) {
            return false;
        }
        return true;
    };

    const handleScoreChange = (e) => {
        const value = e.target.value;
        setScore(value);
        validateScoreAndSetError(value);
    };

    const handleSubmit = () => {
        // Validate score before submitting
        if (allowScore && score.trim() !== "") {
            if (!checkScoreValid(score)) {
                // Set error if validation fails
                validateScoreAndSetError(score);
                return;
            }
        }

        const submitData = {};
        if (allowScore && score.trim() !== "") {
            submitData.score = parseFloat(score);
        }
        if (allowFeedback && feedback.trim() !== "") {
            submitData.feedback = feedback;
        }
        onSubmit(submitData);
        setScore("");
        setFeedback("");
        setScoreError("");
        onClose();
    };

    const handleClose = () => {
        setScore("");
        setFeedback("");
        setScoreError("");
        onClose();
    };

    const isFormValid = () => {
        // If score is provided, it must be valid (check without setting state)
        if (allowScore && score.trim() !== "") {
            if (!checkScoreValid(score)) {
                return false;
            }
        }
        // At least one field must be filled (score or feedback)
        const hasScore = allowScore && score.trim() !== "";
        const hasFeedback = allowFeedback && feedback.trim() !== "";
        return hasScore || hasFeedback;
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                {allowScore && allowFeedback 
                    ? t("submission.edit_score_feedback")
                    : t("submission.edit_feedback")
                }
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {allowScore && (
                        <TextField
                            fullWidth
                            label={t("submission.enter_score")}
                            type="number"
                            value={score}
                            onChange={handleScoreChange}
                            inputProps={{ min: 0, max: 100, step: 0.1 }}
                            error={!!scoreError}
                            helperText={scoreError || (t("submission.score_range_help") || "Enter a score between 0 and 100")}
                        />
                    )}
                    {allowFeedback && (
                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label={allowScore ? t("submission.enter_feedback") : t("submission.enter_feedback_required")}
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        />
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t("common.cancel")}</Button>
                <Button 
                    variant="contained" 
                    onClick={handleSubmit}
                    disabled={!isFormValid()}
                >
                    {t("common.update")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ScoreFeedbackDialog;

