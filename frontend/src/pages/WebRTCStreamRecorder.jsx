import React, { useRef, useState, useEffect, useCallback } from "react";
import { 
    Button, Box, Typography, Stack, Alert, Chip, Dialog, DialogTitle, 
    DialogContent, DialogActions, FormControlLabel, Switch, LinearProgress,
    IconButton, Tooltip, Grid
} from "@mui/material";
import { 
    Videocam, VideocamOff, FiberManualRecord, Stop, 
    ScreenShare, StopScreenShare, Download, CloudUpload, Delete, Timer,
    Fullscreen, Close, Mic, MicOff
} from "@mui/icons-material";
import toast from "react-hot-toast";
import { initializeSocket } from "../services/socket";

const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

const WebRTCStreamRecorder = ({ sessionId, token, myRole, onVideoUploaded, userName = "You" }) => {
    // Refs
    const localVideoRef = useRef();
    const presentationVideoRef = useRef();
    const presentationContainerRef = useRef();
    const previewVideoRef = useRef();
    const remoteVideoRefs = useRef({});
    const peerConnectionsRef = useRef({});
    const socketRef = useRef(null);
    const recordingTimerRef = useRef(null);
    const recordedBlobUrlRef = useRef(null);
    const recordingChunksRef = useRef([]);
    const localCameraStreamRef = useRef(null);
    const localScreenStreamRef = useRef(null);
    const peerInfoRef = useRef({});
    
    // Track who is screen sharing (userId or 'local')
    const screenSharerIdRef = useRef(null);
    // Track camera streams we've received from each peer (to distinguish from screen share)
    const knownCameraStreamsRef = useRef({}); // {oderId: Set of stream IDs}

    // Media recorder ref (not state to avoid timing issues)
    const mediaRecorderRef = useRef(null);
    
    // State
    const [localCameraStream, setLocalCameraStream] = useState(null);
    const [localScreenStream, setLocalScreenStream] = useState(null);
    const [remoteScreenStream, setRemoteScreenStream] = useState(null);
    const [screenSharerInfo, setScreenSharerInfo] = useState(null); // {id, name, isLocal}
    const [remoteCameraStreams, setRemoteCameraStreams] = useState({}); // {oderId: stream}
    const [peerInfo, setPeerInfo] = useState({});
    const [recordedBlob, setRecordedBlob] = useState(null);
    const [recording, setRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [participantsInRoom, setParticipantsInRoom] = useState(0);
    const [error, setError] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [shareRecording, setShareRecording] = useState(true);

    const isOrganizer = myRole === "organizer" || myRole === "judge";
    const canRecord = isOrganizer;

    useEffect(() => { peerInfoRef.current = peerInfo; }, [peerInfo]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Socket & WebRTC setup
    useEffect(() => {
        if (!token || !sessionId) return;

        const socket = initializeSocket(token);
        socketRef.current = socket;
        
        const createPC = (remoteUserId, remoteName) => {
            console.log("Creating PC for:", remoteUserId, remoteName);
            
            if (peerConnectionsRef.current[remoteUserId]) {
                peerConnectionsRef.current[remoteUserId].close();
            }
            
            // Initialize known camera streams set for this peer
            if (!knownCameraStreamsRef.current[remoteUserId]) {
                knownCameraStreamsRef.current[remoteUserId] = new Set();
            }
            
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            peerConnectionsRef.current[remoteUserId] = pc;

            // Add local camera tracks if exists
            if (localCameraStreamRef.current) {
                console.log("Adding camera tracks to PC for", remoteUserId);
                localCameraStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localCameraStreamRef.current);
                });
            }
            
            // Add local screen share tracks if exists
            if (localScreenStreamRef.current) {
                console.log("Adding screen tracks to PC for", remoteUserId);
                localScreenStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localScreenStreamRef.current);
                });
            }

            // Handle incoming tracks - detect screen share by track characteristics
            pc.ontrack = (event) => {
                const stream = event.streams[0];
                if (!stream) {
                    console.warn("No stream in ontrack");
                    return;
                }
                
                const track = event.track;
                const streamId = stream.id;
                
                // Only handle video tracks for stream categorization
                if (track.kind !== 'video') {
                    console.log(`Audio track from ${remoteUserId}`);
                    return;
                }
                
                // Detect if this is a screen share track using multiple methods:
                // 1. Check track label (screen tracks often have "screen", "window", "monitor" in label)
                // 2. Check track settings for displaySurface
                // 3. Check if user is the known screen sharer AND this is a new stream
                const trackLabel = track.label?.toLowerCase() || '';
                const settings = track.getSettings?.() || {};
                
                const isScreenByLabel = trackLabel.includes('screen') || 
                                        trackLabel.includes('window') || 
                                        trackLabel.includes('monitor') ||
                                        trackLabel.includes('display');
                const isScreenBySurface = settings.displaySurface !== undefined;
                const isFromScreenSharer = screenSharerIdRef.current === remoteUserId;
                const isKnownCameraStream = knownCameraStreamsRef.current[remoteUserId]?.has(streamId);
                
                const isScreenShare = isScreenByLabel || isScreenBySurface || (isFromScreenSharer && !isKnownCameraStream);
                
                console.log(`>>> ontrack from ${remoteUserId}: label="${track.label}", displaySurface=${settings.displaySurface}, screenSharer=${screenSharerIdRef.current}, isScreen=${isScreenShare}`);

                if (isScreenShare) {
                    console.log(">>> SCREEN SHARE detected from", remoteUserId);
                    // Mark this user as screen sharer if not already
                    if (!screenSharerIdRef.current) {
                        screenSharerIdRef.current = remoteUserId;
                        setScreenSharerInfo({ 
                            id: remoteUserId, 
                            name: peerInfoRef.current[remoteUserId]?.name || "Participant", 
                            isLocal: false 
                        });
                    }
                    setRemoteScreenStream(stream);
                    
                    setTimeout(() => {
                        if (presentationVideoRef.current) {
                            presentationVideoRef.current.srcObject = stream;
                            presentationVideoRef.current.play().catch(e => console.log("Play err:", e));
                        }
                    }, 100);
                } else {
                    console.log(">>> CAMERA detected from", remoteUserId);
                    knownCameraStreamsRef.current[remoteUserId]?.add(streamId);
                    
                    setRemoteCameraStreams(prev => ({ ...prev, [remoteUserId]: stream }));
                    
                    setTimeout(() => {
                        const videoEl = remoteVideoRefs.current[remoteUserId];
                        if (videoEl) {
                            videoEl.srcObject = stream;
                            videoEl.play().catch(e => console.log("Play err:", e));
                        }
                    }, 100);
                }
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("webrtc_ice_candidate", {
                        sessionId,
                        to: remoteUserId,
                        candidate: event.candidate
                    });
                }
            };

            pc.onconnectionstatechange = () => {
                console.log("Connection state with", remoteUserId, ":", pc.connectionState);
                if (pc.connectionState === "failed" || pc.connectionState === "closed") {
                    delete peerConnectionsRef.current[remoteUserId];
                    delete knownCameraStreamsRef.current[remoteUserId];
                    setRemoteCameraStreams(prev => {
                        const n = { ...prev };
                        delete n[remoteUserId];
                        return n;
                    });
                }
            };

            return pc;
        };

        const sendOffer = async (oderId, peerName) => {
            const pc = createPC(oderId, peerName);
            try {
                const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                await pc.setLocalDescription(offer);
                socket.emit("webrtc_offer", { sessionId, to: oderId, sdp: offer });
                console.log("Sent offer to:", oderId);
            } catch (err) {
                console.error("Error sending offer:", err);
            }
        };

        // Join room
        socket.emit("webrtc_join_session", { 
            sessionId, 
            role: isOrganizer ? "organizer" : "participant", 
            name: userName 
        });

        socket.on("webrtc_room_status", ({ participants, existingPeers }) => {
            console.log("Room status:", participants, "peers:", existingPeers);
            setParticipantsInRoom(participants);
            
            if (existingPeers?.length > 0) {
                existingPeers.forEach(peer => {
                    setPeerInfo(prev => ({ ...prev, [peer.oderId]: { name: peer.name, role: peer.role } }));
                    peerInfoRef.current[peer.oderId] = { name: peer.name, role: peer.role };
                    sendOffer(peer.oderId, peer.name);
                });
            }
        });

        socket.on("webrtc_peer_joined", ({ oderId, role, name }) => {
            console.log("Peer joined:", oderId, name);
            setParticipantsInRoom(prev => prev + 1);
            setPeerInfo(prev => ({ ...prev, [oderId]: { name: name || "Participant", role } }));
            peerInfoRef.current[oderId] = { name: name || "Participant", role };
            toast.success(`${name || "Someone"} joined!`);
        });

        socket.on("webrtc_peer_left", ({ oderId }) => {
            console.log("Peer left:", oderId);
            const leavingPeer = peerInfoRef.current[oderId];
            setParticipantsInRoom(prev => Math.max(0, prev - 1));
            
            if (peerConnectionsRef.current[oderId]) {
                peerConnectionsRef.current[oderId].close();
                delete peerConnectionsRef.current[oderId];
            }
            delete knownCameraStreamsRef.current[oderId];
            
            setRemoteCameraStreams(prev => {
                const n = { ...prev };
                delete n[oderId];
                return n;
            });
            
            // If they were screen sharing, clear it
            if (screenSharerIdRef.current === oderId) {
                screenSharerIdRef.current = null;
                setRemoteScreenStream(null);
                setScreenSharerInfo(null);
                if (presentationVideoRef.current) presentationVideoRef.current.srcObject = null;
            }
            
            setPeerInfo(prev => {
                const n = { ...prev };
                delete n[oderId];
                return n;
            });
            delete peerInfoRef.current[oderId];
            
            if (leavingPeer?.name) toast.info(`${leavingPeer.name} left`);
        });

        socket.on("webrtc_offer", async ({ from, sdp }) => {
            console.log("Received offer from:", from);
            try {
                const peerName = peerInfoRef.current[from]?.name || "Participant";
                let pc = peerConnectionsRef.current[from];
                if (!pc) {
                    pc = createPC(from, peerName);
                }
                
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit("webrtc_answer", { sessionId, to: from, sdp: answer });
            } catch (err) {
                console.error("Error handling offer:", err);
            }
        });

        socket.on("webrtc_answer", async ({ from, sdp }) => {
            console.log("Received answer from:", from);
            try {
                const pc = peerConnectionsRef.current[from];
                if (pc?.signalingState === "have-local-offer") {
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                }
            } catch (err) {
                console.error("Error handling answer:", err);
            }
        });

        socket.on("webrtc_ice_candidate", async ({ candidate, from }) => {
            const pc = peerConnectionsRef.current[from];
            if (pc && candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error("Error adding ICE:", err);
                }
            }
        });

        socket.on("webrtc_renegotiate", async ({ from, sdp }) => {
            console.log("Renegotiate from:", from);
            try {
                let pc = peerConnectionsRef.current[from];
                if (!pc) {
                    pc = createPC(from, peerInfoRef.current[from]?.name);
                }
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit("webrtc_renegotiate_answer", { sessionId, to: from, sdp: answer });
            } catch (err) {
                console.error("Renegotiation error:", err);
            }
        });

        socket.on("webrtc_renegotiate_answer", async ({ from, sdp }) => {
            const pc = peerConnectionsRef.current[from];
            if (pc?.signalingState === "have-local-offer") {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                } catch (err) {
                    console.error("Renegotiate answer error:", err);
                }
            }
        });

        // Screen share notifications - IMPORTANT: set this BEFORE tracks arrive
        socket.on("webrtc_screen_share_started", ({ oderId, name }) => {
            console.log("!!! Screen share started by:", oderId, name);
            screenSharerIdRef.current = oderId;
            setScreenSharerInfo({ id: oderId, name: name || "Someone", isLocal: false });
            toast.info(`📺 ${name || "Someone"} started presenting`);
        });

        socket.on("webrtc_screen_share_stopped", ({ oderId }) => {
            console.log("!!! Screen share stopped by:", oderId);
            if (screenSharerIdRef.current === oderId) {
                screenSharerIdRef.current = null;
                setRemoteScreenStream(null);
                setScreenSharerInfo(null);
                if (presentationVideoRef.current) presentationVideoRef.current.srcObject = null;
            }
            toast.info("Screen sharing ended");
        });

        return () => {
            socket.emit("webrtc_leave_session", { sessionId });
            socket.off("webrtc_room_status");
            socket.off("webrtc_peer_joined");
            socket.off("webrtc_peer_left");
            socket.off("webrtc_offer");
            socket.off("webrtc_answer");
            socket.off("webrtc_ice_candidate");
            socket.off("webrtc_renegotiate");
            socket.off("webrtc_renegotiate_answer");
            socket.off("webrtc_screen_share_started");
            socket.off("webrtc_screen_share_stopped");
            
            Object.values(peerConnectionsRef.current).forEach(pc => pc?.close());
            peerConnectionsRef.current = {};
            knownCameraStreamsRef.current = {};
            
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        };
    }, [token, sessionId, isOrganizer, userName]);

    // Renegotiate with all peers when adding new tracks
    const renegotiateAllPeers = useCallback(async () => {
        console.log("Renegotiating with all peers...");
        for (const [oderId, pc] of Object.entries(peerConnectionsRef.current)) {
            if (!pc || pc.connectionState === "closed") continue;
            try {
                if (pc.signalingState === "stable") {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socketRef.current?.emit("webrtc_renegotiate", { sessionId, to: oderId, sdp: offer });
                    console.log("Sent renegotiation to:", oderId);
                }
            } catch (e) {
                console.error("Renegotiate error with", oderId, e);
            }
        }
    }, [sessionId]);

    // Start camera (independent)
    const startCamera = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localCameraStreamRef.current = stream;
            setLocalCameraStream(stream);
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            // Add to all existing peer connections
            for (const pc of Object.values(peerConnectionsRef.current)) {
                if (!pc || pc.connectionState === "closed") continue;
                stream.getTracks().forEach(track => {
                    const senders = pc.getSenders();
                    if (!senders.some(s => s.track?.id === track.id)) {
                        pc.addTrack(track, stream);
                    }
                });
            }
            
            await renegotiateAllPeers();
            toast.success("Camera started");
        } catch {
            setError("Could not access camera/microphone.");
            toast.error("Could not access camera");
        }
    };

    // Stop camera (independent)
    const stopCamera = () => {
        if (localCameraStreamRef.current) {
            localCameraStreamRef.current.getTracks().forEach(track => track.stop());
            localCameraStreamRef.current = null;
            setLocalCameraStream(null);
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
        }
    };

    const toggleMute = () => {
        if (localCameraStreamRef.current) {
            const audioTrack = localCameraStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    // Start screen share (independent)
    const startScreenShare = async () => {
        try {
            setError(null);
            
            // Notify FIRST so receivers know to expect screen share
            socketRef.current?.emit("webrtc_screen_share_started", { sessionId, userName });
            
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: true
            });

            stream.getVideoTracks()[0].onended = () => stopScreenShare();

            localScreenStreamRef.current = stream;
            setLocalScreenStream(stream);
            screenSharerIdRef.current = 'local';
            setScreenSharerInfo({ id: 'local', name: userName, isLocal: true });
            
            if (presentationVideoRef.current) {
                presentationVideoRef.current.srcObject = stream;
            }
            
            // Add to all existing peer connections
            for (const pc of Object.values(peerConnectionsRef.current)) {
                if (!pc || pc.connectionState === "closed") continue;
                stream.getTracks().forEach(track => {
                    const senders = pc.getSenders();
                    if (!senders.some(s => s.track?.id === track.id)) {
                        pc.addTrack(track, stream);
                    }
                });
            }
            
            await renegotiateAllPeers();
            toast.success("Screen sharing started!");
        } catch {
            // User cancelled or error
            socketRef.current?.emit("webrtc_screen_share_stopped", { sessionId });
            setError("Could not start screen share.");
            toast.error("Could not start screen share");
        }
    };

    // Stop screen share (independent)
    const stopScreenShare = () => {
        if (localScreenStreamRef.current) {
            localScreenStreamRef.current.getTracks().forEach(track => track.stop());
            localScreenStreamRef.current = null;
            setLocalScreenStream(null);
            
            screenSharerIdRef.current = null;
            setScreenSharerInfo(null);
            
            if (presentationVideoRef.current) {
                presentationVideoRef.current.srcObject = null;
            }
            
            socketRef.current?.emit("webrtc_screen_share_stopped", { sessionId });
        }
    };

    const toggleFullscreen = () => {
        if (!presentationContainerRef.current) return;
        if (!document.fullscreenElement) {
            presentationContainerRef.current.requestFullscreen().catch(() => toast.error("Fullscreen not supported"));
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Sync presentation video with screen share streams
    useEffect(() => {
        const stream = localScreenStream || remoteScreenStream;
        if (presentationVideoRef.current) {
            presentationVideoRef.current.srcObject = stream || null;
            if (stream) {
                presentationVideoRef.current.play().catch(() => {});
            }
        }
    }, [localScreenStream, remoteScreenStream]);

    // Sync local camera video
    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localCameraStream || null;
            if (localCameraStream) {
                localVideoRef.current.play().catch(() => {});
            }
        }
    }, [localCameraStream]);

    // Recording - mimeType ref to persist across callbacks
    const mimeTypeRef = useRef('video/webm');
    
    const getSupportedMimeType = () => {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return 'video/webm';
    };

    const startRecording = () => {
        const streamToRecord = localScreenStream || remoteScreenStream || localCameraStream;
        if (!streamToRecord) {
            toast.error("No stream to record");
            return;
        }
        
        // Check if stream has active tracks
        const activeTracks = streamToRecord.getTracks().filter(t => t.readyState === 'live');
        if (activeTracks.length === 0) {
            toast.error("Stream has no active tracks");
            return;
        }
        
        try {
            recordingChunksRef.current = [];
            mimeTypeRef.current = getSupportedMimeType();
            console.log("Recording with mimeType:", mimeTypeRef.current);
            
            const recorder = new MediaRecorder(streamToRecord, { mimeType: mimeTypeRef.current });
            
            recorder.ondataavailable = (e) => {
                console.log("Recording chunk:", e.data.size, "bytes");
                if (e.data.size > 0) {
                    recordingChunksRef.current.push(e.data);
                }
            };
            
            recorder.onstop = () => {
                console.log("Recording stopped, chunks:", recordingChunksRef.current.length);
                clearInterval(recordingTimerRef.current);
                
                if (recordingChunksRef.current.length === 0) {
                    toast.error("No recording data captured. Try recording for longer.");
                    setRecording(false);
                    return;
                }
                
                // Use simple video/webm type for better compatibility
                const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
                console.log("Created blob:", blob.size, "bytes, type:", blob.type);
                
                if (blob.size === 0) {
                    toast.error("Recording is empty");
                    setRecording(false);
                    return;
                }
                
                setRecordedBlob(blob);
                if (recordedBlobUrlRef.current) URL.revokeObjectURL(recordedBlobUrlRef.current);
                recordedBlobUrlRef.current = URL.createObjectURL(blob);
                console.log("Created blob URL:", recordedBlobUrlRef.current);
                setShowPreviewDialog(true);
            };
            
            recorder.onerror = (e) => {
                console.error("Recording error:", e);
                toast.error("Recording error occurred");
                setRecording(false);
                clearInterval(recordingTimerRef.current);
            };
            
            // Handle track ending (e.g., when screen share stops)
            streamToRecord.getTracks().forEach(track => {
                track.onended = () => {
                    console.log("Track ended during recording:", track.kind);
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                        console.log("Stopping recorder due to track end");
                        mediaRecorderRef.current.stop();
                    }
                };
            });
            
            recorder.start(100); // Collect data every 100ms for better short recording support
            mediaRecorderRef.current = recorder;
            setRecording(true);
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
            toast.success("Recording started");
            console.log("MediaRecorder started, state:", recorder.state);
        } catch (err) {
            console.error("Failed to start recording:", err);
            toast.error("Failed to start recording: " + err.message);
        }
    };

    const stopRecording = () => {
        const recorder = mediaRecorderRef.current;
        console.log("Stop recording clicked, recorder:", recorder, "state:", recorder?.state);
        
        if (!recorder) {
            console.error("No media recorder found");
            setRecording(false);
            return;
        }
        
        try {
            if (recorder.state === "recording" || recorder.state === "paused") {
                console.log("Stopping recorder...");
                recorder.stop();
            } else {
                console.log("Recorder not in recording state:", recorder.state);
            }
        } catch (err) {
            console.error("Error stopping recorder:", err);
        }
        
        setRecording(false);
    };

    const downloadRecording = () => {
        if (!recordedBlob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(recordedBlob);
        a.download = `demo-${sessionId}-${Date.now()}.webm`;
        a.click();
        toast.success("Downloaded!");
    };

    const uploadRecording = async () => {
        if (!recordedBlob) return;
        setUploading(true);
        try {
            // Create a new blob with simple video/webm type (without codec suffix)
            const uploadBlob = new Blob([recordedBlob], { type: 'video/webm' });
            
            const formData = new FormData();
            formData.append("video", uploadBlob, "recording.webm");
            formData.append("sessionId", sessionId);
            
            console.log("Uploading video:", uploadBlob.size, "bytes, type:", uploadBlob.type);
            
            const res = await fetch("/api/demo-stage/upload-video", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Upload failed" }));
                throw new Error(errorData.error || "Upload failed");
            }
            const data = await res.json();
            console.log("Upload successful:", data);
            toast.success("Uploaded!");
            if (onVideoUploaded) onVideoUploaded(data);
            setShowPreviewDialog(false);
            setRecordedBlob(null);
        } catch (err) {
            console.error("Upload error:", err);
            toast.error("Upload failed: " + (err.message || "Unknown error"));
        } finally {
            setUploading(false);
        }
    };

    const discardRecording = () => {
        if (recordedBlobUrlRef.current) URL.revokeObjectURL(recordedBlobUrlRef.current);
        setRecordedBlob(null);
        setShowPreviewDialog(false);
    };

    useEffect(() => {
        return () => {
            localCameraStreamRef.current?.getTracks().forEach(track => track.stop());
            localScreenStreamRef.current?.getTracks().forEach(track => track.stop());
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            if (recordedBlobUrlRef.current) URL.revokeObjectURL(recordedBlobUrlRef.current);
            recordingChunksRef.current = [];
        };
    }, []);

    // Create blob URL when recordedBlob changes
    const previewBlobUrl = React.useMemo(() => {
        if (recordedBlob) {
            const url = URL.createObjectURL(recordedBlob);
            console.log("Created preview URL:", url, "blob size:", recordedBlob.size);
            return url;
        }
        return null;
    }, [recordedBlob]);
    
    // Cleanup blob URL
    useEffect(() => {
        return () => {
            if (previewBlobUrl) {
                URL.revokeObjectURL(previewBlobUrl);
            }
        };
    }, [previewBlobUrl]);
    
    // Set video src when dialog opens
    useEffect(() => {
        if (showPreviewDialog && previewBlobUrl && previewVideoRef.current) {
            console.log("Setting preview video src:", previewBlobUrl);
            const video = previewVideoRef.current;
            video.src = previewBlobUrl;
            video.load();
            video.onloadedmetadata = () => {
                console.log("Preview video metadata loaded, duration:", video.duration);
            };
            video.oncanplay = () => {
                console.log("Preview video can play");
            };
            video.onerror = () => {
                console.error("Preview video error:", video.error);
            };
        }
    }, [showPreviewDialog, previewBlobUrl]);

    // Computed
    const hasScreenShare = !!localScreenStream || !!remoteScreenStream;
    const isLocalScreenShare = screenSharerInfo?.isLocal;
    const remoteCameraEntries = Object.entries(remoteCameraStreams);
    const hasStreamToRecord = hasScreenShare || !!localCameraStream;

    const setRemoteVideoRef = useCallback((oderId, el) => {
        if (el) {
            remoteVideoRefs.current[oderId] = el;
            if (remoteCameraStreams[oderId]) {
                el.srcObject = remoteCameraStreams[oderId];
            }
        }
    }, [remoteCameraStreams]);

    return (
        <Box sx={{ p: 2, border: "1px solid #e0e0e0", borderRadius: 2, bgcolor: "#fafafa" }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={1} mb={2} flexWrap="wrap">
                <Typography variant="h6">Demo Session</Typography>
                <Chip size="small" label={`${participantsInRoom} in room`} color={participantsInRoom > 1 ? "success" : "default"} />
                {localCameraStream && <Chip size="small" label="Camera On" color="success" />}
                {hasScreenShare && <Chip size="small" label="Presentation Active" color="secondary" />}
                {isLocalScreenShare && <Chip size="small" label="You're Presenting" color="info" />}
                {recording && (
                    <Chip size="small" icon={<Timer sx={{ fontSize: 14 }} />} label={`REC ${formatDuration(recordingDuration)}`} color="error" sx={{ animation: "pulse 1s infinite" }} />
                )}
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
            
            {participantsInRoom === 1 && (
                <Alert severity="info" sx={{ mb: 2 }}>Waiting for other participants to join...</Alert>
            )}

            {/* Screen share presentation area */}
            {hasScreenShare && (
                <Box 
                    ref={presentationContainerRef}
                    sx={{ 
                        mb: 2, position: "relative", bgcolor: "#000", borderRadius: 1, overflow: "hidden",
                        ...(isFullscreen && { width: "100%", height: "100vh" })
                    }}
                >
                    <Typography 
                        variant="caption" 
                        sx={{ position: "absolute", top: 8, left: 8, bgcolor: "rgba(0,0,0,0.7)", color: "white", px: 1, py: 0.5, borderRadius: 1, zIndex: 1 }}
                    >
                        📺 {screenSharerInfo?.name || "Someone"} {isLocalScreenShare ? "(You)" : ""} - Presenting
                    </Typography>
                    <video
                        ref={presentationVideoRef}
                        autoPlay
                        playsInline
                        muted={isLocalScreenShare}
                        style={{ width: "100%", height: isFullscreen ? "100vh" : 400, objectFit: "contain", background: "#000" }}
                    />
                    <Stack direction="row" spacing={1} sx={{ position: "absolute", top: 8, right: 8 }}>
                        {recording && <Chip label="● REC" size="small" color="error" sx={{ animation: "pulse 1s infinite" }} />}
                        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                            <IconButton onClick={toggleFullscreen} sx={{ bgcolor: "rgba(0,0,0,0.5)", color: "white" }}>
                                {isFullscreen ? <Close /> : <Fullscreen />}
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Box>
            )}

            {/* Camera thumbnails */}
            <Grid container spacing={1} mb={2}>
                {/* Local camera */}
                <Grid item>
                    <Box sx={{ textAlign: "center" }}>
                        <Typography variant="caption" display="block" mb={0.5}>{userName} (You)</Typography>
                        <Box sx={{
                            width: 160, height: 120, bgcolor: "#000", borderRadius: 1, overflow: "hidden",
                            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                            border: localCameraStream ? "2px solid #4caf50" : "1px solid #333"
                        }}>
                            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            {!localCameraStream && <Typography color="white" sx={{ position: "absolute", fontSize: 11 }}>Camera Off</Typography>}
                            {isMuted && localCameraStream && <MicOff sx={{ position: "absolute", bottom: 4, right: 4, color: "red", fontSize: 16 }} />}
                        </Box>
                    </Box>
                </Grid>

                {/* Remote cameras */}
                {remoteCameraEntries.map(([oderId]) => (
                    <Grid item key={oderId}>
                        <Box sx={{ textAlign: "center" }}>
                            <Typography variant="caption" display="block" mb={0.5}>{peerInfo[oderId]?.name || "Participant"}</Typography>
                            <Box sx={{ width: 160, height: 120, bgcolor: "#000", borderRadius: 1, overflow: "hidden", border: "2px solid #2196f3" }}>
                                <video ref={(el) => setRemoteVideoRef(oderId, el)} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </Box>
                        </Box>
                    </Grid>
                ))}
                
                {/* Placeholders for peers without camera */}
                {Object.entries(peerInfo).filter(([id]) => !remoteCameraStreams[id]).map(([id, info]) => (
                    <Grid item key={`placeholder-${id}`}>
                        <Box sx={{ textAlign: "center" }}>
                            <Typography variant="caption" display="block" mb={0.5}>{info.name || "Participant"}</Typography>
                            <Box sx={{
                                width: 160, height: 120, bgcolor: "#222", borderRadius: 1,
                                display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #333"
                            }}>
                                <Typography color="white" sx={{ fontSize: 11 }}>Camera Off</Typography>
                            </Box>
                        </Box>
                    </Grid>
                ))}
            </Grid>

            {/* Controls */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {!localCameraStream ? (
                    <Button onClick={startCamera} variant="outlined" startIcon={<Videocam />} size="small">
                        Start Camera
                    </Button>
                ) : (
                    <>
                        <Button onClick={stopCamera} variant="outlined" startIcon={<VideocamOff />} color="error" size="small">
                            Stop Camera
                        </Button>
                        <Button onClick={toggleMute} variant="outlined" startIcon={isMuted ? <MicOff /> : <Mic />} color={isMuted ? "error" : "default"} size="small">
                            {isMuted ? "Unmute" : "Mute"}
                        </Button>
                    </>
                )}

                {!isLocalScreenShare ? (
                    <Button onClick={startScreenShare} variant="contained" startIcon={<ScreenShare />} color="secondary" size="small">
                        Share Screen
                    </Button>
                ) : (
                    <Button onClick={stopScreenShare} variant="outlined" startIcon={<StopScreenShare />} color="error" size="small">
                        Stop Sharing
                    </Button>
                )}

                {canRecord && (
                    !recording ? (
                        <Button onClick={startRecording} disabled={!hasStreamToRecord} variant="contained" startIcon={<FiberManualRecord />} color="error" size="small">
                            Record
                        </Button>
                    ) : (
                        <Button onClick={stopRecording} variant="outlined" startIcon={<Stop />} color="error" size="small">
                            Stop ({formatDuration(recordingDuration)})
                        </Button>
                    )
                )}

                {hasScreenShare && (
                    <Button onClick={toggleFullscreen} variant="outlined" startIcon={<Fullscreen />} size="small">
                        Fullscreen
                    </Button>
                )}
            </Stack>

            {/* Recording Dialog */}
            <Dialog open={showPreviewDialog} onClose={() => !uploading && setShowPreviewDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Recording Complete ({formatDuration(recordingDuration)})</DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 2, bgcolor: "#000", borderRadius: 1, minHeight: 200 }}>
                        {previewBlobUrl ? (
                            <video 
                                ref={previewVideoRef}
                                src={previewBlobUrl}
                                controls 
                                preload="metadata"
                                playsInline
                                style={{ width: "100%", maxHeight: 400, display: "block" }} 
                            />
                        ) : (
                            <Typography color="white" sx={{ p: 4, textAlign: 'center' }}>
                                No video available
                            </Typography>
                        )}
                    </Box>
                    {recordedBlob && (
                        <Typography variant="caption" color="text.secondary">
                            Size: {(recordedBlob.size / 1024 / 1024).toFixed(2)} MB
                        </Typography>
                    )}
                    <FormControlLabel
                        control={<Switch checked={shareRecording} onChange={(e) => setShareRecording(e.target.checked)} disabled={uploading} />}
                        label="Share recording"
                    />
                    {uploading && <LinearProgress sx={{ mt: 2 }} />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={discardRecording} startIcon={<Delete />} color="error" disabled={uploading}>Discard</Button>
                    <Button onClick={downloadRecording} startIcon={<Download />} disabled={uploading}>Download</Button>
                    {shareRecording ? (
                        <Button onClick={uploadRecording} variant="contained" startIcon={<CloudUpload />} disabled={uploading}>
                            {uploading ? "Uploading..." : "Upload"}
                        </Button>
                    ) : (
                        <Button onClick={() => setShowPreviewDialog(false)} variant="contained">Done</Button>
                    )}
                </DialogActions>
            </Dialog>

            <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }`}</style>
        </Box>
    );
};

export default WebRTCStreamRecorder;
