import React from "react";
import { Box, useTheme } from "@mui/material";
import MDEditor from "@uiw/react-md-editor";

const MarkdownViewer = ({ content }) => {
    const theme = useTheme();
    const colorScheme = theme.palette.mode;

    return (
        <Box
            data-color-mode={colorScheme}
            sx={{
                "& .wmde-markdown": {
                    backgroundColor: "transparent !important",
                    color: "text.primary"
                },
                "& .wmde-markdown-color": {
                    backgroundColor: "transparent !important"
                },
                "& p": { mb: 1.5 },
                "& h1, & h2, & h3, & h4, & h5, & h6": {
                    color: "text.primary",
                    mt: 2,
                    mb: 1
                },
                "& img": {
                    maxWidth: "100%",
                    height: "auto",
                    borderRadius: 2,
                    mt: 1,
                    mb: 1
                },
                "& pre": {
                    backgroundColor: theme.palette.mode === "dark" ? "#1e1e1e !important" : "#f5f5f5 !important",
                    padding: 2,
                    borderRadius: 1,
                    overflow: "auto"
                },
                "& code": {
                    backgroundColor: theme.palette.mode === "dark" ? "#1e1e1e" : "#f5f5f5",
                    padding: "2px 6px",
                    borderRadius: 1
                },
                "& a": {
                    color: "primary.main"
                },
                "& ul, & ol": {
                    pl: 2,
                    mb: 1.5
                },
                "& li": {
                    mb: 0.5
                },
                "& blockquote": {
                    borderLeft: `4px solid ${theme.palette.primary.main}`,
                    pl: 2,
                    py: 1,
                    my: 2,
                    color: "text.secondary",
                    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"
                }
            }}
        >
            <MDEditor.Markdown source={content} />
        </Box>
    );
};

export default MarkdownViewer;

