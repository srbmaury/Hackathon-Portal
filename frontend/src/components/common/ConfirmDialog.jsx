// src/components/common/ConfirmDialog.jsx
import React from "react";

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
} from "@mui/material";

import { useTranslation } from "react-i18next";

const ConfirmDialog = ({ open, title, message, confirmText, cancelText, onConfirm, onCancel, confirmColor = "error" }) => {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>{title || t("common.confirm_title")}</DialogTitle>
            <DialogContent>
                <Typography variant="body1">{message}</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} color="inherit">
                    {cancelText || t("common.cancel")}
                </Button>
                <Button onClick={onConfirm} color={confirmColor} variant="contained" autoFocus>
                    {confirmText || t("common.confirm")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;
