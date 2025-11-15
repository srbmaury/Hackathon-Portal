import React, { useContext } from "react";
import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
    AppBar,
    IconButton,
    Divider,
} from "@mui/material";
import {
    Home as HomeIcon,
    Lightbulb as LightbulbIcon,
    Group as GroupIcon,
    EventNote as EventNoteIcon,
    Logout as LogoutIcon,
    Menu as MenuIcon,
    Settings as SettingsIcon,
    LightbulbOutline as LightbulbOutlineIcon,
    Person,
} from "@mui/icons-material";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const drawerWidth = 240;

const DashboardLayout = ({ children }) => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [mobileOpen, setMobileOpen] = React.useState(false);

    const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

    // Define menu items with role access
    const menuItems = [
        {
            text: t("dashboard.hackathons"),
            icon: <EventNoteIcon />,
            path: "/hackathons",
            roles: ["user", "hackathon_creator", "admin"],
        },
        {
            text: t("dashboard.submit_idea"),
            icon: <LightbulbIcon />,
            path: "/ideas",
            roles: ["user", "hackathon_creator", "admin"],
        },
        {
            text: t("dashboard.public_ideas"),
            icon: <LightbulbOutlineIcon />,
            path: "/public-ideas",
            roles: ["user", "hackathon_creator", "admin"],
        },
        {
            text: t("dashboard.my_teams"),
            icon: <GroupIcon />,
            path: "/my-teams",
            roles: ["user", "hackathon_creator", "admin"],
        },
        {
            text: t("dashboard.all_members"),
            icon: <Person />,
            path: "/admin/members",
            roles: ["admin"],
        },
        {
            text: t("dashboard.settings"),
            icon: <SettingsIcon />,
            path: "/settings",
            roles: ["user", "hackathon_creator", "admin"],
        },
        {
            text: t("dashboard.logout"),
            icon: <LogoutIcon />,
            action: logout,
            roles: ["user", "hackathon_creator", "admin"],
        },
    ];

    // Filter menu items based on user role
    const filteredItems = menuItems.filter((item) => item.roles.includes(user.role));

    const drawer = (
        <div>
            <Toolbar>
                <Typography variant="h6" noWrap>
                    {t("dashboard.app_title")}
                </Typography>
            </Toolbar>
            <Divider />
            <List>
                {filteredItems.map((item, index) => (
                    <ListItem
                        button
                        key={index}
                        onClick={item.path ? () => navigate(item.path) : item.action}
                    >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.text} />
                    </ListItem>
                ))}
            </List>
        </div>
    );

    return (
        <Box sx={{ display: "flex" }}>
            {/* AppBar */}
            <AppBar
                position="fixed"
                sx={{
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    ml: { sm: `${drawerWidth}px` },
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { sm: "none" } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div">
                        {t("dashboard.welcome", { name: user.name })}
                    </Typography>
                </Toolbar>
            </AppBar>

            {/* Drawer */}
            <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: "block", sm: "none" },
                        "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
                    }}
                >
                    {drawer}
                </Drawer>

                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: "none", sm: "block" },
                        "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            {/* Main Content */}
            <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
                <Toolbar /> {/* Space for AppBar */}
                {children}
            </Box>
        </Box>
    );
};

export default DashboardLayout;
