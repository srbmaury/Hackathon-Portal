import React, { useState, useEffect } from "react";

import {
    Container,
    Divider,
    Paper,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";

import { useTranslation } from "react-i18next";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import IdeaForm from "../components/ideas/IdeaForm";
import IdeasTable from "../components/ideas/IdeasTable";

import { getUserIdeas } from "../api/ideas";

const IdeaSubmissionPage = () => {
    const { t } = useTranslation();
    const [myIdeas, setMyIdeas] = useState([]);
    const [filter, setFilter] = useState("all");
    const token = localStorage.getItem("token");

    const fetchMyIdeas = async () => {
        try {
            const ideas = await getUserIdeas(token);
            setMyIdeas(Array.isArray(ideas) ? ideas : []);
        } catch (err) {
            console.error("Error fetching my ideas:", err);
            setMyIdeas([]);
        }
    };

    useEffect(() => {
        fetchMyIdeas();
    }, []);

    return (
        <DashboardLayout>
            <Container
                maxWidth="lg"
                sx={{
                    mt: 3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                }}
            >
                {/* Submit Idea Form */}
                <IdeaForm token={token} onIdeaSubmitted={fetchMyIdeas} />

                {/* My Ideas Section */}
                <Paper
                    elevation={2}
                    sx={{
                        p: 3,
                        borderRadius: 3,
                    }}
                >
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mb: 2 }}
                    >
                        <Typography variant="h6" fontWeight={600}>
                            {t("idea.my_submitted_ideas")}
                        </Typography>
                        <ToggleButtonGroup
                            value={filter}
                            exclusive
                            onChange={(e, newFilter) =>
                                newFilter && setFilter(newFilter)
                            }
                            size="small"
                        >
                            <ToggleButton value="all">{t("idea.all")}</ToggleButton>
                            <ToggleButton value="public">{t("idea.public")}</ToggleButton>
                            <ToggleButton value="private">{t("idea.private")}</ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>

                    <Divider sx={{ mb: 2 }} />

                    <IdeasTable
                        ideas={myIdeas}
                        filter={filter}
                        onIdeaUpdated={fetchMyIdeas}
                        showActions={true}
                    />
                </Paper>
            </Container>
        </DashboardLayout>
    );
};

export default IdeaSubmissionPage;
