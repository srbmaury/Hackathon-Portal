const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Organization = require("../models/Organization");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthController {
    async googleLogin(req, res) {
        var adminEmail = "srbmaury@";

        try {
            const { token } = req.body;

            // Verify Google token
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            const { sub: googleId, email, name } = payload;

            // Extract email domain
            const domain = email.split("@")[1];
            let organization = await Organization.findOne({ domain });

            // Handle org creation and onboarding rules
            if (!organization) {
                if (!email.startsWith(adminEmail)) {
                    return res.status(403).json({
                        message: req.__("auth.organization_not_onboarded"),
                    });
                }

                // Create org automatically for admin
                organization = await Organization.create({
                    name: domain.split(".")[0].toUpperCase(),
                    domain,
                });
            }

            // Check if user exists
            let user = await User.findOne({ googleId });

            if (!user) {
                // Determine role
                const isAdmin =
                    email.startsWith(adminEmail) && !organization.admin;
                const role = isAdmin ? "admin" : "user";

                user = await User.create({
                    name,
                    email,
                    googleId,
                    organization: organization._id,
                    role,
                });

                if (isAdmin) organization.admin = user._id;
                await organization.save();
            }

            // Generate JWT
            const jwtToken = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d",
                }
            );

            res.json({
                user,
                token: jwtToken,
                message: req.__("auth.login_success"),
            });
        } catch (err) {
            console.error("Google Login Error:", err);
            res.status(400).json({ message: req.__("auth.google_login_failed") });
        }
    }
}

module.exports = new AuthController();
