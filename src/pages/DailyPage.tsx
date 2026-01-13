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
import { type DailyResponse } from "../types/admin.types";

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

  if (loading && !data) return <CircularProgress />;
  if (err) return <Alert severity="error">{err}</Alert>;
  if (!data) return <Alert severity="info">ยังไม่มีข้อมูล</Alert>;

  const rows = data.rows || [];

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

        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>เลือกวันที่</InputLabel>
          <Select
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
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
        {data.subCounts && selectedShiftId && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`ส่งแล้ว: ${data.subCounts.submitted}`} color="success" />
            <Chip label={`ยังไม่ส่ง: ${data.subCounts.notSubmitted}`} variant="outlined" />
            <Chip label={`สาย: ${data.subCounts.late}`} color="warning" />
            <Chip label={`ไม่ได้รับค่าแรง: ${data.subCounts.notPaid}`} color="error" />
            <Chip
              label={`หยุด/ลา: ${data.subCounts.offTotal} (X:${data.subCounts.off.X}, XX:${data.subCounts.off.XX}, TX:${data.subCounts.off.TX}, กิจ:${data.subCounts.off.personal}, ป่วย:${data.subCounts.off.sick}, PN:${data.subCounts.off.PN})`}
              color="info"
              variant="outlined"
            />
            <Chip label={`ขาดงาน(KP): ${data.subCounts.KP}`} variant="outlined" />
            <Chip label={`ยังไม่เริ่มงาน(CL): ${data.subCounts.CL}`} variant="outlined" />
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
            {rows.map((r) => (
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
