import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { within } from "@testing-library/react";
import { describe, it, beforeEach, vi, expect } from "vitest";
import DemoStagePage from "../DemoStagePage";
import { getHackathonById } from "../../api/hackathons";
import API from "../../api/apiConfig";
import toast from "react-hot-toast";

/* ================= ROUTER ================= */
vi.mock("react-router-dom", () => ({
    useParams: () => ({ hackathonId: "hack-1" }),
}));

/* ================= i18n ================= */
vi.mock("react-i18next", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useTranslation: () => ({ t: (k) => k }),
    };
});

/* ================= TOAST ================= */
vi.mock("react-hot-toast", () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

/* ================= AUTH ================= */
vi.mock("../../context/AuthContext", () => ({
    useAuth: () => ({
        token: "test-token",
        user: { _id: "u1", role: "admin", name: "Admin" },
    }),
}));

/* ================= HACKATHONS API (FIXED) ================= */
vi.mock("../../api/hackathons", () => ({
    getHackathonById: vi.fn(),
}));

/* ================= API CLIENT ================= */
vi.mock("../../api/apiConfig", () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    },
}));

/* ================= WEBRTC ================= */
vi.mock("../WebRTCStreamRecorder", () => ({
    default: () => <div data-testid="webrtc-component" />,
}));

/* ========================================================= */

describe("DemoStagePage", () => {
    const teams = [
        { _id: "t1", name: "Team Alpha", members: ["u1"] },
        { _id: "t2", name: "Team Beta", members: [] },
    ];

    const sessions = [
        {
            _id: "s1",
            team: { _id: "t1", name: "Team Alpha", members: ["u1"] },
            stage: "scheduled",
            videoUrl: "",
        },
    ];

    const rounds = [{ _id: "r1", name: "Round 1" }];

    beforeEach(() => {
        vi.clearAllMocks();

        API.get.mockResolvedValue({ data: sessions });
        getHackathonById.mockResolvedValue({
            hackathon: { rounds },
        });

        window.confirm = vi.fn(() => true);
    });

    const renderPage = (props = {}) => {
        render(
            <DemoStagePage
                hackathonId="hack-1"
                myRole="organizer"
                teams={teams}
                {...props}
            />
        );
    };

    /* ================= LOADING ================= */

    it("shows loader initially", async () => {
        API.get.mockImplementation(() => new Promise(() => { }));
        renderPage();

        expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    /* ================= RENDER ================= */

    it("renders page title", async () => {
        renderPage();

        await waitFor(() => {
            expect(
                screen.getByText("demo_stage.live_demo_day")
            ).toBeInTheDocument();
        });
    });

    it("renders sessions list", async () => {
        renderPage();

        await waitFor(() => {
            expect(screen.getByText("Team Alpha")).toBeInTheDocument();
        });
    });

    /* ================= CREATE SESSION ================= */

    it("opens create session dialog", async () => {
        renderPage();

        fireEvent.click(
            await screen.findByText("demo_stage.schedule_session")
        );

        expect(
            screen.getByText("demo_stage.select_team")
        ).toBeInTheDocument();
    });

    it("blocks create when team or round is missing", async () => {
        renderPage();

        fireEvent.click(
            await screen.findByText("demo_stage.schedule_session")
        );

        const scheduleBtn = screen.getByText("demo_stage.schedule");

        expect(scheduleBtn).toBeDisabled();
        expect(API.post).not.toHaveBeenCalled();
    });


    it("creates a session successfully", async () => {
        API.post.mockResolvedValue({});

        renderPage();

        fireEvent.click(
            await screen.findByText("demo_stage.schedule_session")
        );

        const selects = screen.getAllByRole("combobox");

        /* ---------- TEAM SELECT ---------- */
        fireEvent.mouseDown(selects[0]);

        const teamListbox = await screen.findByRole("listbox");
        fireEvent.click(
            within(teamListbox).getByRole("option", { name: "Team Alpha" })
        );

        /* ---------- ROUND SELECT ---------- */
        fireEvent.mouseDown(selects[1]);

        const roundListbox = await screen.findByRole("listbox");
        fireEvent.click(
            within(roundListbox).getByRole("option", { name: "Round 1" })
        );

        /* ---------- SUBMIT ---------- */
        fireEvent.click(screen.getByText("demo_stage.schedule"));

        await waitFor(() => {
            expect(API.post).toHaveBeenCalledWith(
                "/demo-stage/sessions",
                expect.objectContaining({
                    hackathon: "hack-1",
                    team: "t1",
                    round: "r1",
                }),
                expect.any(Object)
            );
        });

        expect(toast.success).toHaveBeenCalledWith(
            "demo_stage.session_created"
        );
    });

    /* ================= VIEW SESSION ================= */

    it("activates session on view", async () => {
        renderPage();

        fireEvent.click(await screen.findByText("demo_stage.view"));

        await waitFor(() => {
            expect(
                screen.getByTestId("webrtc-component")
            ).toBeInTheDocument();
        });
    });

    /* ================= EDIT VIDEO ================= */

    it("opens edit video dialog", async () => {
        renderPage();

        fireEvent.click(await screen.findByText("demo_stage.view"));
        fireEvent.click(await screen.findByText("demo_stage.add_video"));

        expect(
            screen.getByText("demo_stage.edit_video")
        ).toBeInTheDocument();
    });

    it("updates video successfully", async () => {
        API.patch.mockResolvedValue({});

        renderPage();

        fireEvent.click(await screen.findByText("demo_stage.view"));
        fireEvent.click(await screen.findByText("demo_stage.add_video"));

        fireEvent.change(
            screen.getByLabelText("demo_stage.video_url"),
            { target: { value: "https://youtube.com/watch?v=test" } }
        );

        fireEvent.click(screen.getByText("common.update"));

        await waitFor(() => {
            expect(API.patch).toHaveBeenCalled();
            expect(toast.success).toHaveBeenCalledWith(
                "demo_stage.video_updated"
            );
        });
    });

    /* ================= DELETE ================= */

    it("deletes session after confirmation", async () => {
        API.delete.mockResolvedValue({});

        renderPage();

        fireEvent.click(await screen.findByText("demo_stage.view"));
        fireEvent.click(await screen.findByText("common.delete"));

        await waitFor(() => {
            expect(API.delete).toHaveBeenCalled();
            expect(toast.success).toHaveBeenCalledWith(
                "demo_stage.session_deleted"
            );
        });
    });

    /* ================= STAGE UPDATE ================= */

    it("updates session stage", async () => {
        API.patch.mockResolvedValue({});

        renderPage();

        fireEvent.mouseDown(
            await screen.findByText("demo_stage.stage_scheduled")
        );
        fireEvent.click(await screen.findByText("demo_stage.stage_live"));

        await waitFor(() => {
            expect(API.patch).toHaveBeenCalledWith(
                "/demo-stage/sessions/s1",
                { stage: "live" },
                expect.any(Object)
            );
        });
    });

    /* ================= EMPTY STATE ================= */

    it("shows empty state when no sessions", async () => {
        API.get.mockResolvedValue({ data: [] });

        renderPage();

        await waitFor(() => {
            expect(
                screen.getByText("demo_stage.no_sessions")
            ).toBeInTheDocument();
        });
    });
});
