import React from "react";

import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from "@mui/material";

import {
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    Warning as WarningIcon,
} from "@mui/icons-material";

import { useTranslation } from "react-i18next";

const InfoModal = ({ open, onClose, type = "info", title, message, buttonText, onButtonClick, }) => {
    const { t } = useTranslation();

    const getIcon = () => {
        switch (type) {
            case "success":
                return <CheckCircleIcon color="success" sx={{ fontSize: 48 }} />;
            case "error":
                return <ErrorIcon color="error" sx={{ fontSize: 48 }} />;
            case "warning":
                return <WarningIcon color="warning" sx={{ fontSize: 48 }} />;
            default:
                return <InfoIcon color="info" sx={{ fontSize: 48 }} />;
        }
    };

    const getTitle = () => {
        if (title) return title;
        switch (type) {
            case "success":
                return t("common.success") || "Success";
            case "error":
                return t("common.error") || "Error";
            case "warning":
                return t("common.warning") || "Warning";
            default:
                return t("common.info") || "Information";
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    {getIcon()}
                    <Typography variant="h6">{getTitle()}</Typography>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body1" sx={{ mt: 1 }}>
                    {message}
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onButtonClick || onClose} variant="contained" color={type === "error" ? "error" : "primary"}>
                    {buttonText || t("common.close") || "Close"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default InfoModal;

