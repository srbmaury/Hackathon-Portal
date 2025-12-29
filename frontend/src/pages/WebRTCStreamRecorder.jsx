import React, { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
    // Speech recognition for transcription (Web Speech API)
    const recognitionRef = useRef(null);
    // Track if we've already joined this session to prevent duplicate join events
    const hasJoinedSessionRef = useRef(null);

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
    const [recordingPaused, setRecordingPaused] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [participantsInRoom, setParticipantsInRoom] = useState(0);
    const [error, setError] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [shareRecording, setShareRecording] = useState(true);
    // Transcription/captions
    const [transcript, setTranscript] = useState("");
    const [showCaptions] = useState(true);
    // Trim
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(null); // null = end of video

    const { t } = useTranslation();
    const isOrganizer = myRole === "organizer" || myRole === "judge";
    const canRecord = isOrganizer;

    useEffect(() => { peerInfoRef.current = peerInfo; }, [peerInfo]);

    // --- Transcription logic ---
    const startTranscription = () => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event) => {
            let final = "";
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            setTranscript(final + interim);
        };
        recognition.onerror = (e) => {
            console.warn("Speech recognition error", e);
        };
        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopTranscription = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    };

    const pauseRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === "recording") {
            recorder.pause();
            setRecordingPaused(true);
            stopTranscription();
            toast.info(t("webrtc.recording_paused"));
        }
    };

    const resumeRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === "paused") {
            recorder.resume();
            setRecordingPaused(false);
            startTranscription();
            toast.success(t("webrtc.recording_resumed"));
        }
    };

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

        // Join room (only if not already joined this session)
        if (hasJoinedSessionRef.current !== sessionId) {
            hasJoinedSessionRef.current = sessionId;
            socket.emit("webrtc_join_session", {
                sessionId,
                role: isOrganizer ? "organizer" : "participant",
                name: userName
            });
        }

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
            toast.success(`${name || t("webrtc.someone")} ${t("webrtc.joined")}`);
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

            if (leavingPeer?.name) toast.info(`${leavingPeer.name} ${t("webrtc.left")}`);
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
            setScreenSharerInfo({ id: oderId, name: name || t("webrtc.someone"), isLocal: false });
            toast.info(`📺 ${name || t("webrtc.someone")} ${t("webrtc.started_presenting")}`);
        });

        socket.on("webrtc_screen_share_stopped", ({ oderId }) => {
            console.log("!!! Screen share stopped by:", oderId);
            if (screenSharerIdRef.current === oderId) {
                screenSharerIdRef.current = null;
                setRemoteScreenStream(null);
                setScreenSharerInfo(null);
                if (presentationVideoRef.current) presentationVideoRef.current.srcObject = null;
            }
            toast.info(t("webrtc.screen_sharing_ended"));
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
            hasJoinedSessionRef.current = null; // Reset so we can rejoin if component remounts

            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            toast.success(t("webrtc.camera_started"));
        } catch {
            setError(t("webrtc.camera_access_error"));
            toast.error(t("webrtc.camera_access_error"));
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
            toast.success(t("webrtc.screen_sharing_started"));
        } catch {
            // User cancelled or error
            socketRef.current?.emit("webrtc_screen_share_stopped", { sessionId });
            setError(t("webrtc.screen_share_error"));
            toast.error(t("webrtc.screen_share_error"));
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
            presentationContainerRef.current.requestFullscreen().catch(() => toast.error(t("webrtc.fullscreen_not_supported")));
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
                presentationVideoRef.current.play().catch(() => { });
            }
        }
    }, [localScreenStream, remoteScreenStream]);

    // Sync local camera video
    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localCameraStream || null;
            if (localCameraStream) {
                localVideoRef.current.play().catch(() => { });
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
            toast.error(t("webrtc.no_stream_to_record"));
            return;
        }

        // Check if stream has active tracks
        const activeTracks = streamToRecord.getTracks().filter(t => t.readyState === 'live');
        if (activeTracks.length === 0) {
            toast.error(t("webrtc.no_active_tracks"));
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
                    toast.error(t("webrtc.no_recording_data"));
                    setRecording(false);
                    return;
                }

                // Use simple video/webm type for better compatibility
                const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
                console.log("Created blob:", blob.size, "bytes, type:", blob.type);

                if (blob.size === 0) {
                    toast.error(t("webrtc.recording_empty"));
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
                toast.error(t("webrtc.recording_error"));
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
            toast.success(t("webrtc.recording_started"));
            console.log("MediaRecorder started, state:", recorder.state);
        } catch (err) {
            console.error("Failed to start recording:", err);
            toast.error(`${t("webrtc.recording_failed")}: ${err.message}`);
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
        setRecordingPaused(false);
        stopTranscription();
    };

    const downloadRecording = () => {
        if (!recordedBlob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(recordedBlob);
        a.download = `demo-${sessionId}-${Date.now()}.webm`;
        a.click();
        toast.success(t("webrtc.downloaded"));
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
            toast.success(t("webrtc.uploaded"));
            if (onVideoUploaded) onVideoUploaded(data);
            setShowPreviewDialog(false);
            setRecordedBlob(null);
        } catch (err) {
            console.error("Upload error:", err);
            toast.error(`${t("webrtc.upload_failed")}: ${err.message || t("common.error")}`);
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
                <Typography variant="h6">{t("webrtc.demo_session")}</Typography>
                <Chip size="small" label={`${participantsInRoom} ${t("webrtc.in_room")}`} color={participantsInRoom > 1 ? "success" : "default"} />
                {localCameraStream && <Chip size="small" label={t("webrtc.camera_on")} color="success" />}
                {hasScreenShare && <Chip size="small" label={t("webrtc.presentation_active")} color="secondary" />}
                {isLocalScreenShare && <Chip size="small" label={t("webrtc.you_presenting")} color="info" />}
                {recording && (
                    <Chip size="small" icon={<Timer sx={{ fontSize: 14 }} />} label={`REC ${formatDuration(recordingDuration)}`} color="error" sx={{ animation: "pulse 1s infinite" }} />
                )}
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            {participantsInRoom === 1 && (
                <Alert severity="info" sx={{ mb: 2 }}>{t("webrtc.waiting_for_participants")}</Alert>
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
                        📺 {screenSharerInfo?.name || t("webrtc.someone")} {isLocalScreenShare ? `(${t("webrtc.you")})` : ""} - {t("webrtc.presenting")}
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
                        <Tooltip title={isFullscreen ? t("webrtc.exit_fullscreen") : t("webrtc.fullscreen")}>
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
                        <Typography variant="caption" display="block" mb={0.5}>{userName} ({t("webrtc.you")})</Typography>
                        <Box sx={{
                            width: 160, height: 120, bgcolor: "#000", borderRadius: 1, overflow: "hidden",
                            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                            border: localCameraStream ? "2px solid #4caf50" : "1px solid #333"
                        }}>
                            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            {!localCameraStream && <Typography color="white" sx={{ position: "absolute", fontSize: 11 }}>{t("webrtc.camera_off")}</Typography>}
                            {isMuted && localCameraStream && <MicOff sx={{ position: "absolute", bottom: 4, right: 4, color: "red", fontSize: 16 }} />}
                        </Box>
                    </Box>
                </Grid>

                {/* Remote cameras */}
                {remoteCameraEntries.map(([oderId]) => (
                    <Grid item key={oderId}>
                        <Box sx={{ textAlign: "center" }}>
                            <Typography variant="caption" display="block" mb={0.5}>{peerInfo[oderId]?.name || t("webrtc.participant")}</Typography>
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
                            <Typography variant="caption" display="block" mb={0.5}>{info.name || t("webrtc.participant")}</Typography>
                            <Box sx={{
                                width: 160, height: 120, bgcolor: "#222", borderRadius: 1,
                                display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #333"
                            }}>
                                <Typography color="white" sx={{ fontSize: 11 }}>{t("webrtc.camera_off")}</Typography>
                            </Box>
                        </Box>
                    </Grid>
                ))}
            </Grid>

            {/* Controls */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {!localCameraStream ? (
                    <Button onClick={startCamera} variant="outlined" startIcon={<Videocam />} size="small">
                        {t("webrtc.start_camera")}
                    </Button>
                ) : (
                    <>
                        <Button onClick={stopCamera} variant="outlined" startIcon={<VideocamOff />} color="error" size="small">
                            {t("webrtc.stop_camera")}
                        </Button>
                        <Button onClick={toggleMute} variant="outlined" startIcon={isMuted ? <MicOff /> : <Mic />} color={isMuted ? "error" : "default"} size="small">
                            {isMuted ? t("webrtc.unmute") : t("webrtc.mute")}
                        </Button>
                    </>
                )}

                {!isLocalScreenShare ? (
                    <Button onClick={startScreenShare} variant="contained" startIcon={<ScreenShare />} color="secondary" size="small">
                        {t("webrtc.share_screen")}
                    </Button>
                ) : (
                    <Button onClick={stopScreenShare} variant="outlined" startIcon={<StopScreenShare />} color="error" size="small">
                        {t("webrtc.stop_sharing")}
                    </Button>
                )}

                {canRecord && (
                    !recording ? (
                        <Button onClick={startRecording} disabled={!hasStreamToRecord} variant="contained" startIcon={<FiberManualRecord />} color="error" size="small">
                            {t("webrtc.record")}
                        </Button>
                    ) : (
                        <>
                            <Button onClick={stopRecording} variant="outlined" startIcon={<Stop />} color="error" size="small">
                                {t("webrtc.stop")} ({formatDuration(recordingDuration)})
                            </Button>
                            <Button onClick={pauseRecording} variant="outlined" color="warning" size="small" disabled={recordingPaused} sx={{ ml: 1 }}>
                                {t("webrtc.pause")}
                            </Button>
                            <Button onClick={resumeRecording} variant="outlined" color="success" size="small" disabled={!recordingPaused} sx={{ ml: 1 }}>
                                {t("webrtc.resume")}
                            </Button>
                        </>
                    )
                )}
                {/* Live captions during recording */}
                {recording && showCaptions && transcript && (
                    <Box sx={{ mt: 2, bgcolor: "#222", color: "#fff", borderRadius: 1, p: 1, fontSize: 16, minHeight: 32 }}>
                        <b>{t("webrtc.captions")}:</b> {transcript}
                    </Box>
                )}

                {hasScreenShare && (
                    <Button onClick={toggleFullscreen} variant="outlined" startIcon={<Fullscreen />} size="small">
                        {t("webrtc.fullscreen")}
                    </Button>
                )}
            </Stack>

            {/* Recording Dialog */}
            <Dialog open={showPreviewDialog} onClose={() => !uploading && setShowPreviewDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>{t("webrtc.recording_complete")} ({formatDuration(recordingDuration)})</DialogTitle>
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
                                {t("webrtc.no_video_available")}
                            </Typography>
                        )}
                    </Box>
                    {/* Trim controls */}
                    {recordedBlob && (
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                            <Typography variant="body2">{t("webrtc.trim")}:</Typography>
                            <input
                                type="number"
                                min={0}
                                max={trimEnd !== null ? trimEnd : Math.floor(recordingDuration)}
                                value={trimStart}
                                onChange={e => setTrimStart(Number(e.target.value))}
                                style={{ width: 60 }}
                            />
                            <input
                                type="number"
                                min={trimStart}
                                max={Math.floor(recordingDuration)}
                                value={trimEnd !== null ? trimEnd : Math.floor(recordingDuration)}
                                onChange={e => setTrimEnd(Number(e.target.value))}
                                style={{ width: 60 }}
                            />
                            <Button onClick={() => {
                                // Trim the blob using slicing
                                if (!recordedBlob) return;
                                const start = Math.max(0, trimStart);
                                const end = trimEnd !== null ? Math.max(start, trimEnd) : Math.floor(recordingDuration);
                                const video = document.createElement('video');
                                video.src = URL.createObjectURL(recordedBlob);
                                video.onloadedmetadata = () => {
                                    const duration = video.duration;
                                    const realEnd = Math.min(end, duration);
                                    // For webm, slicing is not frame-accurate but works for basic trims
                                    const totalSize = recordedBlob.size;
                                    const startByte = Math.floor((start / duration) * totalSize);
                                    const endByte = Math.floor((realEnd / duration) * totalSize);
                                    const trimmed = recordedBlob.slice(startByte, endByte, recordedBlob.type);
                                    setRecordedBlob(trimmed);
                                    toast.success(t("webrtc.trimmed_video"));
                                };
                            }}>{t("webrtc.apply_trim")}</Button>
                        </Stack>
                    )}
                    {/* Transcript and captions */}
                    {transcript && (
                        <Box sx={{ bgcolor: "#222", color: "#fff", borderRadius: 1, p: 1, fontSize: 15, mb: 2 }}>
                            <b>{t("webrtc.transcript")}:</b> {transcript}
                        </Box>
                    )}
                    {recordedBlob && (
                        <Typography variant="caption" color="text.secondary">
                            {t("webrtc.size")}: {(recordedBlob.size / 1024 / 1024).toFixed(2)} MB
                        </Typography>
                    )}
                    <FormControlLabel
                        control={<Switch checked={shareRecording} onChange={(e) => setShareRecording(e.target.checked)} disabled={uploading} />}
                        label={t("webrtc.share_recording")}
                    />
                    {uploading && <LinearProgress sx={{ mt: 2 }} />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={discardRecording} startIcon={<Delete />} color="error" disabled={uploading}>{t("webrtc.discard")}</Button>
                    <Button onClick={downloadRecording} startIcon={<Download />} disabled={uploading}>{t("webrtc.download")}</Button>
                    {shareRecording ? (
                        <Button onClick={uploadRecording} variant="contained" startIcon={<CloudUpload />} disabled={uploading}>
                            {uploading ? t("webrtc.uploading") : t("webrtc.upload")}
                        </Button>
                    ) : (
                        <Button onClick={() => setShowPreviewDialog(false)} variant="contained">{t("webrtc.done")}</Button>
                    )}
                </DialogActions>
            </Dialog>

            <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }`}</style>
        </Box>
    );
};

export default WebRTCStreamRecorder;
