const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: req.__("auth.no_token") });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).populate("organization");

        if (!user) {
            return res.status(404).json({ message: req.__("auth.user_not_found") });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ message: req.__("auth.invalid_token") });
    }
};
