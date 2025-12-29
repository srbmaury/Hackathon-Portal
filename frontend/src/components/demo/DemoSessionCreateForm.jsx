import React, { useState } from "react";
import { createDemoSession } from "../api/demoSessions";

const DemoSessionCreateForm = ({ hackathonId, roundId, teamId, token, onCreated }) => {
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const data = {
                hackathon: hackathonId,
                round: roundId,
                team: teamId,
                startTime: startTime ? new Date(startTime) : undefined,
                endTime: endTime ? new Date(endTime) : undefined,
                videoUrl: videoUrl || undefined,
            };
            await createDemoSession(data, token);
            if (onCreated) onCreated();
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h4>Create Demo Session</h4>
            <div>
                <label>Start Time: <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} /></label>
            </div>
            <div>
                <label>End Time: <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} /></label>
            </div>
            <div>
                <label>Video URL: <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} /></label>
            </div>
            <button type="submit" disabled={loading}>Create</button>
            {error && <div style={{ color: 'red' }}>{error}</div>}
        </form>
    );
};

export default DemoSessionCreateForm;
