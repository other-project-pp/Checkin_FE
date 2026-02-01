import { Box, Paper } from "@mui/material";
import React from "react";
import P5Background from "../common/p5Background";
import p2bg from "../../assets/my-illustration-background.png"
import p2fg from "../../assets/my-illustration-foreground.png";

export default function AppLayout({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {/* Full-width middle container */}
      <Paper
        elevation={0}
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          borderRadius: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",

          // important: allow background layers
          bgcolor: "transparent",
        }}
      >
        {/* P5 as background INSIDE the middle box */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
          }}
        >
          <P5Background bgImage={p2bg} fgImage={p2fg} particleCount={500} />
        </Box>

        {/* Foreground content */}
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            bgcolor: "rgba(255,255,255,0)",
            backdropFilter: "blur(2px)",
          }}
        >
          {header}
          <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
            {children}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
