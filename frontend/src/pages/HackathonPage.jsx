import React, { useEffect, useState, useContext, useRef } from "react";

import { Box, Typography, Button, Container, Fab, Collapse, Alert, IconButton } from "@mui/material";
import { Add as AddIcon, Close as CloseIcon } from "@mui/icons-material";

import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

import { AuthContext } from "../context/AuthContext";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import HackathonForm from "../components/hackathons/HackathonForm";
import HackathonList from "../components/hackathons/HackathonList";
import ConfirmDialog from "../components/common/ConfirmDialog";

import {
    getAllHackathons,
    createHackathon,
    updateHackathon,
    deleteHackathon,
    getHackathonById,
} from "../api/hackathons";

const HackathonPage = () => {
    const { t } = useTranslation();
    const { token, user } = useContext(AuthContext);

    const [hackathons, setHackathons] = useState([]);
    const [editingHackathon, setEditingHackathon] = useState(null);
    const [showForm, setShowForm] = useState(false);

    const [selectedHackathon, setSelectedHackathon] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const formRef = useRef(null);

    const fetchHackathons = async () => {
        try {
            const res = await getAllHackathons(token);
            setHackathons(res.hackathons);
        } catch (err) {
            console.error(err);
            toast.error(t("hackathon.fetch_failed"));
        }
    };

    useEffect(() => {
        if (!token) return;
        fetchHackathons();
    }, [token]);

    // Listen for real-time hackathon updates via WebSocket
    useEffect(() => {
        const handleHackathonUpdate = (event) => {
            const { eventType, hackathon } = event.detail;
            if (eventType === "created") {
                setHackathons((prev) => [hackathon, ...prev]);
                toast.success(`New hackathon: ${hackathon.title}`);
            }
            if (eventType === "updated") {
                setHackathons((prev) =>
                    prev.map((h) => (h._id === hackathon._id ? hackathon : h))
                );
                if (editingHackathon && editingHackathon._id === hackathon._id) {
                    setEditingHackathon(hackathon);
                }
            }
            if (eventType === "deleted") {
                setHackathons((prev) => prev.filter((h) => h._id !== hackathon._id));
                if (editingHackathon && editingHackathon._id === hackathon._id) {
                    setEditingHackathon(null);
                    setShowForm(false);
                }
            }
        };
        window.addEventListener("hackathon-update", handleHackathonUpdate);
        return () => window.removeEventListener("hackathon-update", handleHackathonUpdate);
    }, [editingHackathon]);


    const handleCreate = async (data) => {
        try {
            await createHackathon(data, token);
            toast.success(t("hackathon.created"));
            fetchHackathons();
            setEditingHackathon(null);
            setShowForm(false);
        } catch (err) {
            console.error(err);
            toast.error(t("hackathon.create_failed"));
        }
    };

    const handleUpdate = async (data) => {
        if (!editingHackathon) return;
        try {
            await updateHackathon(editingHackathon._id, data, token);
            toast.success(t("hackathon.updated"));
            fetchHackathons();
            setEditingHackathon(null);
            setShowForm(false);
        } catch (err) {
            console.error(err);
            toast.error(t("hackathon.update_failed"));
        }
    };

    const handleDeleteClick = async (hackathon) => {
        try {
            const res = await getHackathonById(hackathon, token);
            setSelectedHackathon(res.hackathon || hackathon);
            setDeleteDialogOpen(true);
        } catch (err) {
            console.error(err);
            toast.error(t("hackathon.delete_failed"));
        }
    };

    const handleConfirmDelete = async () => {
        if (!selectedHackathon) return;
        try {
            await deleteHackathon(selectedHackathon._id, token);
            toast.success(t("hackathon.deleted"));
            fetchHackathons();
        } catch (err) {
            console.error(err);
            toast.error(t("hackathon.delete_failed"));
        } finally {
            setDeleteDialogOpen(false);
            setSelectedHackathon(null);
        }
    };

    const handleCancelDelete = () => {
        setDeleteDialogOpen(false);
        setSelectedHackathon(null);
    };

    const handleEdit = (hackathon) => {
        setEditingHackathon(hackathon);
        setShowForm(true);
        // Scroll to form after a brief delay to ensure it's rendered
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    };

    const handleCancelEdit = () => {
        setEditingHackathon(null);
        setShowForm(false);
    };

    const handleCreateNew = () => {
        setEditingHackathon(null);
        setShowForm(true);
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    };

    const canCreateHackathon = user && (user.role === "admin" || user.role === "hackathon_creator");

    return (
        <DashboardLayout>
            <Container maxWidth="xl">
                {/* Header Section */}
                <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="h4" fontWeight={600} color="primary">
                        {t("hackathon.hackathons")}
                    </Typography>
                    {canCreateHackathon && !showForm && (
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={handleCreateNew}
                            size="large"
                            sx={{ borderRadius: 2 }}
                        >
                            {t("hackathon.create_hackathon")}
                        </Button>
                    )}
                </Box>

                {/* Form Section with Alert */}
                {canCreateHackathon && showForm && (
                    <Box ref={formRef} sx={{ mb: 4 }}>
                        <Collapse in={showForm}>
                            <Alert
                                severity={editingHackathon ? "info" : "success"}
                                action={
                                    <IconButton
                                        aria-label="close"
                                        color="inherit"
                                        size="small"
                                        onClick={handleCancelEdit}
                                    >
                                        <CloseIcon fontSize="inherit" />
                                    </IconButton>
                                }
                                sx={{ mb: 2 }}
                            >
                                {editingHackathon
                                    ? t("hackathon.editing_mode") || `Editing: ${editingHackathon.title}`
                                    : t("hackathon.creating_mode") || "Creating a new hackathon"}
                            </Alert>
                            <HackathonForm
                                initialData={editingHackathon}
                                onSubmit={editingHackathon ? handleUpdate : handleCreate}
                                onCancel={handleCancelEdit}
                            />
                        </Collapse>
                    </Box>
                )}

                {/* Hackathons List */}
                <Box>
                    <HackathonList
                        hackathons={hackathons}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClick}
                    />
                </Box>

                {/* Floating Action Button - Shows when form is hidden */}
                {canCreateHackathon && !showForm && hackathons.length > 0 && (
                    <Fab
                        color="primary"
                        aria-label="add"
                        onClick={handleCreateNew}
                        sx={{
                            position: "fixed",
                            bottom: 32,
                            right: 32,
                        }}
                    >
                        <AddIcon />
                    </Fab>
                )}

                <ConfirmDialog
                    open={deleteDialogOpen}
                    title={t("hackathon.confirm_delete_title")}
                    message={t("hackathon.confirm_delete_message", {
                        name: selectedHackathon?.title || "",
                    })}
                    confirmText={t("common.delete")}
                    cancelText={t("common.cancel")}
                    confirmColor="error"
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                />
            </Container>
        </DashboardLayout>
    );
};

export default HackathonPage;
