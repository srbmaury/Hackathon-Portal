import React, { useState, useEffect } from "react";
import {
    Box,
    Paper,
    Typography,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Collapse,
    IconButton,
    Alert,
    Chip,
    Divider,
    CircularProgress,
} from "@mui/material";
import {
    BugReport as BugReportIcon,
    ExpandMore as ExpandMoreIcon,
    Login as LoginIcon,
} from "@mui/icons-material";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";

const TestLoginPanel = () => {
    const [expanded, setExpanded] = useState(false);
    const [testUsers, setTestUsers] = useState({});
    const [selectedUser, setSelectedUser] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { login } = useAuth();

    // Only show in development mode - check multiple ways to be sure
    // Set VITE_ENABLE_TEST_MODE=false in .env to disable completely
    const isDevelopment = 
        import.meta.env.VITE_NODE_ENV !== "production" &&
        import.meta.env.VITE_ENABLE_TEST_MODE !== "false" && 
        import.meta.env.VITE_ENABLE_TEST_MODE !== false &&
        import.meta.env.MODE !== "production";

    useEffect(() => {
        if (expanded && isDevelopment) {
            fetchTestUsers();
        }
    }, [expanded, isDevelopment]);

    const fetchTestUsers = async () => {
        try {
            setLoading(true);
            const response = await axios.get(
                `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"}/auth/test-users`
            );
            setTestUsers(response.data.users);
            setError("");
        } catch (err) {
            console.error("Failed to fetch test users:", err);
            setError("Failed to load test users");
        } finally {
            setLoading(false);
        }
    };

    const handleTestLogin = async () => {
        if (!selectedUser) {
            setError("Please select a user");
            return;
        }

        try {
            setLoading(true);
            setError("");
            
            const response = await axios.post(
                `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"}/auth/test-login`,
                { userId: selectedUser }
            );

            // Use the login function from AuthContext
            login(response.data.user, response.data.token);
            
        } catch (err) {
            console.error("Test login failed:", err);
            setError(err.response?.data?.message || "Test login failed");
        } finally {
            setLoading(false);
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case "admin":
                return "error";
            case "hackathon_creator":
                return "warning";
            default:
                return "default";
        }
    };

    // Don't render anything in production
    if (!isDevelopment) {
        return null;
    }

    return (
        <Paper
            elevation={3}
            sx={{
                position: "fixed",
                bottom: 20,
                right: 20,
                maxWidth: 400,
                maxHeight: "80vh",
                overflow: "auto",
                zIndex: 10000,
                backgroundColor: "background.paper",
                border: "2px solid",
                borderColor: "warning.main",
            }}
        >
            <Box
                sx={{
                    p: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    backgroundColor: "warning.main",
                    color: "warning.contrastText",
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <BugReportIcon />
                    <Typography variant="subtitle1" fontWeight="bold">
                        Test Mode Login
                    </Typography>
                </Box>
                <IconButton
                    size="small"
                    sx={{
                        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.3s",
                        color: "inherit",
                    }}
                >
                    <ExpandMoreIcon />
                </IconButton>
            </Box>

            <Collapse in={expanded}>
                <Box sx={{ p: 2 }}>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        ⚠️ Test Mode Only - Not available in production
                    </Alert>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {loading && Object.keys(testUsers).length === 0 ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <FormControl fullWidth sx={{ mb: 2 }}>
                                <InputLabel>Select Test User</InputLabel>
                                <Select
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    label="Select Test User"
                                    MenuProps={{
                                        anchorOrigin: {
                                            vertical: 'top',
                                            horizontal: 'left',
                                        },
                                        transformOrigin: {
                                            vertical: 'bottom',
                                            horizontal: 'left',
                                        },
                                        PaperProps: {
                                            style: {
                                                maxHeight: 400,
                                            },
                                        },
                                        style: {
                                            zIndex: 10002, // Much higher z-index to appear above everything
                                        },
                                    }}
                                >
                                    {Object.entries(testUsers).map(([orgName, users]) => [
                                        <MenuItem key={`org-${orgName}`} disabled>
                                            <Typography
                                                variant="subtitle2"
                                                fontWeight="bold"
                                                color="primary"
                                            >
                                                📦 {orgName}
                                            </Typography>
                                        </MenuItem>,
                                        ...users.map((user) => (
                                            <MenuItem key={user.id} value={user.id}>
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        width: "100%",
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 1,
                                                        }}
                                                    >
                                                        <Typography variant="body2">
                                                            {user.name}
                                                        </Typography>
                                                        <Chip
                                                            label={user.role}
                                                            size="small"
                                                            color={getRoleColor(user.role)}
                                                        />
                                                    </Box>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        {user.email}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ fontStyle: "italic" }}
                                                    >
                                                        ID: {user.id}
                                                    </Typography>
                                                </Box>
                                            </MenuItem>
                                        )),
                                        <Divider key={`divider-${orgName}`} />,
                                    ])}
                                </Select>
                            </FormControl>

                            <Button
                                variant="contained"
                                color="warning"
                                fullWidth
                                startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
                                onClick={handleTestLogin}
                                disabled={!selectedUser || loading}
                            >
                                {loading ? "Logging in..." : "Login as Selected User"}
                            </Button>

                            <Box sx={{ mt: 2 }}>
                                <Typography variant="caption" color="text.secondary">
                                    💡 Quick Access:
                                </Typography>
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                                    {Object.entries(testUsers).map(([orgName, users]) =>
                                        users
                                            .filter((u) => u.role !== "user")
                                            .slice(0, 2)
                                            .map((user) => (
                                                <Chip
                                                    key={user.id}
                                                    label={`${user.name.split(" ")[0]} (${user.role})`}
                                                    size="small"
                                                    color={getRoleColor(user.role)}
                                                    onClick={() => {
                                                        setSelectedUser(user.id);
                                                    }}
                                                    sx={{ cursor: "pointer" }}
                                                />
                                            ))
                                    )}
                                </Box>
                            </Box>
                        </>
                    )}
                </Box>
            </Collapse>
        </Paper>
    );
};

export default TestLoginPanel;

