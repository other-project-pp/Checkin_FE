import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { getDiscordUsers } from "../services/adminservice";
import { type DiscordUserSnapshot } from "../types/admin.types";
import { getSocket } from "../services/socket";

const statusLabel = (s: DiscordUserSnapshot["status"]) => {
  if (s === "online") return "Online";
  if (s === "idle") return "Idle";
  if (s === "dnd") return "DND";
  return "Offline";
};

const statusColor = (s: DiscordUserSnapshot["status"]) => {
  if (s === "online") return "success";
  if (s === "idle") return "warning";
  if (s === "dnd") return "error";
  return "default";
};

const activityText = (a: DiscordUserSnapshot["activities"][number]) => {
  // show details/state if exists
  const parts = [a.name, a.details, a.state].filter(Boolean);
  return parts.join(" • ");
};

export default function DiscordStatusPage() {
  const [rows, setRows] = useState<DiscordUserSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [voiceOnly, setVoiceOnly] = useState(false);

  // initial load
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getDiscordUsers();
        if (!alive) return;
        setRows(res.users || []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load discord users");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // socket realtime
  useEffect(() => {
    const socket = getSocket();

    socket.emit("joinDashboards");

    const onSnapshot = (list: DiscordUserSnapshot[]) => {
      setRows(list || []);
    };

    const onUpdate = (u: DiscordUserSnapshot) => {
      setRows((prev) => {
        const idx = prev.findIndex((x) => x.discordUserId === u.discordUserId);
        if (idx === -1) return [u, ...prev];
        const next = prev.slice();
        next[idx] = u;
        return next;
      });
    };

    socket.on("discord:snapshot", onSnapshot);
    socket.on("discord:userUpdate", onUpdate);

    return () => {
      socket.off("discord:snapshot", onSnapshot);
      socket.off("discord:userUpdate", onUpdate);
    };
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (onlineOnly && r.status === "offline") return false;
        if (voiceOnly && !r.inVoice) return false;
        if (!kw) return true;

        const showName = (r.matchedName || r.discordName || "").toLowerCase();
        const discordUser = (r.username || "").toLowerCase();
        const vc = (r.voiceChannelName || "").toLowerCase();

        return showName.includes(kw) || discordUser.includes(kw) || vc.includes(kw);
      })
      .sort((a, b) => {
        // online first, then voice, then name
        const rank = (x: DiscordUserSnapshot) => {
          const s = x.status === "online" ? 0 : x.status === "idle" ? 1 : x.status === "dnd" ? 2 : 3;
          const v = x.inVoice ? 0 : 1;
          return `${s}${v}`;
        };
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra.localeCompare(rb);

        const na = (a.matchedName || a.discordName || "").toLowerCase();
        const nb = (b.matchedName || b.discordName || "").toLowerCase();
        return na.localeCompare(nb);
      });
  }, [rows, q, onlineOnly, voiceOnly]);

  if (loading) return <CircularProgress />;
  if (err) return <Alert severity="error">{err}</Alert>;

  const onlineCount = rows.filter((r) => r.status !== "offline").length;
  const voiceCount = rows.filter((r) => r.inVoice).length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Alert severity="info" sx={{ fontWeight: 800 }}>
        Discord Live Status • Online: {onlineCount} • In Voice: {voiceCount} • Total: {rows.length}
      </Alert>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            clickable
            variant={onlineOnly ? "filled" : "outlined"}
            color="success"
            label="Online only"
            onClick={() => setOnlineOnly((v) => !v)}
          />
          <Chip
            clickable
            variant={voiceOnly ? "filled" : "outlined"}
            color="primary"
            label="In voice only"
            onClick={() => setVoiceOnly((v) => !v)}
          />
        </Stack>

        <TextField
          size="small"
          placeholder="Search name / username / voice channel..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: { xs: "100%", md: 360 } }}
        />
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><Typography fontWeight={900}>ชื่อ</Typography></TableCell>
              <TableCell><Typography fontWeight={900}>สถานะ</Typography></TableCell>
              <TableCell><Typography fontWeight={900}>Voice</Typography></TableCell>
              <TableCell><Typography fontWeight={900}>กำลังทำอะไร</Typography></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filtered.map((r) => {
              const displayName = r.matchedName || r.discordName || r.username;

              return (
                <TableRow key={r.discordUserId} hover>
                  <TableCell sx={{ fontWeight: 900 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar src={r.avatarUrl || undefined} sx={{ width: 28, height: 28, fontSize: 12 }}>
                        {(displayName?.[0] || "?").toUpperCase()}
                      </Avatar>

                      <Stack spacing={0}>
                        <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>{displayName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          @{r.username}
                        </Typography>
                      </Stack>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Chip size="small" label={statusLabel(r.status)} color={statusColor(r.status) as any} />
                  </TableCell>

                  <TableCell>
                    {r.inVoice ? (
                      <Chip size="small" color="primary" label={`🎙 ${r.voiceChannelName || "Voice"}`} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {r.activities?.length ? (
                      <Stack spacing={0.25}>
                        {r.activities.slice(0, 2).map((a, idx) => (
                          <Typography key={`${r.discordUserId}-a-${idx}`} variant="body2" sx={{ fontWeight: 700 }}>
                            {activityText(a)}
                          </Typography>
                        ))}
                        {r.activities.length > 2 ? (
                          <Typography variant="caption" color="text.secondary">
                            +{r.activities.length - 2} more
                          </Typography>
                        ) : null}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {!filtered.length ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ textAlign: "center", py: 4 }}>
                  No users
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
