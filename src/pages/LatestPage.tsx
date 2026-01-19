import {
  Alert,
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  Avatar,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useEffect, useState, useCallback, useRef } from "react";
import StatusChip from "../components/common/StatusChip";
import ImageThumbStack from "../components/common/ImageThumbStack";
import { getLatest, getCurrentRound } from "../services/adminservice";
import { type LatestResponse } from "../types/admin.types";
import { useAppState } from "../context/AppContext";
import { getSocket } from "../services/socket";

type StatusFilter = "ALL" | "success" | "pending" | "late" | "absent";

export default function LatestPage() {
  const { activeShiftId, setActiveShiftId } = useAppState();
  const [data, setData] = useState<LatestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");

  const loadingRef = useRef(false);

  const toggleStatus = (s: StatusFilter) => {
    setStatusFilter((prev) => (prev === s ? "ALL" : s));
  };

  const fmtHHmm = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("th-TH", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pickShiftId = (cur: any) =>
    cur?.meta?.shiftId || cur?.shiftId || cur?.active?.shiftId || null;

  const loadByShift = useCallback(async (shiftId: string) => {
    if (!shiftId) return;
    if (loadingRef.current) return;
    loadingRef.current = true;

    setLoading(true);
    setErr(null);
    try {
      const d = await getLatest(shiftId);
      setData(d);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  const syncFromCurrentRound = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);

      const cur: any = await getCurrentRound();

      const shiftId = pickShiftId(cur);
      if (!shiftId) {
        setData(null);
        setLoading(false);
        return;
      }

      setActiveShiftId(shiftId);

      const s = getSocket();
      s.emit("joinDashboards");
      s.emit("joinShift", shiftId);

      // ✅ If getCurrentRound returns LatestResponse (counts/meta/rows), bind it directly
      if (cur?.meta && cur?.counts && Array.isArray(cur?.rows)) {
        setData(cur as LatestResponse);
      } else {
        // fallback if shape differs
        await loadByShift(shiftId);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to sync");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [loadByShift, setActiveShiftId]);

  // Initial load
  useEffect(() => {
    syncFromCurrentRound();
  }, [syncFromCurrentRound]);

  // Round Start
  useEffect(() => {
    const s = getSocket();

    const onConnect = () => {
      s.emit("joinDashboards");
      syncFromCurrentRound(); // resync on reconnect
    };

    const onRoundStarted = () => {
      // ✅ exactly what you asked: when socket hits -> call getCurrentRound -> bind
      syncFromCurrentRound();
    };

    s.on("connect", onConnect);
    s.on("roundStarted", onRoundStarted);

    if (s.connected) s.emit("joinDashboards");

    return () => {
      s.off("connect", onConnect);
      s.off("roundStarted", onRoundStarted);
    };
  }, [syncFromCurrentRound]);

  useEffect(() => {
    setStatusFilter("ALL");
  }, [data?.meta?.round, activeShiftId]);

  useEffect(() => {
    setSelectedDept("ALL");
  }, [activeShiftId]);

  // Checkin (patch only the user + counts)
  useEffect(() => {
    const s = getSocket();

    const onCheckinUpdated = (payload: any) => {
      console.log("payload", payload);
      if (!activeShiftId) return;
      if (payload?.shiftId !== activeShiftId) return;

      const userId = payload?.userId;
      const roundNo = payload?.round;
      const nextImages =
      Array.isArray(payload?.thumbs) ? payload.thumbs :
      Array.isArray(payload?.images) ? payload.images :
      undefined;
      const nextCheckinId = payload?.checkinId ? String(payload.checkinId) : undefined;
      const nextCheckinTime = payload?.checkinTime ? String(payload.checkinTime) : undefined;
      const nextStatus = payload?.status as
        | "success"
        | "late"
        | "absent"
        | "pending"
        | undefined;

      if (!userId || (roundNo !== 1 && roundNo !== 2) || !nextStatus) return;

      const roundKey = roundNo === 1 ? "round1" : "round2";

      setData((prev) => {
        if (!prev) return prev;

        const idx = prev.rows.findIndex((r) => r.userId === userId);
        if (idx === -1) return prev;

        const row = prev.rows[idx];
        const prevStatus = row[roundKey]?.status;

        const updatedRow = {
          ...row,
          [roundKey]: {
            ...row[roundKey],
            status: nextStatus,
            ...(nextImages ? { images: nextImages } : {}),
            ...(nextCheckinId ? { checkinId: nextCheckinId } : {}),
            ...(nextCheckinTime ? { checkinTime: nextCheckinTime } : {}),
          },
        };

        const newRows = [...prev.rows];
        newRows[idx] = updatedRow;

        let newCounts = prev.counts;
        if (prevStatus && prevStatus !== nextStatus) {
          newCounts = { ...prev.counts } as any;
          (newCounts as any)[prevStatus] = Math.max(
            0,
            ((newCounts as any)[prevStatus] || 0) - 1
          );
          (newCounts as any)[nextStatus] = ((newCounts as any)[nextStatus] || 0) + 1;
        }

        return { ...prev, rows: newRows, counts: newCounts };
      });
    };

    s.on("checkinUpdated", onCheckinUpdated);
    return () => {
      s.off("checkinUpdated", onCheckinUpdated);
    };
  }, [activeShiftId]);

  const currentRound = data?.meta.round === 2 ? 2 : 1;
  const curRound = (r: any) => (currentRound === 2 ? r.round2 : r.round1);

  const filteredRows = data?.rows.filter((r: any) => {
    // department filter
    if (selectedDept !== "ALL") {
      if (String(r.department || "").toUpperCase() !== selectedDept) return false;
    }

    // status filter (based on current round)
    if (statusFilter !== "ALL") {
      const s = curRound(r)?.status;
      if (s !== statusFilter) return false;
    }

    return true;
  });

  if (loading && !data) return <CircularProgress />;
  if (err) return <Alert severity="error">{err}</Alert>;
  if (!data) return <Alert severity="info">ยังไม่มีข้อมูลรอบล่าสุด</Alert>;

  const timeStart = data.meta.startAt ? fmtHHmm(data.meta.startAt) : "-";
  const timeEnd = data.meta.endAt10 ? fmtHHmm(data.meta.endAt10) : "-";

  const roundText = data.meta.round ? `รอบ ${data.meta.round}` : "ยังไม่มีรอบ";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Alert severity="info" sx={{ fontWeight: 800 }}>
        {data.meta.shiftName}({data.meta.shiftTime}) • {" "}
        {roundText} - ({timeStart} to {timeEnd})
      </Alert>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" justifyContent="space-between">
        {/* left: chips */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            clickable
            onClick={() => toggleStatus("success")}
            variant={statusFilter === "success" ? "filled" : "outlined"}
            label={`Success: ${data.counts.success}`}
            color="success"
          />
          <Chip
            clickable
            onClick={() => toggleStatus("pending")}
            variant={statusFilter === "pending" ? "filled" : "outlined"}
            label={`Pending: ${data.counts.pending}`}
          />
          <Chip
            clickable
            onClick={() => toggleStatus("late")}
            variant={statusFilter === "late" ? "filled" : "outlined"}
            label={`Late: ${data.counts.late}`}
            color="warning"
          />
          <Chip
            clickable
            onClick={() => toggleStatus("absent")}
            variant={statusFilter === "absent" ? "filled" : "outlined"}
            label={`ไม่ได้รับค่าแรง: ${data.counts.absent}`}
            color="error"
          />
          <Chip
            clickable
            onClick={() => setStatusFilter("ALL")}
            variant={statusFilter === "ALL" ? "filled" : "outlined"}
            label="ทั้งหมด"
          />
        </Stack>

        {/* right: department dropdown */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="dept-select-label">แผนก</InputLabel>
          <Select
            labelId="dept-select-label"
            value={selectedDept}
            label="แผนก"
            onChange={(e) => setSelectedDept(String(e.target.value))}
          >
            <MenuItem value="ALL">ทั้งหมด</MenuItem>
            <MenuItem value="789BET">789BET</MenuItem>
            <MenuItem value="JUN88">JUN88</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 2, overflowX: "auto" }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography fontWeight={900}>ชื่อ</Typography>
              </TableCell>
              <TableCell>
                <Typography fontWeight={900}>เว็บไซต์</Typography>
              </TableCell>
              <TableCell>
                <Typography fontWeight={900}>กะ</Typography>
              </TableCell>
              <TableCell>
                <Typography fontWeight={900}>รอบ 1</Typography>
              </TableCell>
              <TableCell>
                <Typography fontWeight={900}>รอบ 2</Typography>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredRows && filteredRows.map((r) => (
              <TableRow key={r.userId} hover>
                <TableCell sx={{ fontWeight: 900 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar
                      src={r.profileUrl || undefined}
                      sx={{ width: 28, height: 28, fontSize: 12 }}
                    >
                      {r.name?.[0] || "?"}
                    </Avatar>
                    <span>{r.name}</span>
                  </Stack>
                </TableCell>
                
                <TableCell sx={{ fontWeight: 500 }}>{r.websiteName || "-"}</TableCell>

                <TableCell>{r.shift}</TableCell>

                {/* ✅ status + images side-by-side */}
                <TableCell>
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                      <StatusChip status={r.round1.status} />
                      <ImageThumbStack images={r.round1.images || []} checkinId={r.round1.checkinId}/>
                    </Stack>

                    {!!fmtHHmm(r.round1.checkinTime) && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {fmtHHmm(r.round1.checkinTime)}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>

                <TableCell>
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                      <StatusChip status={r.round2.status} />
                      <ImageThumbStack images={r.round2.images || []} checkinId={r.round2.checkinId}/>
                    </Stack>

                    {!!fmtHHmm(r.round2.checkinTime) && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {fmtHHmm(r.round2.checkinTime)}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
