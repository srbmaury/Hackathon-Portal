import React, { useContext } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { googleLogin } from "../../api/auth"; // updated import
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

const GoogleLoginButton = () => {
    const { login } = useContext(AuthContext);
    const { t } = useTranslation();

    const handleSuccess = async (credentialResponse) => {
        try {
            const data = await googleLogin(credentialResponse.credential);
            await login(data.user, data.token);
            toast.success(t("auth.login_success"));
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.message || t("auth.google_login_failed"));
        }
    };

    return (
        <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => toast.error(t("auth.google_login_failed"))}
        />
    );
};

export default GoogleLoginButton;
