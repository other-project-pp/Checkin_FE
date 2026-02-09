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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Snackbar,
  Alert as MuiAlert
} from "@mui/material";
import Checkbox from "@mui/material/Checkbox";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useEffect, useMemo, useState } from "react";
import { getDiscordUsers, getdiscordVoiceStats, postDiscordGroup, getDiscordGroups, 
  getDiscordGroupMembers, postDiscordGroupMembers, postDiscordMoveMembers, 
  getDiscordVoiceChannels, deleteDiscordGroupMembers } from "../services/adminservice";
import { type DiscordUserSnapshot, type DiscordGroup, type DiscordVoiceChannel } from "../types/admin.types";
import { getSocket } from "../services/socket";

const DISCORD_SERVER: "0" | "1" = "1";

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

const voiceModeLabel = (r: DiscordUserSnapshot) => {
  if (!r.inVoice) return "-";
  if (r.selfDeaf) return "Deafened";
  if (r.selfMute) return "Muted";
  return "Normal";
};

const msToHMS = (ms: number) => {
  const s = Math.floor((ms || 0) / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}h ${mm}m ${ss}s`;
  if (mm > 0) return `${mm}m ${ss}s`;
  return `${ss}s`;
};

export default function DiscordStatusPage1() {
  const [rows, setRows] = useState<DiscordUserSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [voiceOnly, setVoiceOnly] = useState(false);

  const [websiteFilter, setWebsiteFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupErr, setGroupErr] = useState<string | null>(null);
  const [groupOk, setGroupOk] = useState<string | null>(null);

  const [groups, setGroups] = useState<DiscordGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [groupMemberSet, setGroupMemberSet] = useState<Set<string> | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addGroupId, setAddGroupId] = useState<string>("");
  const [addSaving, setAddSaving] = useState(false);

  const [voiceChannels, setVoiceChannels] = useState<DiscordVoiceChannel[]>([]);
  const [vcLoading, setVcLoading] = useState(false);
  const [targetChannelId, setTargetChannelId] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);

  const [removeSaving, setRemoveSaving] = useState(false);

  const isSelected = (id: string) => selectedIds.has(id);

  const [statsDate, setStatsDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  const [dailyRows, setDailyRows] = useState<Record<string, { muteToggleCount: number; muteDurationMs: number; deafToggleCount: number; deafDurationMs: number }>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // initial load
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await getDiscordUsers(DISCORD_SERVER);
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

  const loadGroups = async () => {
    try {
      setGroupsLoading(true);
      const res = await getDiscordGroups(DISCORD_SERVER);
      setGroups(res.groups || []);
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setVcLoading(true);
        const res = await getDiscordVoiceChannels(DISCORD_SERVER);
        if (!alive) return;
        setVoiceChannels(res.channels || []);
      } catch {
        if (!alive) return;
        setVoiceChannels([]);
      } finally {
        if (alive) setVcLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // socket realtime
  useEffect(() => {
    const socket = getSocket();

    socket.emit("joinDiscordDashboards", { server: DISCORD_SERVER });

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
      socket.emit("leaveDiscordDashboards", { server: DISCORD_SERVER });
    };
  }, []);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setStatsLoading(true);
      try {
        const res = await getdiscordVoiceStats(statsDate, DISCORD_SERVER);
        if (!alive) return;

        const map: any = {};
        for (const row of res.rows || []) {
          map[row.discordUserId] = {
            muteToggleCount: row.muteToggleCount || 0,
            muteDurationMs: row.muteDurationMs || 0,
            deafToggleCount: row.deafToggleCount || 0,
            deafDurationMs: row.deafDurationMs || 0,
          };
        }
        setDailyRows(map);
      } finally {
        if (alive) setStatsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [statsDate]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (groupFilter === "ALL") {
        setGroupMemberSet(null);
        return;
      }

      try {
        const res = await getDiscordGroupMembers(groupFilter,DISCORD_SERVER);
        if (!alive) return;

        const set = new Set<string>();
        for (const m of res.members || []) {
          if (m?.discordUserId) set.add(String(m.discordUserId));
        }
        setGroupMemberSet(set);
      } catch {
        if (!alive) return;
        setGroupMemberSet(new Set());
      }
    })();

    return () => {
      alive = false;
    };
  }, [groupFilter]);

  useEffect(() => {
    clearSelection();
  }, [q, onlineOnly, voiceOnly, websiteFilter, channelFilter, groupFilter]);

  const websiteOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.websiteName) set.add(r.websiteName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const channelOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.inVoice && r.voiceChannelId) {
        map.set(r.voiceChannelId, r.voiceChannelName || r.voiceChannelId);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const selectedList = useMemo(() => {
    if (!selectedIds.size) return [];
    const map = new Map(rows.map(r => [r.discordUserId, r]));
    const out: Array<{ discordUserId: string; matchedUserId: string | null }> = [];
    for (const id of selectedIds) {
      const r = map.get(id);
      if (!r) continue;
      out.push({ discordUserId: r.discordUserId, matchedUserId: r.matchedUserId ?? null });
    }
    return out;
  }, [selectedIds, rows]);

  const onAddSelectedToGroup = async () => {
    setGroupErr(null);
    setGroupOk(null);

    if (!selectedList.length) {
      setGroupErr("Please select at least one user.");
      return;
    }
    if (!addGroupId) {
      setGroupErr("Please select a group to add.");
      return;
    }

    try {
      setAddSaving(true);
      const res = await postDiscordGroupMembers(addGroupId, { members: selectedList }, DISCORD_SERVER);

      if ((res as any).ok) {
        setGroupOk(`Added ${selectedList.length} users to group.`);
        clearSelection(); // recommended
        // refresh groups so memberCount updates (if you show it)
        await loadGroups();
      } else {
        setGroupErr((res as any).message || "Add to group failed.");
      }
    } catch (e: any) {
      setGroupErr(e?.message || "Add to group failed.");
    } finally {
      setAddSaving(false);
    }
  };
  
  const onMoveSelected = async () => {
    setGroupErr(null);
    setGroupOk(null);

    if (!selectedList.length) {
      setGroupErr("Please select at least one user.");
      return;
    }
    if (!targetChannelId) {
      setGroupErr("Please select target voice channel.");
      return;
    }

    try {
      setMoveSaving(true);
      const res = await postDiscordMoveMembers({
        discordUserIds: selectedList.map((x) => x.discordUserId),
        targetChannelId,
      },
      DISCORD_SERVER
    );

      if ((res as any).ok) {
        const { successCount, failCount } = res as any;
        setGroupOk(`Move done. success=${successCount}, failed=${failCount}`);
        clearSelection();
      } else {
        setGroupErr((res as any).message || "Move failed.");
      }
    } catch (e: any) {
      setGroupErr(e?.message || "Move failed.");
    } finally {
      setMoveSaving(false);
    }
  };

  const onRemoveSelectedFromGroup = async () => {
    setGroupErr(null);
    setGroupOk(null);

    if (groupFilter === "ALL") {
      setGroupErr("Please select a group first (Group filter).");
      return;
    }
    if (!selectedList.length) {
      setGroupErr("Please select at least one user.");
      return;
    }

    try {
      setRemoveSaving(true);

      const res = await deleteDiscordGroupMembers(groupFilter, {
        discordUserIds: selectedList.map((x) => x.discordUserId),
      },
      DISCORD_SERVER
    );

      if ((res as any).ok) {
        setGroupOk(`Removed ${(res as any).deleted ?? 0} users from group.`);
        clearSelection();

        const mem = await getDiscordGroupMembers(groupFilter,DISCORD_SERVER);
        const set = new Set<string>();
        for (const m of mem.members || []) if (m?.discordUserId) set.add(String(m.discordUserId));
        setGroupMemberSet(set);

        await loadGroups();
      } else {
        setGroupErr((res as any).message || "Remove failed.");
      }
    } catch (e: any) {
      setGroupErr(e?.message || "Remove failed.");
    } finally {
      setRemoveSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();

    return rows
      .filter((r) => {
        if (onlineOnly && r.status === "offline") return false;
        if (voiceOnly && !r.inVoice) return false;
        if (groupMemberSet && !groupMemberSet.has(r.discordUserId)) return false;

        if (websiteFilter !== "ALL") {
          if (websiteFilter === "UNKNOWN") {
            if (r.websiteName) return false;
          } else {
            if (r.websiteName !== websiteFilter) return false;
          }
        }

        if (channelFilter !== "ALL") {
          if (channelFilter === "NOVOICE") {
            if (r.inVoice) return false;
          } else {
            if (r.voiceChannelId !== channelFilter) return false;
          }
        }

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
  }, [rows, q, onlineOnly, voiceOnly, websiteFilter, channelFilter, groupMemberSet]);

  const filteredIds = useMemo(() => filtered.map((r) => r.discordUserId), [filtered]);

  const allFilteredSelected = useMemo(() => {
    if (!filteredIds.length) return false;
    return filteredIds.every((id) => selectedIds.has(id));
  }, [filteredIds, selectedIds]);

  const someFilteredSelected = useMemo(() => {
    return filteredIds.some((id) => selectedIds.has(id));
  }, [filteredIds, selectedIds]);

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (filteredIds.length && filteredIds.every((id) => next.has(id))) {
        // unselect all filtered
        filteredIds.forEach((id) => next.delete(id));
      } else {
        // select all filtered
        filteredIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  if (loading) return <CircularProgress />;
  if (err) return <Alert severity="error">{err}</Alert>;

  const onlineCount = rows.filter((r) => r.status !== "offline").length;
  const voiceCount = rows.filter((r) => r.inVoice).length;

  const onCreateGroup = async () => {
    setGroupErr(null);
    setGroupOk(null);

    const name = groupName.trim();
    if (!name) {
      setGroupErr("Please enter group name.");
      return;
    }

    try {
      setGroupSaving(true);
      const res = await postDiscordGroup({ name }, DISCORD_SERVER);

      if ((res as any).ok) {
        setGroupOk(`Group created: ${(res as any).name}`);
        setGroupName("");
        setCreateOpen(false);
        await loadGroups();
      } else {
        setGroupErr((res as any).message || "Create group failed.");
      }
    } catch (e: any) {
      setGroupErr(e?.message || "Create group failed.");
    } finally {
      setGroupSaving(false);
    }
  };

  const closeGroupOk = (_?: any, reason?: string) => {
    if (reason === "clickaway") return;
    setGroupOk(null);
  };

  const closeGroupErr = (_?: any, reason?: string) => {
    if (reason === "clickaway") return;
    setGroupErr(null);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Alert
        severity="info"
        sx={{ fontWeight: 800 }}
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Create group">
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  setGroupErr(null);
                  setGroupOk(null);
                  setCreateOpen(true);
                }}
                sx={{ fontWeight: 800 }}
              >
                + Group
              </Button>
            </Tooltip>

            <Tooltip title="Refresh">
              <IconButton
                size="small"
                onClick={() => window.location.reload()}
                sx={{
                  color: "white",
                  bgcolor: "rgba(34, 206, 154, 0.74)",
                  "&:hover": { bgcolor: "rgba(126, 230, 224, 0.59)" },
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      >
        สถานะ JUN88 Discord Live • ออนไลน์: {onlineCount} • ในห้องพูดคุย: {voiceCount} • ทั้งหมด: {rows.length}
      </Alert>
     
      <Snackbar
        open={!!groupOk}
        autoHideDuration={5000}
        onClose={closeGroupOk}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <MuiAlert onClose={closeGroupOk} severity="success" variant="filled" sx={{ width: "100%" }}>
          {groupOk}
        </MuiAlert>
      </Snackbar>

      <Snackbar
        open={!!groupErr}
        autoHideDuration={5000}
        onClose={closeGroupErr}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <MuiAlert onClose={closeGroupErr} severity="error" variant="filled" sx={{ width: "100%" }}>
          {groupErr}
        </MuiAlert>
      </Snackbar>

      <Stack spacing={1}>
        {/* Row 1: quick filters + date + search */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ md: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              clickable
              variant={onlineOnly ? "filled" : "outlined"}
              color="success"
              label="ออนไลน์"
              onClick={() => setOnlineOnly((v) => !v)}
              sx={{ bgcolor: "rgba(255, 255, 255, 0.54)", color: "success", fontWeight: 800 }}
            />
            <Chip
              clickable
              variant={voiceOnly ? "filled" : "outlined"}
              color="primary"
              label="ในห้อง Voice"
              onClick={() => setVoiceOnly((v) => !v)}
              sx={{ bgcolor: "rgba(255, 255, 255, 0.54)", color: "primary", fontWeight: 800 }}
            />
            <Chip label={`Selected: ${selectedIds.size}`} sx={{ bgcolor: "rgba(255,255,255,0.54)", fontWeight: 800 }} />

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="website-filter" sx={{ color: "white" }}>เว็บไซต์</InputLabel>
              <Select
                labelId="website-filter"
                label="เว็บไซต์"
                value={websiteFilter}
                onChange={(e) => setWebsiteFilter(String(e.target.value))}
                sx={{ color: "white" }}
              >
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="UNKNOWN">Unknown</MenuItem>
                {websiteOptions.map((w) => (
                  <MenuItem key={w} value={w}>{w}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="channel-filter" sx={{ color: "white" }}>ช่องพูดคุยด้วยเสียง</InputLabel>
              <Select
                labelId="channel-filter"
                label="ช่องพูดคุยด้วยเสียง"
                value={channelFilter}
                onChange={(e) => setChannelFilter(String(e.target.value))}
                sx={{ color: "white" }}
              >
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="NOVOICE">Not in voice</MenuItem>
                {channelOptions.map(([id, name]) => (
                  <MenuItem key={id} value={id}>{name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              type="date"
              value={statsDate}
              onChange={(e) => setStatsDate(e.target.value)}
              sx={{
                minWidth: 170,
                bgcolor: "rgba(255,255,255,0.92)",
                borderRadius: 2,
                "& .MuiInputBase-input": { color: "rgba(0,0,0,0.9)" },
              }}
            />
          </Stack>

          <TextField
            size="small"
            placeholder="ค้นหาชื่อ Discord / ชื่อผู้ใช้งาน / ช่องพูดคุย..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{
              minWidth: { xs: "100%", md: 360 },
              bgcolor: "rgba(255,255,255,0.92)",
              borderRadius: 2,
              "& .MuiInputBase-input": { color: "rgba(0,0,0,0.9)" },
              "& .MuiInputBase-input::placeholder": { color: "rgba(0,0,0,0.55)", opacity: 1 },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(0,0,0,0.22)" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(0,0,0,0.35)" },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(0,0,0,0.55)" },
            }}
          />
        </Stack>

        {/* Row 2: group tools (your red box moved here) */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="group-filter" sx={{ color: "white" }}>กลุ่ม</InputLabel>
            <Select
              labelId="group-filter"
              label="Group"
              value={groupFilter}
              onChange={(e) => setGroupFilter(String(e.target.value))}
              sx={{ color: "white" }}
            >
              <MenuItem value="ALL">All</MenuItem>
              {groupsLoading ? <MenuItem disabled>Loading...</MenuItem> : null}
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.name}{typeof g.membercount === "number" ? ` (${g.membercount})` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="add-group-label" sx={{ color: "white" }}>เพิ่มลงในกลุ่ม</InputLabel>
            <Select
              labelId="add-group-label"
              label="Add to group"
              value={addGroupId}
              onChange={(e) => setAddGroupId(String(e.target.value))}
              sx={{ color: "white" }}
            >
              <MenuItem value="">Select group</MenuItem>
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            size="medium"
            onClick={onAddSelectedToGroup}
            disabled={addSaving || !selectedList.length || !addGroupId}
            sx={{ minWidth: 140 }}
          >
            {addSaving ? "Adding..." : "เพิ่มรายการที่เลือก"}
          </Button>

          <Button
            variant="outlined"
            size="medium"
            onClick={onRemoveSelectedFromGroup}
            disabled={removeSaving || groupFilter === "ALL" || !selectedList.length}
            sx={{
              minWidth: 160,
              borderColor: "error.main",
              color: "error.main",
              "&:hover": {
                borderColor: "error.dark",
                backgroundColor: "rgba(211, 47, 47, 0.08)",
              },
              "&.Mui-disabled": {
                borderColor: "rgba(211, 47, 47, 0.35)",
                color: "rgba(211, 47, 47, 0.35)",
              },
            }}
          >
            {removeSaving ? "Removing..." : "ลบรายการที่เลือกออก"}
          </Button>

          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel id="target-vc-label" sx={{ color: "white" }}>ย้ายไปยังช่อง</InputLabel>
            <Select
              labelId="target-vc-label"
              label="Move to channel"
              value={targetChannelId}
              onChange={(e) => setTargetChannelId(String(e.target.value))}
              sx={{ color: "white" }}
            >
              <MenuItem value="">Select channel</MenuItem>
              {vcLoading ? <MenuItem disabled>Loading...</MenuItem> : null}
              {voiceChannels.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.parentName ? `${c.parentName} / ${c.name}` : c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            size="medium"
            onClick={onMoveSelected}
            disabled={moveSaving || !selectedList.length || !targetChannelId}
            sx={{ minWidth: 140 }}
          >
            {moveSaving ? "Moving..." : "ย้ายรายการที่เลือก"}
          </Button>
        </Stack>
      </Stack>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflowX: "auto",
          bgcolor: "rgba(255,255,255,0.25)",
          backdropFilter: "blur(6px)",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
              <Checkbox
                checked={allFilteredSelected}
                indeterminate={!allFilteredSelected && someFilteredSelected}
                onChange={toggleSelectAllFiltered}
                sx={{ color: "white" }}
              />
            </TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>ชื่อ</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>สถานะ</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>ในห้อง Voice</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>Voice Mode</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>Screen Share</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>Mute (toggles / time)</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>Deaf (toggles / time)</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>กำลังทำอะไร</Typography></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filtered.map((r) => {
              const stat = dailyRows[r.discordUserId];
              const displayName = r.discordName || r.username;

              return (
                <TableRow key={r.discordUserId} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected(r.discordUserId)}
                      onChange={() => toggleOne(r.discordUserId)}
                      sx={{ color: "white" }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "white" }}>
                      <Avatar src={r.avatarUrl || undefined} sx={{ width: 28, height: 28, fontSize: 12 }}>
                        {(displayName?.[0] || "?").toUpperCase()}
                      </Avatar>

                      <Stack spacing={0}>
                        <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>{displayName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, color: "white" }}>
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
                      <Typography variant="body2" sx={{ color: "#FFF" }}>-</Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {r.inVoice ? (
                      <Chip
                        size="small"
                        color={r.selfDeaf ? "error" : r.selfMute ? "warning" : "success"}
                        label={voiceModeLabel(r)}
                      />
                    ) : (
                      <Typography variant="body2" sx={{ color: "#FFF" }}>-</Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {r.inVoice && r.isStreaming ? (
                      <Chip size="small" color="primary" label="🖥️ Sharing" />
                    ) : (
                      <Typography variant="body2" sx={{ color: "#FFF" }}>-</Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {statsLoading ? (
                      <Typography variant="body2" color="text.secondary">...</Typography>
                    ) : stat ? (
                      <Typography variant="body2" sx={{ fontWeight: 800, color: "white" }}>
                        {stat.muteToggleCount} / {msToHMS(stat.muteDurationMs)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" sx={{ color: "#FFF" }}>0 / 0s</Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {statsLoading ? (
                      <Typography variant="body2" color="text.secondary">...</Typography>
                    ) : stat ? (
                      <Typography variant="body2" sx={{ fontWeight: 800, color: "white" }}>
                        {stat.deafToggleCount} / {msToHMS(stat.deafDurationMs)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" sx={{ color: "#FFF" }}>0 / 0s</Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {r.activities?.length ? (
                      <Stack spacing={0.25}>
                        {r.activities.slice(0, 2).map((a, idx) => (
                          <Typography key={`${r.discordUserId}-a-${idx}`} variant="body2" sx={{ fontWeight: 700, color: "#FFF" }}>
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
                      <Typography variant="body2" sx={{ color: "#FFF" }}>-</Typography>
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

       {/* Create Group */}
      <Dialog open={createOpen} onClose={() => (groupSaving ? null : setCreateOpen(false))} fullWidth maxWidth="xs">
        <DialogTitle>Create Discord Group</DialogTitle>

        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Group name"
            fullWidth
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            disabled={groupSaving}
            inputProps={{ maxLength: 80 }}
            helperText={`${groupName.trim().length}/80`}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => {
              setCreateOpen(false);
              setGroupName("");
              setGroupErr(null);
              setGroupOk(null);
            }}
            disabled={groupSaving}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={onCreateGroup} disabled={groupSaving || !groupName.trim()}>
            {groupSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
