const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "hackathon-submissions",
        allowed_formats: ["jpg", "jpeg", "png", "pdf", "doc", "docx", "ppt", "pptx", "zip", "rar"],
        resource_type: "auto",
    },
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept all file types (Cloudinary will handle validation)
        cb(null, true);
    },
});

module.exports = upload;

