import React, { useState, useEffect, useContext } from "react";

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Stack,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    Alert,
    Typography,
    Box,
} from "@mui/material";

import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

import { AuthContext } from "../../context/AuthContext";

import {
    registerForHackathon,
    updateTeam,
    getHackathonTeams,
} from "../../api/registrations";
import { getPublicIdeas, getUserIdeas } from "../../api/ideas";
import { getUsers } from "../../api/users";
import { getHackathonMembers } from "../../api/hackathons";

import MemberSearchPicker from "./MemberSearchPicker";

const HackathonRegisterModal = ({ open, onClose, hackathon, team }) => {
    const { t } = useTranslation();
    const { token, user } = useContext(AuthContext);

    const [formData, setFormData] = useState({
        name: "",
        idea: "",
        members: [],
    });

    const [ideas, setIdeas] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!hackathon || !open) return;

        const fetchData = async () => {
            try {
                // Extract hackathon ID
                let hackathonId = "";
                if (hackathon) {
                    if (typeof hackathon === "string") {
                        hackathonId = hackathon;
                    } else if (hackathon._id) {
                        hackathonId = hackathon._id;
                    } else if (hackathon.id) {
                        hackathonId = hackathon.id;
                    }
                }

                // When editing, fetch user ideas to include the team's current idea
                // When creating, use public ideas
                const ideasPromise = team
                    ? getUserIdeas(token)
                    : getPublicIdeas(token);

                // Fetch all data in parallel
                const [ideasRes, usersRes, teamsRes, membersRes] =
                    await Promise.all([
                        ideasPromise,
                        getUsers(token),
                        hackathonId
                            ? getHackathonTeams(hackathonId, token).catch(
                                () => ({ teams: [] })
                            )
                            : Promise.resolve({ teams: [] }),
                        hackathonId
                            ? getHackathonMembers(hackathonId, token).catch(
                                () => ({ members: [], membersByRole: {} })
                            )
                            : Promise.resolve({
                                members: [],
                                membersByRole: {},
                            }),
                    ]);

                // Extract ideas array from response
                const ideasArray = ideasRes?.ideas || ideasRes || [];
                setIdeas(ideasArray);

                const allUsers = usersRes?.groupedUsers
                    ? Object.values(usersRes.groupedUsers).flat()
                    : usersRes?.users || usersRes || [];

                // Filter out users who already have a role in this hackathon
                const hackathonRoleUserIds = new Set((membersRes.members || []).map(m => m.user?._id || m.user));
                let selectableUsers = allUsers.filter(u => !hackathonRoleUserIds.has(u._id));
                // Always include current team members in selectableUsers when editing
                if (team && Array.isArray(team.members)) {
                    team.members.forEach(m => {
                        const memberId = typeof m === "object" ? m._id : m;
                        if (memberId && !selectableUsers.some(u => u._id === memberId)) {
                            let memberObj = typeof m === "object" ? m : null;
                            selectableUsers.push({
                                _id: memberId,
                                name: memberObj?.name || "(Current Member)",
                                email: memberObj?.email || "",
                            });
                        }
                    });
                    // Sort selectableUsers so selected members appear first
                    const memberIds = team.members.map(m => typeof m === "object" ? m._id : m);
                    selectableUsers.sort((a, b) => {
                        const aSelected = memberIds.includes(a._id);
                        const bSelected = memberIds.includes(b._id);
                        if (aSelected && !bSelected) return -1;
                        if (!aSelected && bSelected) return 1;
                        return 0;
                    });
                }
                setUsers(selectableUsers);
                console.log(membersRes);

                console.log(allUsers);

                console.log("Fetched users:", selectableUsers);

                // If editing and we have a team with an idea, ensure the idea is in the list
                if (team && team.idea) {
                    const currentIdeaId =
                        typeof team.idea === "string"
                            ? team.idea
                            : team.idea._id || team.idea.id;
                    const ideaExists = ideasArray.some(
                        (idea) => String(idea._id) === String(currentIdeaId)
                    );
                    if (!ideaExists && currentIdeaId) {
                        ideasArray.push({
                            _id: currentIdeaId,
                            title: team.idea.title || "(Current Idea)",
                            description: team.idea.description || "",
                        });
                    }
                    setIdeas([...ideasArray]);
                }

                // ensure the current user is included in members by default and cannot be removed
                if (user && user._id && !team) {
                    // Only add current user to members when creating new team, not when editing
                    setFormData((prev) => ({
                        ...prev,
                        members: Array.from(
                            new Set([...(prev.members || []), user._id])
                        ),
                    }));
                }
            } catch (error) {
                console.error("Error fetching data:", error);
                toast.error(
                    t("hackathon.details_fetch_failed") ||
                    "Failed to fetch data!"
                );
            }
        };

        fetchData();
    }, [hackathon, open, token, user, t, team]);

    // If editing an existing team, prefill formData when modal opens
    useEffect(() => {
        if (!open) return;
        if (team) {
            console.log(
                "Editing team - full team object:",
                JSON.stringify(team, null, 2)
            );

            // Extract team name
            const teamName = team.name || "";

            // Extract idea ID - handle both populated object and ID string
            let ideaId = "";
            if (team.idea) {
                if (typeof team.idea === "string") {
                    ideaId = team.idea;
                } else if (team.idea._id) {
                    ideaId = team.idea._id;
                } else if (team.idea.id) {
                    ideaId = team.idea.id;
                }
            }

            // Extract member IDs - handle both populated objects and ID strings
            const memberIds = (team.members || [])
                .map((m) => {
                    if (typeof m === "string") {
                        return m;
                    } else if (m && typeof m === "object") {
                        return m._id || m.id || m;
                    }
                    return m;
                })
                .filter(Boolean);

            console.log("Extracted form data:", {
                name: teamName,
                idea: ideaId,
                members: memberIds,
            });

            setFormData({
                name: teamName,
                idea: ideaId,
                members: memberIds,
            });
        } else {
            // reset when creating new
            setFormData({
                name: "",
                idea: "",
                members: user && user._id ? [user._id] : [],
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, team]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Helper to get team size constraints
    const getTeamSizeConstraints = () => {
        if (!hackathon || typeof hackathon === "string") {
            return { min: 1, max: 5 }; // defaults
        }
        return {
            min: hackathon.mnimumTeamSize || hackathon.minimumTeamSize || 1,
            max: hackathon.maximumTeamSize || 5,
        };
    };

    // Get current team size
    const getCurrentTeamSize = () => {
        return formData.members ? formData.members.length : 0;
    };

    // Check if team size is valid
    const isTeamSizeValid = () => {
        const size = getCurrentTeamSize();
        const constraints = getTeamSizeConstraints();
        return size >= constraints.min && size <= constraints.max;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Validate team size
            const constraints = getTeamSizeConstraints();
            const currentSize = getCurrentTeamSize();

            if (currentSize < constraints.min) {
                toast.error(
                    t("hackathon.team_size_too_small", {
                        min: constraints.min,
                        current: currentSize,
                    }) ||
                    `Team must have at least ${constraints.min} member(s). Currently: ${currentSize}`
                );
                setLoading(false);
                return;
            }

            if (currentSize > constraints.max) {
                toast.error(
                    t("hackathon.team_size_too_large", {
                        max: constraints.max,
                        current: currentSize,
                    }) ||
                    `Team cannot have more than ${constraints.max} member(s). Currently: ${currentSize}`
                );
                setLoading(false);
                return;
            }

            const payload = {
                teamName: formData.name,
                ideaId: formData.idea,
                memberIds: formData.members,
            };

            // Extract hackathon ID - handle both populated object and ID string
            let hackathonId = "";
            if (hackathon) {
                if (typeof hackathon === "string") {
                    hackathonId = hackathon;
                } else if (hackathon._id) {
                    hackathonId = hackathon._id;
                } else if (hackathon.id) {
                    hackathonId = hackathon.id;
                }
            }

            if (!hackathonId) {
                toast.error(
                    t("hackathon.register_failed") || "Invalid hackathon data"
                );
                setLoading(false);
                return;
            }

            if (team && team._id) {
                // Update existing team
                console.log(
                    "Updating team:",
                    team._id,
                    "with payload:",
                    payload
                );
                await updateTeam(hackathonId, team._id, payload, token);
                toast.success(
                    t("hackathon.update_success") || "Updated successfully!"
                );
            } else {
                console.log("Registering new team with payload:", payload);
                await registerForHackathon(hackathonId, payload, token);
                toast.success(
                    t("hackathon.register_success") ||
                    "Registered successfully!"
                );
            }
            onClose();
        } catch (error) {
            console.error("Registration/Update error:", error);
            toast.error(
                t("hackathon.register_failed") || "Registration failed!"
            );
        } finally {
            setLoading(false);
        }
    };

    // Helper to get hackathon title
    const getHackathonTitle = () => {
        if (!hackathon) return "";
        if (typeof hackathon === "string") return "";
        return hackathon.title || hackathon.name || "";
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                {team
                    ? t("hackathon.edit_team") || "Edit Team"
                    : t("hackathon.register_for") || "Register for Hackathon"}
                {getHackathonTitle() && ` - ${getHackathonTitle()}`}
            </DialogTitle>

            <DialogContent>
                <Stack spacing={2} mt={1}>
                    {/* Team Name */}
                    <TextField
                        label={t("hackathon.team_name") || "Team Name"}
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        fullWidth
                    />

                    {/* Idea Selection */}
                    <FormControl fullWidth required>
                        <InputLabel>
                            {t("hackathon.idea") || "Select Idea"}
                        </InputLabel>
                        <Select
                            name="idea"
                            value={formData.idea}
                            onChange={handleChange}
                            label={t("hackathon.idea") || "Select Idea"}
                        >
                            {ideas.map((idea) => (
                                <MenuItem key={idea._id} value={idea._id}>
                                    {idea.title}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Team Size Information */}
                    {(() => {
                        const constraints = getTeamSizeConstraints();
                        const currentSize = getCurrentTeamSize();
                        const isValid = isTeamSizeValid();
                        const isMaxReached = currentSize >= constraints.max;
                        return (
                            <Box
                                sx={{
                                    p: 2,
                                    bgcolor: isMaxReached
                                        ? "warning.light"
                                        : isValid
                                            ? "success.light"
                                            : "error.light",
                                    borderRadius: 1,
                                    border: `1px solid ${isMaxReached
                                        ? "warning.main"
                                        : isValid
                                            ? "success.main"
                                            : "error.main"
                                        }`,
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    fontWeight={600}
                                    gutterBottom
                                >
                                    {t("hackathon.team_size_requirement", {
                                        min: constraints.min,
                                        max: constraints.max,
                                    }) ||
                                        `Team Size Requirement: ${constraints.min} - ${constraints.max} members`}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color={
                                        isValid ? "success.dark" : "error.dark"
                                    }
                                    fontWeight={500}
                                >
                                    {t("hackathon.current_team_size", {
                                        current: currentSize,
                                        min: constraints.min,
                                        max: constraints.max,
                                    }) ||
                                        `Current: ${currentSize} member(s) of ${constraints.max} maximum`}
                                </Typography>
                                {isMaxReached && (
                                    <Alert severity="info" sx={{ mt: 1 }}>
                                        {t("hackathon.max_team_size_reached", {
                                            max: constraints.max,
                                        }) ||
                                            `Maximum team size (${constraints.max}) reached. You cannot add more members.`}
                                    </Alert>
                                )}
                                {!isValid && !isMaxReached && (
                                    <Alert severity="warning" sx={{ mt: 1 }}>
                                        {currentSize < constraints.min
                                            ? t(
                                                "hackathon.team_size_too_small_alert",
                                                {
                                                    min: constraints.min,
                                                    current: currentSize,
                                                }
                                            ) ||
                                            `Team must have at least ${constraints.min} member(s). Currently: ${currentSize}`
                                            : t(
                                                "hackathon.team_size_too_large_alert",
                                                {
                                                    max: constraints.max,
                                                    current: currentSize,
                                                }
                                            ) ||
                                            `Team cannot have more than ${constraints.max} member(s). Currently: ${currentSize}`}
                                    </Alert>
                                )}
                            </Box>
                        );
                    })()}

                    {/* Members Search Picker */}
                    <MemberSearchPicker
                        users={users}
                        selectedIds={formData.members}
                        onChange={(ids) =>
                            setFormData((prev) => ({ ...prev, members: ids }))
                        }
                        maxTeamSize={getTeamSizeConstraints().max}
                    />
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} color="secondary">
                    {t("common.cancel") || "Cancel"}
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={
                        loading ||
                        !isTeamSizeValid() ||
                        !formData.name ||
                        !formData.idea
                    }
                >
                    {loading
                        ? team
                            ? t("common.updating") || "Updating..."
                            : t("common.loading") || "Registering..."
                        : team
                            ? t("hackathon.update") || "Update"
                            : t("hackathon.register") || "Register"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default HackathonRegisterModal;
