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
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCheckinTemplate,
  updateCheckinTemplate,
  getTodayScheduledRounds,
} from "../services/adminservice";
import type {
  CheckinTemplateResponse,
  TodayScheduledRoundsResponse,
  TodayScheduledRoundsItem,
  ScheduledRoundItem,
} from "../types/admin.types";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

function fmtTimeBkk(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

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

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  if (loading && !tplData && !schedData) return <CircularProgress />;
  if (err) return <Alert severity="error">{err}</Alert>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
        <Typography fontWeight={900} fontSize={18}>
          การตั้งค่า
        </Typography>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={load} disabled={loading || saving}>
            รีเฟรช
          </Button>
          <Button variant="contained" onClick={onSave} disabled={!dirty || saving}>
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

                        <TableCell>
                          {r1 ? (
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                              <Chip size="small" label={`${fmtTimeBkk(r1.sendAt)} - ${fmtTimeBkk(r1.windowEndAt)}`} />
                              <StatusChip status={r1.status} />
                            </Stack>
                          ) : (
                            "-"
                          )}
                        </TableCell>

                        <TableCell>
                          {r2 ? (
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                              <Chip size="small" label={`${fmtTimeBkk(r2.sendAt)} - ${fmtTimeBkk(r2.windowEndAt)}`} />
                              <StatusChip status={r2.status} />
                            </Stack>
                          ) : (
                            "-"
                          )}
                        </TableCell>
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
