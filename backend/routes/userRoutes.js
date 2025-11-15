const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { protect } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");

router.get("/", protect, userController.getAll);
router.get("/me", protect, (req, res) => userController.getMe(req, res));
router.put("/me", protect, (req, res) => userController.updateMe(req, res));
router.get("/with-roles", protect, roleCheck("admin"), (req, res) => userController.getAllWithHackathonRoles(req, res));
router.put("/:id/role", protect, roleCheck("organizer", "admin"), (req, res) => userController.updateRole(req, res));

module.exports = router;
