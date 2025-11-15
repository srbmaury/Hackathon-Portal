import React, { useState } from "react";
import { Button, TextField, Box, Typography, useTheme } from "@mui/material";
import MDEditor from "@uiw/react-md-editor";
import { useTranslation } from "react-i18next";
import { createAnnouncement } from "../../api/announcements";
import toast from "react-hot-toast";

const AnnouncementCreate = ({ onCreated }) => {
    const { t } = useTranslation();
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const token = localStorage.getItem("token");
    const theme = useTheme();
    
    // Determine color scheme based on theme
    const colorScheme = theme.palette.mode === "dark" ? "dark" : "light";

    const handleSubmit = async () => {
        if (!title || !message) {
            toast.error(t("announcement.all_fields_required"));
            return;
        }

        try {
                const response = await createAnnouncement({ title, message }, token);
                const successMsg = (response && response.message) ? response.message : t("announcement.announcement_created");
                toast.success(successMsg);
            setTitle("");
            setMessage("");
            if (onCreated) onCreated(); // Refresh list
        } catch (err) {
            console.error(err);
            const errorMsg = err.response?.data?.message || t("announcement.creation_failed");
            toast.error(errorMsg);
        }
    };

    return (
        <Box sx={{ mb: 4 }}>
            <Typography variant="h6">{t("announcement.create_announcement")}</Typography>
            <TextField
                label={t("announcement.title")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                sx={{ mb: 2, mt: 2 }}
            />
            <Box data-color-mode={colorScheme}>
                <MDEditor 
                    value={message} 
                    onChange={setMessage} 
                    height={300}
                    preview="edit"
                />
            </Box>
            <Button
                variant="contained"
                color="primary"
                sx={{ mt: 2 }}
                onClick={handleSubmit}
            >
                {t("announcement.create")}
            </Button>
        </Box>
    );
};

export default AnnouncementCreate;
