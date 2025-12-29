import React, { useEffect, useState } from "react";
import { getDemoSessions, createDemoSession } from "../api/demoSessions";

const DemoSessionsList = ({ hackathonId, roundId, token }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        getDemoSessions(hackathonId, roundId, token)
            .then(setSessions)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [hackathonId, roundId, token]);

    if (loading) return <div>Loading demo sessions...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!sessions.length) return <div>No demo sessions found.</div>;

    return (
        <div>
            <h3>Demo Sessions</h3>
            <ul>
                {sessions.map((s) => (
                    <li key={s._id}>
                        Team: {s.team?.name || s.team} | Round: {s.round?.name || s.round} | Start: {s.startTime ? new Date(s.startTime).toLocaleString() : "-"} | Video: {s.videoUrl ? <a href={s.videoUrl}>View</a> : "-"}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default DemoSessionsList;
