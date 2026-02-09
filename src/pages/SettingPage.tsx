import {
  Alert,
  Box,
  Button,
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
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Checkbox,
  ListItemText,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCheckinTemplate,
  updateCheckinTemplate,
  getTodayScheduledRounds,
  updateScheduledRoundTime,
  getDiscordVoiceChannels,
  postDiscordAnnounce,
  postDiscordTtsPreview,
} from "../services/adminservice";
import type {
  CheckinTemplateResponse,
  TodayScheduledRoundsResponse,
  TodayScheduledRoundsItem,
  ScheduledRoundItem,
} from "../types/admin.types";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { DiscordVoiceChannel } from "../types/admin.types";

function fmtTimeBkk(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const VOICE_OPTIONS = [
  { value: "th-TH-PremwadeeNeural", label: "Thai - Premwadee" },
  { value: "th-TH-NiwatNeural", label: "Thai - Niwat" },
  { value: "en-US-PhoebeMultilingualNeural", label: "EN - Phoebe (Multi)" },
  { value: "en-US-DerekMultilingualNeural", label: "EN - Derek (Multi)" },
] as const;

function StatusChip({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  if (s === "pending") return <Chip size="small" label="pending" color="warning" />;
  if (s === "sent") return <Chip size="small" label="sent" color="success" />;
  if (s === "skipped" || s === "cancelled") return <Chip size="small" label={status} color="default" />;
  if (s === "error") return <Chip size="small" label="error" color="error" />;
  return <Chip size="small" label={status || "-"} variant="outlined" />;
}

function getRound(rounds: ScheduledRoundItem[], n: 1 | 2) {
  return rounds.find((r) => Number(r.round) === n) || null;
}

export default function SettingsPage() {
  const [tplData, setTplData] = useState<CheckinTemplateResponse | null>(null);
  const [tplText, setTplText] = useState("");
  const [schedData, setSchedData] = useState<TodayScheduledRoundsResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [voiceChannels, setVoiceChannels] = useState<DiscordVoiceChannel[]>([]);
  const [vcLoading, setVcLoading] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [announceSending, setAnnounceSending] = useState(false);
  const [announceErr, setAnnounceErr] = useState<string | null>(null);
  const [announceOk, setAnnounceOk] = useState<string | null>(null);

  const [voiceModel, setVoiceModel] = useState<string>(VOICE_OPTIONS[0].value);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [discordServer, setDiscordServer] = useState<"0" | "1">("0");


  const dirty = useMemo(() => {
    const server = tplData?.data?.template ?? "";
    return tplText.trim() !== String(server).trim();
  }, [tplData, tplText]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setOkMsg(null);
    try {
      const [tpl, sched] = await Promise.all([getCheckinTemplate(), getTodayScheduledRounds()]);
      setTplData(tpl);
      setTplText(tpl.data?.template ?? "");
      setSchedData(sched);
      setSelectedDate(sched.date);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setTplData(null);
      setSchedData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const currentSched = useMemo(() => {
    if (!schedData || !selectedDate) return null;
    return schedData.days?.find((d) => d.date === selectedDate) || null;
  }, [schedData, selectedDate]);

  const goPrev = useCallback(() => {
    if (!schedData || !selectedDate) return;
    if (selectedDate === schedData.nextDate) setSelectedDate(schedData.date);
    else if (selectedDate === schedData.date) setSelectedDate(schedData.prevDate);
  }, [schedData, selectedDate]);

  const goNext = useCallback(() => {
    if (!schedData || !selectedDate) return;
    if (selectedDate === schedData.prevDate) setSelectedDate(schedData.date);
    else if (selectedDate === schedData.date) setSelectedDate(schedData.nextDate);
  }, [schedData, selectedDate]);

  const onPreviewVoice = useCallback(async () => {
    setAnnounceErr(null);
    setAnnounceOk(null);

    const text = announceText.trim();
    if (!text) {
      setAnnounceErr("Please type some text to preview.");
      return;
    }

    try {
      setPreviewLoading(true);
      const res = await postDiscordTtsPreview({ text: "Hello", voice: voiceModel });
      const audio = new Audio(res.url);
      await audio.play();
    } catch (e: any) {
      setAnnounceErr(e?.message || "Preview failed (TTS not configured yet).");
    } finally {
      setPreviewLoading(false);
    }
  }, [announceText, voiceModel]);

  const onSave = useCallback(async () => {
    setSaving(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await updateCheckinTemplate(tplText);
      if (!res?.ok) throw new Error("Save failed");
      setOkMsg("บันทึกข้อความสำเร็จ");
      // reload to get updatedAt + server truth
      const tpl = await getCheckinTemplate();
      setTplData(tpl);
      setTplText(tpl.data?.template ?? "");
    } catch (e: any) {
      setErr(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [tplText]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setEditId(null);
  }, [selectedDate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setVcLoading(true);
        const res = await getDiscordVoiceChannels(discordServer);
        if (!alive) return;
        setVoiceChannels(res.channels || []);
      } catch {
        if (!alive) return;
        setVoiceChannels([]);
      } finally {
        if (alive) setVcLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [discordServer]);

  useEffect(() => {
    setSelectedChannelIds([]);
  }, [discordServer]);

   const onAnnounce = useCallback(async () => {
    setAnnounceErr(null);
    setAnnounceOk(null);

    const text = announceText.trim();
    if (!selectedChannelIds.length) {
      setAnnounceErr("Please select at least one voice channel.");
      return;
    }
    if (!text) {
      setAnnounceErr("Please type announcement text.");
      return;
    }
    if (text.length > 3000) {
      setAnnounceErr("Text too long (max 3000 characters).");
      return;
    }

    try {
      setAnnounceSending(true);
      const res = await postDiscordAnnounce({ channelIds: selectedChannelIds, text, voice: voiceModel }, discordServer);
      if ((res as any).ok) {
        setAnnounceOk("Announce requested.");
      } else {
        setAnnounceErr((res as any).message || "Announce failed.");
      }
    } catch (e: any) {
      setAnnounceErr(e?.message || "Announce failed.");
    } finally {
      setAnnounceSending(false);
    }
  }, [announceText, selectedChannelIds]);

  if (loading && !tplData && !schedData) return <CircularProgress />;
  if (err) return <Alert severity="error">{err}</Alert>;

  const renderRoundCell = (r: ScheduledRoundItem | null) => {
    if (!r) return "-";

    const isPending = String(r.status || "").toLowerCase() === "pending";
    const isEditing = editId === r._id;

    return (
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {!isEditing ? (
          <>
            <Chip size="small" label={`${fmtTimeBkk(r.sendAt)} - ${fmtTimeBkk(r.windowEndAt)}`} />
            <StatusChip status={r.status} />

            {/* ✅ show only when pending */}
            {isPending ? (
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setEditId(r._id);
                  setEditTime(fmtTimeBkk(r.sendAt));
                  setErr(null);
                  setOkMsg(null);
                }}
              >
                EDIT
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <TextField
              size="small"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              placeholder="HH:mm"
              sx={{ width: 90 }}
              inputProps={{ inputMode: "numeric" }}
            />

            <Button
              size="small"
              variant="contained"
              disabled={editSaving}
              onClick={async () => {
                try {
                  setEditSaving(true);
                  setErr(null);
                  setOkMsg(null);

                  const res = await updateScheduledRoundTime(r._id, editTime);
                  if (!res?.ok) throw new Error(res?.message || "Update failed");

                  setOkMsg("อัปเดตเวลาแล้ว");
                  setEditId(null);

                  // reload schedules
                  const sched = await getTodayScheduledRounds();
                  setSchedData(sched);
                } catch (e: any) {
                  setErr(e?.message || "Update failed");
                } finally {
                  setEditSaving(false);
                }
              }}
            >
              SAVE
            </Button>

            <Button
              size="small"
              variant="text"
              disabled={editSaving}
              onClick={() => setEditId(null)}
            >
              CANCEL
            </Button>
          </>
        )}
      </Stack>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
        <Typography fontWeight={900} fontSize={20} sx={{ color: "white" }}>
          การตั้งค่า
        </Typography>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={load} disabled={loading || saving} sx={{ color: "white", borderColor: "white" }}>
            รีเฟรช
          </Button>
          <Button variant="contained" onClick={onSave} disabled={!dirty || saving} sx={{ color: "white" }}>
            {saving ? "บันทึกข้อความ..." : "บันทึกข้อความ"}
          </Button>
        </Stack>
      </Stack>

      {okMsg ? <Alert severity="success">{okMsg}</Alert> : null}

      {/* Template Editor */}
      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
        <Stack spacing={1}>
          <Typography fontWeight={900}>รูปแบบข้อความ</Typography>
          <TextField
            value={tplText}
            onChange={(e) => setTplText(e.target.value)}
            multiline
            minRows={14}
            fullWidth
            placeholder="Template..."
          />
        </Stack>
        <Typography variant="body2" color="red">
            โปรดอย่าแก้ไข: {"{SHIFT_LABEL} {SHIFT_START} {SHIFT_END} {ROUND} {WIN_START} {WIN_END}"}
          </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Typography fontWeight={900}>ประกาศเสียง Discord</Typography>

            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="discord-server-label">SELECT</InputLabel>
                <Select
                  labelId="discord-server-label"
                  label="Server"
                  value={discordServer}
                  onChange={(e) => setDiscordServer(e.target.value as "0" | "1")}
                >
                  <MenuItem value="0">789BET</MenuItem>
                  <MenuItem value="1">JUN88</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                onClick={async () => {
                  try {
                    setAnnounceErr(null);
                    setAnnounceOk(null);
                    setVcLoading(true);
                    const res = await getDiscordVoiceChannels(discordServer);
                    setVoiceChannels(res.channels || []);
                  } catch (e: any) {
                    setAnnounceErr(e?.message || "Failed to load voice channels");
                  } finally {
                    setVcLoading(false);
                  }
                }}
                disabled={vcLoading || announceSending}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>

          {announceOk ? <Alert severity="success">{announceOk}</Alert> : null}
          {announceErr ? <Alert severity="error">{announceErr}</Alert> : null}

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-start" }}>
            <TextField
              label="ข้อความประกาศ"
              placeholder="พิมพ์ประกาศ..."
              value={announceText}
              onChange={(e) => setAnnounceText(e.target.value)}
              multiline
              minRows={3}
              fullWidth
              helperText={`${announceText.length}/3000`}
              error={announceText.length > 3000}
              sx={{ flex: 2 }}
            />

            <FormControl size="small" sx={{ minWidth: 320, flex: 1 }}>
              <InputLabel id="voice-channels-label">Channels</InputLabel>
              <Select
                labelId="voice-channels-label"
                multiple
                value={selectedChannelIds}
                label="Voice Channels"
                onChange={(e) => setSelectedChannelIds(e.target.value as string[])}
                renderValue={(selected) => {
                  const names = voiceChannels
                    .filter((c) => selected.includes(c.id))
                    .map((c) => (c.parentName ? `${c.parentName} / ${c.name}` : c.name));
                  return names.join(", ");
                }}
              >
                {vcLoading ? (
                  <MenuItem disabled>Loading...</MenuItem>
                ) : voiceChannels.length ? (
                  voiceChannels.map((c) => {
                    const label = c.name;
                    const checked = selectedChannelIds.includes(c.id);
                    return (
                      <MenuItem key={c.id} value={c.id}>
                        <Checkbox checked={checked} />
                        <ListItemText primary={label} />
                      </MenuItem>
                    );
                  })
                ) : (
                  <MenuItem disabled>No voice channels</MenuItem>
                )}
              </Select>

              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Selected: {selectedChannelIds.length}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {selectedChannelIds.length ? (
                    voiceChannels
                      .filter((c) => selectedChannelIds.includes(c.id))
                      .map((c) => {
                        const label = c.parentName ? `${c.parentName} / ${c.name}` : c.name;
                        return <Chip key={c.id} size="small" label={label} />;
                      })
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      ไม่ได้เลือกช่องสัญญาณใดๆ
                    </Typography>
                  )}
                </Stack>
              </Box>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="voice-model-label">Voice</InputLabel>
              <Select
                labelId="voice-model-label"
                value={voiceModel}
                label="Voice"
                onChange={(e) => setVoiceModel(String(e.target.value))}
              >
                {VOICE_OPTIONS.map((v) => (
                  <MenuItem key={v.value} value={v.value}>
                    {v.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<VolumeUpIcon />}
              onClick={onPreviewVoice}
              disabled={previewLoading || !announceText.trim()}
            >
              {previewLoading ? "Previewing..." : "Preview Voice"}
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              variant="contained"
              onClick={onAnnounce}
              disabled={announceSending || vcLoading || !selectedChannelIds.length || !announceText.trim() || announceText.length > 3000}
            >
              {announceSending ? "Announcing..." : "Announce"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Today schedule from cron */}
      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={900}>ตารางเวลาลงชื่อเข้างาน (Generated)</Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                onClick={goPrev}
                disabled={loading || saving || !schedData || selectedDate === schedData.prevDate}
                size="small"
              >
                <ChevronLeftIcon />
              </IconButton>

              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110, textAlign: "center" }}>
                {selectedDate ?? "-"}
              </Typography>

              <IconButton
                onClick={goNext}
                disabled={loading || saving || !schedData || selectedDate === schedData.nextDate}
                size="small"
              >
                <ChevronRightIcon />
              </IconButton>
            </Stack>
          </Stack>

          {!currentSched?.items?.length ? (
            <Alert severity="info">ยังไม่มี schedule ในวันนี้ (หรือ cron ยังไม่ได้ generate)</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><Typography fontWeight={900}>กะ</Typography></TableCell>
                    <TableCell><Typography fontWeight={900}>รอบที่ 1</Typography></TableCell>
                    <TableCell><Typography fontWeight={900}>รอบที่ 2</Typography></TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {currentSched.items.map((it: TodayScheduledRoundsItem) => {
                    const r1 = getRound(it.rounds, 1);
                    const r2 = getRound(it.rounds, 2);

                    return (
                      <TableRow key={it.shiftName} hover>
                        <TableCell sx={{ fontWeight: 900 }}>{it.shiftName}</TableCell>

                        <TableCell>{renderRoundCell(r1)}</TableCell>

                        <TableCell>{renderRoundCell(r2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
