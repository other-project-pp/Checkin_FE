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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { useEffect, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import StatusChip from "../components/common/StatusChip";
import ImageThumbStack from "../components/common/ImageThumbStack";
import { getDashboard, getCheckinImages } from "../services/adminservice";
import { type DashboardResponse, type RoundStatus, type DashRow, type WebsiteFilter } from "../types/admin.types";
import { WEBSITE_OPTIONS } from "../types/admin.types";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import * as XLSX from "xlsx";

type StatusFilter =
  | "ALL"
  | "submitted"
  | "notSubmitted"
  | "late"
  | "notPaid"
  | "off"
  | "KP"
  | "CL";

const fmtNow = (d: Date) =>
  d.toLocaleString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const fmtHHmm = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
};
const fileDate = (d: Date) => d.toLocaleDateString("en-CA");

const remarkText = (
  remark: "dayoff" | "sick" | "personal" | "leave" | null,
  r1: RoundStatus,
  r2: RoundStatus
) => {
  if (remark === "dayoff") return "DAYOFF";
  if (remark === "personal") return "PERSONAL";
  if (remark === "sick") return "SICK";
  if (remark === "leave") return "LEAVE";

  const s = [r1, r2];
  if (s.includes("absent")) return "ABSENT";
  if (s.includes("late")) return "LATE";
  if (r1 === "success" && r2 === "success") return "SUCCESS";
  return "-";
};

const exportExcel = (rows: DashRow[]) => {
  const today = fileDate(new Date());
  const filename = `${today}_checkin.xlsx`;

  const exportRows = rows.map((r) => ({
    name: r.name,
    website: r.websiteName || "-",
    round1_status: r.round1.status,
    round1_time: fmtHHmm(r.round1.checkinTime) || "-",
    round2_status: r.round2.status,
    round2_time: fmtHHmm(r.round2.checkinTime) || "-",
    remark: remarkText(r.remark, r.round1.status, r.round2.status),
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "checkin");

  XLSX.writeFile(wb, filename);
};

function getRemarkChip(
  remark: "dayoff" | "sick" |  "personal" | "leave" | null,
  r1: RoundStatus,
  r2: RoundStatus
) {
  if (remark === "dayoff") return <Chip size="small" label="วันหยุด" color="warning" />;
  if (remark === "personal") return <Chip size="small" label="กิจ" color="warning" />;
  if (remark === "sick") return <Chip size="small" label="ป่วย" color="warning" />;
  if (remark === "leave") return <Chip size="small" label="ลา" color="warning" />;

  
  const s = [r1, r2];

  if (s.includes("absent")) return <Chip size="small" label="ขาดงาน" color="error" />;
  if (s.includes("late")) return <Chip size="small" label="สาย" color="warning" />;

  if (r1 === "success" && r2 === "success")
    return <Chip size="small" label="สำเร็จ" color="success" />;

  return <Typography variant="body2" color="text.secondary">-</Typography>;
}

export default function DashboardPage() {
  const [now, setNow] = useState(() => new Date());
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openCompare, setOpenCompare] = useState(false);
  const [compareRow, setCompareRow] = useState<DashRow | null>(null);
  const [r1Idx, setR1Idx] = useState(0);
  const [r2Idx, setR2Idx] = useState(0);

  const [compareLoading, setCompareLoading] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState<WebsiteFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const firstImg = (imgs?: string[] | null) => (imgs && imgs.length ? imgs[0] : null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const toggleStatus = (v: StatusFilter) => {
    setStatusFilter((prev) => (prev === v ? "ALL" : v));
  };

  useEffect(() => {
  let alive = true;

  (async () => {
    setLoading(true);
    setErr(null);
    try {
      const apiPage = page + 1;
      const d = await getDashboard(selectedShiftId || undefined, apiPage, rowsPerPage, searchQuery || undefined);
      if (alive) setData(d);
    } catch (e: any) {
      if (alive) {
        setErr(e?.message || "Failed to load");
        setData(null);
      }
    } finally {
      if (alive) setLoading(false);
    }
  })();

  return () => {
    alive = false;
  };
}, [selectedShiftId, page, rowsPerPage, searchQuery]);

   useEffect(() => {
    setPage(0);
  }, [selectedShiftId, selectedWebsite, statusFilter, searchQuery]);

  useEffect(() => {
    setSelectedWebsite("ALL");
  }, [selectedShiftId]);

  useEffect(() => {
    setStatusFilter("ALL");
  }, [selectedShiftId, selectedWebsite]);

  const doSearch = () => {
    setPage(0);
    setSearchQuery(searchText.trim());
  };

  const handleOpenCompare = async (row: DashRow) => {
    setCompareRow(row);
    setR1Idx(0);
    setR2Idx(0);
    setOpenCompare(true);
    setCompareLoading(true);
    try {
      const [r1Full, r2Full] = await Promise.all([
        row.round1.checkinId ? getCheckinImages(row.round1.checkinId) : Promise.resolve({ ok: true, images: [] }),
        row.round2.checkinId ? getCheckinImages(row.round2.checkinId) : Promise.resolve({ ok: true, images: [] }),
      ]);

      setCompareRow((prev) =>
        prev
          ? {
              ...prev,
              round1: { ...prev.round1, images: r1Full.images || prev.round1.images || [] },
              round2: { ...prev.round2, images: r2Full.images || prev.round2.images || [] },
            }
          : prev
      );
    } finally {
      setCompareLoading(false);
    }
  };

  const handleCloseCompare = () => {
    setOpenCompare(false);
    setCompareRow(null);
  };

  const rows = data?.rows || [];

  const websiteRows = rows.filter((r) => {
    if (selectedWebsite  === "ALL") return true;
    return String(r.websiteName  || "").toUpperCase() === selectedWebsite;
  });

  // (B) decide current round (same idea as BE: if any user has round2 started, treat as round2)
  const isRealRoundStatus = (s: RoundStatus) =>
    s === "success" || s === "pending" || s === "late" || s === "absent";

  const round2Started = websiteRows.some(
    (r) => isRealRoundStatus(r.round2.status) || !!r.round2.checkinId
  );
  const currentRound = round2Started ? 2 : 1;

  const curRound = (r: DashRow) => (currentRound === 2 ? r.round2 : r.round1);

  const isOffRow = (r: DashRow) => {
    if (r.remark === "dayoff" || r.remark === "sick") return true;
    const s = curRound(r).status;
    return s === "X" || s === "XX" || s === "TX" || s === "PN" || s === "KL" || s === "กิจ" || s === "ป่วย";
  };

  const finalRows = websiteRows.filter((r) => {
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

  const totalFromApi = data?.pagination?.total ?? finalRows.length;

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (e: any) => {
    const next = parseInt(e.target.value, 10);
    setRowsPerPage(next);
    setPage(0);
  };

  const ThumbRow = ({
    images,
    activeIndex,
    onPick,
  }: {
    images: string[];
    activeIndex: number;
    onPick: (idx: number) => void;
  }) => {
    if (!images?.length) return null;

    return (
      <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
        {images.map((src, idx) => (
          <Box
            key={`${src}-${idx}`}
            component="img"
            src={src}
            onClick={() => onPick(idx)}
            sx={{
              width: 54,
              height: 54,
              objectFit: "cover",
              borderRadius: 1,
              cursor: "pointer",
              border: idx === activeIndex ? "2px solid" : "1px solid",
              borderColor: idx === activeIndex ? "primary.main" : "divider",
            }}
          />
        ))}
      </Stack>
    );
  };

  if (loading && !data) return <CircularProgress />;
  if (err) return <Alert severity="error">{err}</Alert>;
  if (!data) return <Alert severity="info">ยังไม่มีข้อมูล</Alert>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* (1) Date Time + Download*/}
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Typography sx={{ fontWeight: 800, flex: 1, color: "white" }}>
            วันที่: {fmtNow(now)}
        </Typography>

        <TextField
          size="small"
          placeholder="ค้นหา (ชื่อ/เว็บไซต์/แผนก/กะ)"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              doSearch();
            }
          }}
          sx={{
            width: { xs: 200, sm: 320 },
            bgcolor: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(8px)",
            borderRadius: 2,
            "& .MuiInputBase-root": { color: "rgba(0,0,0,0.9)" },
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={doSearch} edge="end">
                  <SearchIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
            variant="contained"
            startIcon={<FileDownloadIcon />}
            onClick={() => exportExcel(finalRows)}
        >
            ส่งออกไฟล์ Excel
        </Button>
      </Stack>

      {/* (2) Shift chips */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        flexWrap="wrap"
        useFlexGap
      >
        {/* RIGHT: department dropdown */}
        <FormControl
          size="medium"
          sx={{
            minWidth: 160,
            bgcolor: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(8px)",
            borderRadius: 2,
            "& .MuiInputBase-root": { color: "rgba(0,0,0,0.9)" },
            "& .MuiInputLabel-root": { color: "rgba(0,0,0,0.75)" },
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(0,0,0,0.18)" },
          }}
        >
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

        {/* LEFT: shift chips + subCounts */}
        <Box
        sx={{
          flex: 1,
          display: "flex",
          justifyContent: "flex-start",
          bgcolor: "rgba(255,255,255,0.45)",
          backdropFilter: "blur(10px)",
          borderRadius: 2,
          p: 1,
          border: "1px solid",
          borderColor: "rgba(0,0,0,0.10)",
          overflowX: "auto",
        }}
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              label={`ทั้งหมด (${data.totalUsers})`}
              color={selectedShiftId ? "default" : "primary"}
              onClick={() => setSelectedShiftId(null)}
              clickable
              sx={{
                ...(selectedShiftId
                  ? {
                      bgcolor: "rgba(255,255,255,0.72)",
                      color: "rgba(0,0,0,0.9)",
                      fontWeight: 800,
                    }
                  : {}),
              }}
            />

            {data.shifts.map((s) => (
              <Chip
                key={s.shiftId}
                label={`${s.shiftName} - ${s.userCount}`}
                color={selectedShiftId === s.shiftId ? "primary" : "default"}
                onClick={() => setSelectedShiftId(s.shiftId)}
                clickable
                sx={{
                  ...(selectedShiftId !== s.shiftId
                    ? {
                        bgcolor: "rgba(255,255,255,0.72)",
                        color: "rgba(0,0,0,0.9)",
                        fontWeight: 800,
                      }
                    : {}),
                }}
              />
            ))}

            {data.subCounts && selectedShiftId && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  clickable
                  onClick={() => toggleStatus("submitted")}
                  variant={statusFilter === "submitted" ? "filled" : "outlined"}
                  label={`ส่งแล้ว: ${data.subCounts.submitted}`}
                  color="success"
                  sx={{
                    bgcolor: statusFilter === "notSubmitted" ? undefined : "rgba(255,255,255,0.72)",
                    color: "rgba(0,0,0,0.9)",
                    fontWeight: 800,
                    "&.MuiChip-outlined": {
                      bgcolor: "rgba(255,255,255,0.55)",
                    },
                  }}
                />
                <Chip
                  clickable
                  onClick={() => toggleStatus("notSubmitted")}
                  variant={statusFilter === "notSubmitted" ? "filled" : "outlined"}
                  label={`ยังไม่ส่ง: ${data.subCounts.notSubmitted}`}
                  sx={{
                    bgcolor: statusFilter === "notSubmitted" ? undefined : "rgba(255,255,255,0.72)",
                    color: "rgba(0,0,0,0.9)",
                    fontWeight: 800,
                    "&.MuiChip-outlined": {
                      bgcolor: "rgba(255,255,255,0.55)",
                    },
                  }}
                />
                <Chip
                  clickable
                  onClick={() => toggleStatus("late")}
                  variant={statusFilter === "late" ? "filled" : "outlined"}
                  label={`สาย: ${data.subCounts.late}`}
                  color="warning"
                  sx={{
                    bgcolor: statusFilter === "notSubmitted" ? undefined : "rgba(255,255,255,0.72)",
                    color: "rgba(0,0,0,0.9)",
                    fontWeight: 800,
                    "&.MuiChip-outlined": {
                      bgcolor: "rgba(255,255,255,0.55)",
                    },
                  }}
                />
                <Chip
                  clickable
                  onClick={() => toggleStatus("notPaid")}
                  variant={statusFilter === "notPaid" ? "filled" : "outlined"}
                  label={`ไม่ได้รับค่าแรง: ${data.subCounts.notPaid}`}
                  color="error"
                  sx={{
                    bgcolor: statusFilter === "notSubmitted" ? undefined : "rgba(255,255,255,0.72)",
                    color: "rgba(0,0,0,0.9)",
                    fontWeight: 800,
                    "&.MuiChip-outlined": {
                      bgcolor: "rgba(255,255,255,0.55)",
                    },
                  }}
                />
                <Chip
                  clickable
                  onClick={() => toggleStatus("off")}
                  variant={statusFilter === "off" ? "filled" : "outlined"}
                  label={`หยุด/ลา: ${data.subCounts.offTotal} (X:${data.subCounts.off.X}, XX:${data.subCounts.off.XX}, TX:${data.subCounts.off.TX}, กิจ:${data.subCounts.off.personal}, ป่วย:${data.subCounts.off.sick}, PN:${data.subCounts.off.PN}, ลา(KL):${data.subCounts.off.KL})`}
                  color="info"
                  sx={{
                    bgcolor: statusFilter === "notSubmitted" ? undefined : "rgba(255,255,255,0.72)",
                    color: "rgba(0,0,0,0.9)",
                    fontWeight: 800,
                    "&.MuiChip-outlined": {
                      bgcolor: "rgba(255,255,255,0.55)",
                    },
                  }}
                />
                <Chip
                  clickable
                  onClick={() => toggleStatus("KP")}
                  variant={statusFilter === "KP" ? "filled" : "outlined"}
                  label={`ขาดงาน(KP): ${data.subCounts.KP}`}
                  sx={{
                    bgcolor: statusFilter === "notSubmitted" ? undefined : "rgba(255,255,255,0.72)",
                    color: "rgba(0,0,0,0.9)",
                    fontWeight: 800,
                    "&.MuiChip-outlined": {
                      bgcolor: "rgba(255,255,255,0.55)",
                    },
                  }}
                />
                <Chip
                  clickable
                  onClick={() => toggleStatus("CL")}
                  variant={statusFilter === "CL" ? "filled" : "outlined"}
                  label={`ยังไม่เริ่มงาน(CL): ${data.subCounts.CL}`}
                  sx={{
                    bgcolor: statusFilter === "notSubmitted" ? undefined : "rgba(255,255,255,0.72)",
                    color: "rgba(0,0,0,0.9)",
                    fontWeight: 800,
                    "&.MuiChip-outlined": {
                      bgcolor: "rgba(255,255,255,0.55)",
                    },
                  }}
                />
              </Stack>
            )}
          </Stack>
      </Box>
      </Stack>

      {/* (3) Table */}
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
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>ชื่อ</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>เว็บไซต์</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>รอบ 1</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>รอบ 2</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>หมายเหตุ</Typography></TableCell>
              <TableCell><Typography fontWeight={900} sx={{ color: "white" }}>ตรวจรูป</Typography></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {finalRows.map((r) => (
              <TableRow key={r.userId} hover>
                <TableCell sx={{ fontWeight: 900 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "white" }}>
                    <Avatar src={r.profileUrl || undefined} sx={{ width: 28, height: 28, fontSize: 12 }}>
                      {r.name?.[0] || "?"}
                    </Avatar>

                    <Box>
                      <div>{r.name}</div>
                      <Typography variant="caption" color="text.secondary" sx={{ color: "white" }}>
                        {r.shiftName}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                {/* <TableCell>{r.shiftName}</TableCell> */}
                <TableCell sx={{ color: "white" }}>{r.websiteName || "-"}</TableCell>

                <TableCell>
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                      <StatusChip status={r.round1.status} />
                      <ImageThumbStack images={r.round1.images || []} checkinId={r.round1.checkinId} />
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
                      <ImageThumbStack images={r.round2.images || []} checkinId={r.round2.checkinId} />
                    </Stack>
                    {fmtHHmm(r.round2.checkinTime) ? (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {fmtHHmm(r.round2.checkinTime)}
                      </Typography>
                    ) : null}
                  </Stack>
                </TableCell>

                <TableCell>
                  {getRemarkChip(r.remark, r.round1.status, r.round2.status)}
                </TableCell>
                <TableCell>
                   <Button
                    size="small"
                    variant="outlined"
                    disabled={!r.round1.checkinId && !r.round2.checkinId}
                    onClick={() => handleOpenCompare(r)}
                    sx={{
                      minWidth: 84,
                      fontWeight: 900,
                      borderWidth: 2,

                      // ✅ make it pop on glass background
                      bgcolor: "rgba(255, 255, 255, 0.87)",
                      backdropFilter: "blur(6px)",
                      color: "rgba(29, 108, 211, 0.9)",
                      borderColor: "rgba(0,0,0,0.45)",

                      "&:hover": {
                        bgcolor: "rgba(255,255,255,0.92)",
                        borderColor: "rgba(29, 108, 211, 0.9)",
                      },

                      // ✅ disabled still visible (but clearly disabled)
                      "&.Mui-disabled": {
                        bgcolor: "rgba(255,255,255,0.45)",
                        color: "rgba(0,0,0,0.45)",
                        borderColor: "rgba(0,0,0,0.20)",
                      },
                    }}
                  >
                    Check
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Paper
        variant="outlined"
        sx={{
          mt: 1,
          borderRadius: 2,
          bgcolor: "rgba(255,255,255,0.65)",
          backdropFilter: "blur(6px)",
        }}
      >
        <TablePagination
          component="div"
          count={totalFromApi}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[20, 50, 100]}
          labelRowsPerPage="แสดงต่อหน้า"
        />
      </Paper>

      {/* (4) Compare Dialog */}
      <Dialog
        open={openCompare}
        onClose={handleCloseCompare}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          ตรวจรูป: {compareRow?.name || "-"}{" "}
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {compareRow?.shiftName || ""}
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          {compareLoading ? (
            <Stack alignItems="center" py={4}><CircularProgress /></Stack>
          ) : 
          !compareRow ? (
            <Alert severity="info">ยังไม่มีข้อมูล</Alert>
          ) : (
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems="stretch"
            >
              {/* Left: Round 1 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={900} sx={{ mb: 1 }}>
                  รอบ 1 {fmtHHmm(compareRow.round1.checkinTime) ? `• ${fmtHHmm(compareRow.round1.checkinTime)}` : ""}
                </Typography>

                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 1,
                    mb: 1,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: 260,
                  }}
                >
                  {compareRow.round1.images?.length ? (
                    <Box
                      component="img"
                      src={compareRow.round1.images[r1Idx] || firstImg(compareRow.round1.images) || ""}
                      sx={{
                        width: "100%",
                        maxHeight: 460,
                        objectFit: "contain",
                        borderRadius: 1,
                      }}
                    />
                  ) : (
                    <Typography color="text.secondary">ไม่มีรูป</Typography>
                  )}
                </Box>

                <ThumbRow
                  images={compareRow.round1.images || []}
                  activeIndex={r1Idx}
                  onPick={setR1Idx}
                />
              </Box>

              <Divider flexItem orientation="vertical" sx={{ display: { xs: "none", md: "block" } }} />
              <Divider sx={{ display: { xs: "block", md: "none" } }} />

              {/* Right: Round 2 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={900} sx={{ mb: 1 }}>
                  รอบ 2 {fmtHHmm(compareRow.round2.checkinTime) ? `• ${fmtHHmm(compareRow.round2.checkinTime)}` : ""}
                </Typography>

                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 1,
                    mb: 1,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: 260,
                  }}
                >
                  {compareRow.round2.images?.length ? (
                    <Box
                      component="img"
                      src={compareRow.round2.images[r2Idx] || firstImg(compareRow.round2.images) || ""}
                      sx={{
                        width: "100%",
                        maxHeight: 460,
                        objectFit: "contain",
                        borderRadius: 1,
                      }}
                    />
                  ) : (
                    <Typography color="text.secondary">ไม่มีรูป</Typography>
                  )}
                </Box>

                <ThumbRow
                  images={compareRow.round2.images || []}
                  activeIndex={r2Idx}
                  onPick={setR2Idx}
                />
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseCompare}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
