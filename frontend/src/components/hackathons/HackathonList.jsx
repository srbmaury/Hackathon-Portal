import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import { EventNote as EventNoteIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import HackathonItem from "./HackathonItem";

const HackathonList = ({ hackathons, onEdit, onDelete }) => {
    const { t } = useTranslation();

    if (!hackathons || hackathons.length === 0) {
        return (
            <Paper 
                elevation={0} 
                sx={{ 
                    p: 8, 
                    textAlign: "center", 
                    backgroundColor: "background.default",
                    border: "2px dashed",
                    borderColor: "divider"
                }}
            >
                <EventNoteIcon sx={{ fontSize: 80, color: "text.secondary", mb: 2 }} />
                <Typography variant="h5" color="text.secondary" gutterBottom>
                    {t("hackathon.no_hackathons_title") || "No Hackathons Yet"}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    {t("hackathon.no_hackathons_message") || "Start creating your first hackathon to bring innovation to life!"}
                </Typography>
            </Paper>
        );
    }

    return (
        <>
            {hackathons.map((hackathon) => (
                <HackathonItem
                    key={hackathon._id}
                    hackathon={hackathon}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </>
    );
};

export default HackathonList;
