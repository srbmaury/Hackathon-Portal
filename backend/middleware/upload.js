const multer = require("multer");
const cloudinary = require("../config/cloudinary");

// Custom Multer storage engine for Cloudinary v2
class CloudinaryStorage {
    constructor(options) {
        this.options = options || {};
    }

    _handleFile(req, file, cb) {
        const chunks = [];
        
        file.stream.on("data", (chunk) => {
            chunks.push(chunk);
        });

        file.stream.on("end", () => {
            const buffer = Buffer.concat(chunks);
            
            // Create upload options
            const uploadOptions = {
                folder: this.options.params?.folder || "hackathon-submissions",
                resource_type: this.options.params?.resource_type || "auto",
            };

            // Only add allowed_formats if specified (video uploads should not have this restriction)
            if (this.options.params?.allowed_formats) {
                uploadOptions.allowed_formats = this.options.params.allowed_formats;
            }

            // Upload to Cloudinary using upload_stream
            const uploadStream = cloudinary.uploader.upload_stream(
                uploadOptions,
                (error, result) => {
                    if (error) {
                        return cb(error);
                    }
                    
                    // Set file properties similar to multer-storage-cloudinary
                    file.path = result.secure_url;
                    file.filename = result.public_id;
                    file.cloudinary = result;
                    
                    cb(null, {
                        path: result.secure_url,
                        filename: result.public_id,
                        cloudinary: result,
                    });
                }
            );

            // Write buffer to upload stream
            uploadStream.end(buffer);
        });

        file.stream.on("error", (error) => {
            cb(error);
        });
    }

    _removeFile(req, file, cb) {
        // Optionally delete from Cloudinary if needed
        // For now, we'll just call the callback
        cb(null);
    }
}

// Configure Cloudinary storage for document uploads
const storage = new CloudinaryStorage({
    params: {
        folder: "hackathon-submissions",
        allowed_formats: ["jpg", "jpeg", "png", "pdf", "doc", "docx", "ppt", "pptx", "zip", "rar"],
        resource_type: "auto",
    },
});

// Configure Cloudinary storage for video uploads (demo recordings)
const videoStorage = new CloudinaryStorage({
    params: {
        folder: "demo-recordings",
        resource_type: "video",
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

// Video upload with larger size limit
const videoUpload = multer({
    storage: videoStorage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit for videos
    },
    fileFilter: (req, file, cb) => {
        // Accept video file types - use startsWith to handle codec suffixes like video/webm;codecs=vp9
        const mimeType = file.mimetype?.toLowerCase() || '';
        const isVideo = mimeType.startsWith('video/') || 
                        mimeType.startsWith('application/octet-stream'); // Some browsers send this
        
        if (isVideo) {
            cb(null, true);
        } else {
            console.log("Rejected video upload with mimetype:", file.mimetype);
            cb(new Error(`Invalid video format: ${file.mimetype}. Expected video/*`), false);
        }
    },
});

module.exports = upload;
module.exports.videoUpload = videoUpload;

