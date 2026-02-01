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
import { useCallback, useEffect, useRef, useState } from "react";
import StatusChip from "../components/common/StatusChip";
import ImageThumbStack from "../components/common/ImageThumbStack";
import { getLatest } from "../services/adminservice";
import { getPreviousRound } from "../services/adminservice";
import { type LatestResponse, type WebsiteFilter } from "../types/admin.types";
import { WEBSITE_OPTIONS } from "../types/admin.types";
import { getSocket } from "../services/socket";

type StatusFilter = "ALL" | "success" | "pending" | "late" | "absent";

export default function PreviousPage() {
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [data, setData] = useState<LatestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedWebsite, setSelectedWebsite] = useState<WebsiteFilter>("ALL");

  const loadingRef = useRef(false);

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

  const toggleStatus = (s: StatusFilter) => {
    setStatusFilter((prev) => (prev === s ? "ALL" : s));
  };

  const loadByShift = useCallback(async (sid: string) => {
    if (!sid) return;
    if (loadingRef.current) return;
    loadingRef.current = true;

    setLoading(true);
    setErr(null);
    try {
      const d = await getLatest(sid);
      setData(d);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);

      const res: any = await getPreviousRound();
      const sid = res?.active?.shiftId || null;

      setShiftId(sid);
      if (!sid) {
        setData(null);
        return;
      }

      const s = getSocket();
      s.emit("joinShift", sid);

      await loadByShift(sid);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [loadByShift]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // when a new round starts, previous shift changes => reload previous
  useEffect(() => {
    const s = getSocket();

    const onConnect = () => {
      refresh();
    };

    const onRoundStarted = () => {
      refresh();
    };

    s.on("connect", onConnect);
    s.on("roundStarted", onRoundStarted);

    return () => {
      s.off("connect", onConnect);
      s.off("roundStarted", onRoundStarted);
    };
  }, [refresh]);

  useEffect(() => {
    setStatusFilter("ALL");
    setSelectedWebsite("ALL");
  }, [shiftId]);

  // patch on checkinUpdated for THIS previous shift
  useEffect(() => {
    const s = getSocket();

    const onCheckinUpdated = (payload: any) => {
      if (!shiftId) return;
      if (payload?.shiftId !== shiftId) return;

      const userId = payload?.userId;
      const roundNo = payload?.round;
      const nextStatus = payload?.status as "success" | "late" | "absent" | "pending" | undefined;
      const nextImages =
      Array.isArray(payload?.thumbs) ? payload.thumbs :
      Array.isArray(payload?.images) ? payload.images :
      undefined;

      const nextCheckinId = payload?.checkinId ? String(payload.checkinId) : undefined;

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
          },
        };

        const newRows = [...prev.rows];
        newRows[idx] = updatedRow;

        let newCounts = prev.counts;
        if (prevStatus && prevStatus !== nextStatus) {
          newCounts = { ...prev.counts } as any;
          (newCounts as any)[prevStatus] = Math.max(0, ((newCounts as any)[prevStatus] || 0) - 1);
          (newCounts as any)[nextStatus] = ((newCounts as any)[nextStatus] || 0) + 1;
        }

        return { ...prev, rows: newRows, counts: newCounts };
      });
    };

    s.on("checkinUpdated", onCheckinUpdated);
    return () => {
      s.off("checkinUpdated", onCheckinUpdated);
    };
  }, [shiftId]);

  if (loading && !data) return <CircularProgress />;
  if (err) return <Alert severity="error">{err}</Alert>;
  if (!data) return <Alert severity="info">ยังไม่มีข้อมูลรอบก่อนหน้า</Alert>;

  const currentRound = data.meta.round === 2 ? 2 : 1;
  const curRound = (r: any) => (currentRound === 2 ? r.round2 : r.round1);

  const filteredRows = (data.rows || []).filter((r: any) => {
    // department
    if (selectedWebsite !== "ALL") {
      if (String(r.websiteName || "").toUpperCase() !== selectedWebsite) return false;
    }

    // status (based on current round)
    if (statusFilter !== "ALL") {
      const s = curRound(r)?.status;
      if (s !== statusFilter) return false;
    }

    return true;
  });

  const timeStart = data.meta.startAt ? fmtHHmm(data.meta.startAt) : "-";
  const timeEnd = data.meta.endAt10 ? fmtHHmm(data.meta.endAt10) : "-";

  const roundText = data.meta.round ? `รอบ ${data.meta.round}` : "ยังไม่มีรอบ";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Alert severity="info" sx={{ fontWeight: 800 }}>
        {data.meta.shiftName}({data.meta.shiftTime}) • {" "}
        {roundText} - ({timeStart} to {timeEnd})
      </Alert>

      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        alignItems="center"
        justifyContent="space-between"
      >
        {/* left: status chips */}
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
            label={`Absent: ${data.counts.absent}`}
            color="error"
          />
          <Chip
            clickable
            onClick={() => setStatusFilter("ALL")}
            variant={statusFilter === "ALL" ? "filled" : "outlined"}
            label="ทั้งหมด"
          />
        </Stack>

        {/* right: dept dropdown */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="dept-select-label">แผนก</InputLabel>
          <Select
            labelId="dept-select-label"
            value={selectedWebsite}
            label="แผนก"
            onChange={(e) => setSelectedWebsite(e.target.value as WebsiteFilter)}
          >
            <MenuItem value="ALL">ทั้งหมด</MenuItem>
            {WEBSITE_OPTIONS.map((w) => (
              <MenuItem key={w} value={w}>
                {w}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
              <TableCell><Typography fontWeight={900}>ชื่อ</Typography></TableCell>
              <TableCell><Typography fontWeight={900}>กะ</Typography></TableCell>
              <TableCell><Typography fontWeight={900}>รอบ 1</Typography></TableCell>
              <TableCell><Typography fontWeight={900}>รอบ 2</Typography></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredRows.map((r) => (
              <TableRow key={r.userId} hover>
                <TableCell sx={{ fontWeight: 900 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar src={r.profileUrl || undefined} sx={{ width: 28, height: 28, fontSize: 12 }}>
                      {r.name?.[0] || "?"}
                    </Avatar>
                    <span>{r.name}</span>
                  </Stack>
                </TableCell>

                <TableCell>{r.shift}</TableCell>

                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                    <StatusChip status={r.round1.status} />
                    <ImageThumbStack images={r.round1.images || []} checkinId={r.round1.checkinId}/>
                  </Stack>
                </TableCell>

                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                    <StatusChip status={r.round2.status} />
                    <ImageThumbStack images={r.round2.images || []} checkinId={r.round2.checkinId}/>
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
