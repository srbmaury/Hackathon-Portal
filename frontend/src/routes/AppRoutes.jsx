import { useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import { AuthContext } from "../context/AuthContext";
import IdeaSubmissionPage from "../pages/IdeaSubmissionPage";
import PublicIdeasPage from "../pages/PublicIdeasPage";
import AnnouncementsPage from "../pages/AnnouncementsPage";
import SettingsPage from "../pages/SettingsPage";
import AdminMembersPage from "../pages/AdminMembersPage";
import HackathonPage from "../pages/HackathonPage";
import HackathonDetailsPage from "../pages/HackathonDetailsPage";
import RoundDetailsPage from "../pages/RoundDetailsPage";
import MyTeamsPage from "../pages/MyTeamsPage";
import ChatPage from "../pages/ChatPage";
import ProfilePage from "../pages/ProfilePage";

const AppRoutes = () => {
    const { user } = useContext(AuthContext);

    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/"
                    element={
                        user ? <Navigate to="/hackathons" /> : <LoginPage />
                    }
                />
                <Route
                    path="/hackathons"
                    element={
                        user ? <HackathonPage /> : <Navigate to="/" />
                    }
                />
                <Route
                    path="/hackathons/:id"
                    element={
                        user ? <HackathonDetailsPage /> : <Navigate to="/" />
                    }
                />
                <Route
                    path="/hackathons/:hackathonId/rounds/:roundId"
                    element={
                        user ? <RoundDetailsPage /> : <Navigate to="/" />
                    }
                />
                <Route
                    path="/announcements"
                    element={user ? <AnnouncementsPage /> : <Navigate to="/" />}
                />
                <Route
                    path="/ideas"
                    element={
                        user ? <IdeaSubmissionPage /> : <Navigate to="/" />
                    }
                />
                <Route
                    path="/public-ideas"
                    element={
                        user ? <PublicIdeasPage /> : <Navigate to="/" />
                    }
                />
                <Route
                    path="/settings"
                    element={
                        user ? <SettingsPage /> : <Navigate to="/" />
                    }
                />
                <Route
                    path="/profile"
                    element={
                        user ? <ProfilePage /> : <Navigate to="/" />
                    }
                />
                <Route
                    path="/my-teams"
                    element={
                        user ? <MyTeamsPage /> : <Navigate to="/" />
                    }
                />
                <Route
                    path="/teams/:teamId/chat"
                    element={
                        user ? <ChatPage /> : <Navigate to="/" />
                    }
                />
                <Route
                    path="/admin/members"
                    element={
                        user?.role === "admin" ? <AdminMembersPage /> : <Navigate to="/" />
                    }
                />
            </Routes>
        </BrowserRouter>
    );
};

export default AppRoutes;
