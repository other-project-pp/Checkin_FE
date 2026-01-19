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
  Typography,
  FormControl,
  InputLabel,
  MenuItem,
  Select
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import StatusChip from "../components/common/StatusChip";
import ImageThumbStack from "../components/common/ImageThumbStack";
import { getDaily } from "../services/adminservice";
import { type DailyResponse, type RoundStatus, type DailyRow } from "../types/admin.types";

type StatusFilter =
  | "ALL"
  | "submitted"
  | "notSubmitted"
  | "late"
  | "notPaid"
  | "off"
  | "KP"
  | "CL";

const ymd = (d: Date) => d.toLocaleDateString("en-CA");

const fmtNow = (d: Date) =>
  d.toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const fmtHHmm = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
};

export default function DailyPage() {
  const [now, setNow] = useState(() => new Date());
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(() => ymd(new Date()));
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const dateOptions = (() => {
    const arr: { value: string; label: string }[] = [];
    for (let i = 0; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const v = ymd(d);
      const label = i === 0 ? `วันนี้ (${v})` : `${i} วันที่แล้ว (${v})`;
      arr.push({ value: v, label });
    }
    return arr;
  })();

  const toggleStatus = (v: StatusFilter) => {
    setStatusFilter((prev) => (prev === v ? "ALL" : v));
  };

  useEffect(() => {
    setStatusFilter("ALL");
  }, [selectedShiftId, selectedDept, selectedDate]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async (sid?: string | null) => {
    setLoading(true);
    setErr(null);
    try {
      const d = (await getDaily(sid || undefined, selectedDate)) as DailyResponse;
      setData(d);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    load(selectedShiftId);
  }, [load, selectedShiftId]);

  useEffect(() => {
    setSelectedDept("ALL");
  }, [selectedShiftId, selectedDate]);

  if (loading && !data) return <CircularProgress />;
  if (err) return <Alert severity="error">{err}</Alert>;
  if (!data) return <Alert severity="info">ยังไม่มีข้อมูล</Alert>;

  const rows = data.rows || [];
  
  const deptRows = rows.filter((r: any) => {
  if (selectedDept === "ALL") return true;
  return String(r.department || "").toUpperCase() === selectedDept;
});

const isRealRoundStatus = (s: RoundStatus) =>
  s === "success" || s === "pending" || s === "late" || s === "absent";

// ✅ round2 started only if it has real status or checkinId
const round2Started = deptRows.some((r: DailyRow) =>
  isRealRoundStatus(r.round2.status) || !!r.round2.checkinId
);

const currentRound = round2Started ? 2 : 1;
const curRound = (r: DailyRow) => (currentRound === 2 ? r.round2 : r.round1);

const isOffRow = (r: DailyRow) => {
  const s = curRound(r).status;
  return s === "X" || s === "XX" || s === "TX" || s === "PN" || s === "กิจ" || s === "ป่วย";
};

const finalRows = deptRows.filter((r: DailyRow) => {
  if (statusFilter === "ALL") return true;

  const cur = curRound(r);
  const submitted = !!cur.checkinId;

  if (statusFilter === "submitted") return submitted;
  if (statusFilter === "late") return cur.status === "late";
  if (statusFilter === "notSubmitted") return !submitted && cur.status === "pending" && !isOffRow(r);
  if (statusFilter === "notPaid") return !submitted && cur.status === "absent" && !isOffRow(r);

  if (statusFilter === "off") return isOffRow(r);
  if (statusFilter === "KP") return cur.status === "KP";
  if (statusFilter === "CL") return cur.status === "CL";

  return true;
});

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Alert severity="info" sx={{ fontWeight: 800 }}>
        สรุปรายวัน • วันที่/เวลา: {fmtNow(now)}
      </Alert>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip
          label={`ทั้งหมด (${data.totalUsers})`}
          color={selectedShiftId ? "default" : "primary"}
          onClick={() => setSelectedShiftId(null)}
          clickable
        />
        {data.shifts.map((s) => (
          <Chip
            key={s.shiftId}
            label={`${s.shiftName} - ${s.userCount}`}
            color={selectedShiftId === s.shiftId ? "primary" : "default"}
            onClick={() => setSelectedShiftId(s.shiftId)}
            clickable
          />
        ))}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
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

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="date-select-label">เลือกวันที่</InputLabel>
            <Select
              labelId="date-select-label"
              label="เลือกวันที่"
              value={selectedDate}
              onChange={(e) => setSelectedDate(String(e.target.value))}
            >
              {dateOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
        {data.subCounts && selectedShiftId && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              clickable
              onClick={() => toggleStatus("submitted")}
              variant={statusFilter === "submitted" ? "filled" : "outlined"}
              label={`ส่งแล้ว: ${data.subCounts.submitted}`}
              color="success"
            />
            <Chip
              clickable
              onClick={() => toggleStatus("notSubmitted")}
              variant={statusFilter === "notSubmitted" ? "filled" : "outlined"}
              label={`ยังไม่ส่ง: ${data.subCounts.notSubmitted}`}
            />
            <Chip
              clickable
              onClick={() => toggleStatus("late")}
              variant={statusFilter === "late" ? "filled" : "outlined"}
              label={`สาย: ${data.subCounts.late}`}
              color="warning"
            />
            <Chip
              clickable
              onClick={() => toggleStatus("notPaid")}
              variant={statusFilter === "notPaid" ? "filled" : "outlined"}
              label={`ไม่ได้รับค่าแรง: ${data.subCounts.notPaid}`}
              color="error"
            />
            <Chip
              clickable
              onClick={() => toggleStatus("off")}
              variant={statusFilter === "off" ? "filled" : "outlined"}
              label={`หยุด/ลา: ${data.subCounts.offTotal} (X:${data.subCounts.off.X}, XX:${data.subCounts.off.XX}, TX:${data.subCounts.off.TX}, กิจ:${data.subCounts.off.personal}, ป่วย:${data.subCounts.off.sick}, PN:${data.subCounts.off.PN})`}
              color="info"
            />
            <Chip
              clickable
              onClick={() => toggleStatus("KP")}
              variant={statusFilter === "KP" ? "filled" : "outlined"}
              label={`ขาดงาน(KP): ${data.subCounts.KP}`}
            />
            <Chip
              clickable
              onClick={() => toggleStatus("CL")}
              variant={statusFilter === "CL" ? "filled" : "outlined"}
              label={`ยังไม่เริ่มงาน(CL): ${data.subCounts.CL}`}
            />
          </Stack>
        )}
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><Typography fontWeight={900}>ชื่อ</Typography></TableCell>
              <TableCell><Typography fontWeight={900}>เว็บไซต์</Typography></TableCell>
              <TableCell><Typography fontWeight={900}>กะ</Typography></TableCell>
              <TableCell><Typography fontWeight={900}>รอบ 1</Typography></TableCell>
              <TableCell><Typography fontWeight={900}>รอบ 2</Typography></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {finalRows.map((r) => (
              <TableRow key={r.userId} hover>
                <TableCell sx={{ fontWeight: 900 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar src={r.profileUrl || undefined} sx={{ width: 28, height: 28, fontSize: 12 }}>
                      {r.name?.[0] || "?"}
                    </Avatar>
                    <span>{r.name}</span>
                  </Stack>
                </TableCell>

                <TableCell>{r.websiteName || "-"}</TableCell>
                <TableCell>{r.shiftName}</TableCell>

                <TableCell>
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                      <StatusChip status={r.round1.status} />
                      <ImageThumbStack images={r.round1.images || []} checkinId={r.round1.checkinId}/>
                    </Stack>
                    {fmtHHmm(r.round1.checkinTime) ? (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {fmtHHmm(r.round1.checkinTime)}
                      </Typography>
                    ) : null}
                  </Stack>
                </TableCell>

                <TableCell>
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                      <StatusChip status={r.round2.status} />
                      <ImageThumbStack images={r.round2.images || []} checkinId={r.round2.checkinId}/>
                    </Stack>
                    {fmtHHmm(r.round2.checkinTime) ? (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {fmtHHmm(r.round2.checkinTime)}
                      </Typography>
                    ) : null}
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
