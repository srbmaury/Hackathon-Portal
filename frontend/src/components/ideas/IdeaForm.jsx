import React, { useState } from "react";
import {
    Paper,
    Typography,
    TextField,
    Checkbox,
    FormControlLabel,
    Button,
    Stack,
} from "@mui/material";

import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import { submitIdea } from "../../api/ideas";

const IdeaForm = ({ token, onIdeaSubmitted }) => {
    const { t } = useTranslation();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(true);

    const handleSubmit = async () => {
        if (!title || !description) {
            toast.error(t("idea.all_fields_required"));
            return;
        }

        try {
            await submitIdea({ title, description, isPublic }, token);
            toast.success(t("idea.idea_submitted"));
            setTitle("");
            setDescription("");
            setIsPublic(true);
            onIdeaSubmitted();
        } catch (err) {
            console.error(err);
            toast.error(t("idea.idea_submit_failed"));
        }
    };

    return (
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h5" gutterBottom fontWeight={600}>
                {t("idea.share_idea")}
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, color: "text.secondary" }}>
                {t("idea.idea_description")}
            </Typography>

            <Stack spacing={2}>
                <TextField
                    fullWidth
                    label={t("idea.title")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label={t("idea.description")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={isPublic}
                            onChange={(e) => setIsPublic(e.target.checked)}
                        />
                    }
                    label={t("idea.make_public")}
                />
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                    sx={{ alignSelf: "flex-start", px: 4 }}
                >
                    {t("idea.submit")}
                </Button>
            </Stack>
        </Paper>
    );
};

export default IdeaForm;
