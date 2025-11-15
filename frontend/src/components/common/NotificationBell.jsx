import React, { useState } from "react";
import {
    IconButton,
    Badge,
    Popover,
    Typography,
    Box,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton as MuiIconButton,
    Button,
    Divider,
    Stack,
    Chip,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNotifications } from "../../context/NotificationContext";
import { SettingsContext } from "../../context/SettingsContext";
import { useTranslation } from "react-i18next";
import { useContext } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const NotificationBell = () => {
    const { notificationsEnabled } = useContext(SettingsContext);
    const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } =
        useNotifications();
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = useState(null);

    // Show notification bell even if notifications are disabled (user can still see existing notifications)
    // The backend will respect the notificationsEnabled setting when creating new notifications

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? "notification-popover" : undefined;

    const getNotificationIcon = (type) => {
        switch (type) {
            case "new_hackathon":
                return "🎯";
            case "hackathon_update":
                return "📝";
            case "hackathon_deadline":
                return "⏰";
            case "team_message":
                return "💬";
            case "round_deadline":
                return "📅";
            case "announcement":
                return "📢";
            default:
                return "🔔";
        }
    };

    return (
        <>
            <IconButton
                color="inherit"
                onClick={handleClick}
                aria-describedby={id}
                sx={{ position: "relative" }}
                title={`${unreadCount} unread notifications`}
            >
                <Badge badgeContent={unreadCount} color="error">
                    <NotificationsIcon />
                </Badge>
            </IconButton>
            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                PaperProps={{
                    sx: {
                        width: 400,
                        maxHeight: 600,
                        mt: 1,
                    },
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        mb={1}
                    >
                        <Typography variant="h6" fontWeight={600}>
                            {t("notifications.title") || "Notifications"}
                        </Typography>
                        {unreadCount > 0 && (
                            <Button
                                size="small"
                                startIcon={<CheckCircleIcon />}
                                onClick={markAllAsRead}
                            >
                                {t("notifications.mark_all_read") || "Mark all read"}
                            </Button>
                        )}
                    </Stack>
                    <Divider sx={{ mb: 1 }} />
                    {notifications.length === 0 ? (
                        <Box sx={{ textAlign: "center", py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                                {t("notifications.no_notifications") || "No notifications"}
                            </Typography>
                        </Box>
                    ) : (
                        <List sx={{ maxHeight: 500, overflow: "auto" }}>
                            {notifications.map((notification) => (
                                <ListItem
                                    key={notification._id}
                                    sx={{
                                        bgcolor: notification.read
                                            ? "transparent"
                                            : "action.hover",
                                        borderRadius: 1,
                                        mb: 0.5,
                                    }}
                                >
                                    <Box sx={{ mr: 1, fontSize: "1.5rem" }}>
                                        {getNotificationIcon(notification.type)}
                                    </Box>
                                    <ListItemText
                                        primary={
                                            <Typography
                                                variant="body2"
                                                fontWeight={notification.read ? 400 : 600}
                                            >
                                                {notification.title}
                                            </Typography>
                                        }
                                        secondary={
                                            <Box>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    display="block"
                                                >
                                                    {notification.message}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    {dayjs(notification.createdAt).fromNow()}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                    <ListItemSecondaryAction>
                                        <Stack direction="row" spacing={0.5}>
                                            {!notification.read && (
                                                <MuiIconButton
                                                    edge="end"
                                                    size="small"
                                                    onClick={() => markAsRead(notification._id)}
                                                >
                                                    <CheckCircleIcon fontSize="small" />
                                                </MuiIconButton>
                                            )}
                                            <MuiIconButton
                                                edge="end"
                                                size="small"
                                                onClick={() =>
                                                    removeNotification(notification._id)
                                                }
                                            >
                                                <CloseIcon fontSize="small" />
                                            </MuiIconButton>
                                        </Stack>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            </Popover>
        </>
    );
};

export default NotificationBell;

