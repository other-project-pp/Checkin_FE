import { Chip } from "@mui/material";
import { type RoundStatus } from "../../types/admin.types";

type ChipColor = "success" | "warning" | "error" | "default" | "info";

type StatusMeta = {
  label: string;
  color: ChipColor;
  variant?: "filled" | "outlined";
};

export const STATUS_META: Record<RoundStatus, StatusMeta> = {
  // checkin statuses
  success: { label: "✅ ปกติ", color: "success" },
  pending: { label: "⏳ รอส่ง", color: "default", variant: "outlined" },
  late: { label: "⚠️ สาย", color: "warning" },
  absent: { label: "❌ ไม่ได้รับค่าแรง", color: "error" },
  none: { label: "-", color: "default", variant: "outlined" },

  // roster codes
  X: { label: "🟡 หยุด (X)", color: "info", variant: "outlined" },
  XX: { label: "🟡 หยุดพิเศษ (XX)", color: "info", variant: "outlined" },
  TX: { label: "🟡 หยุด(เปลี่ยนวัน) (TX)", color: "info", variant: "outlined" },

  "ป่วย": { label: "🤒 ป่วย", color: "warning" },
  "กิจ": { label: "🧾 กิจ", color: "warning" },
  PN: { label: "🏖️ พักร้อน (PN)", color: "info", variant: "outlined" },

  KP: { label: "🚫 ขาดงาน (KP)", color: "error" },
  CL: { label: "⏸️ ยังไม่เริ่มงาน (CL)", color: "default", variant: "outlined" },
  NV: { label: "👋 ออกแล้ว (NV)", color: "default", variant: "outlined" },
};

export default function StatusChip({ status }: { status: RoundStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.none;

  const variant =
    meta.variant ?? (meta.color === "default" ? "outlined" : "filled");

  return (
    <Chip
      label={meta.label}
      color={meta.color as any}
      variant={variant}
      size="small"
      sx={{ fontWeight: 800 }}
    />
  );
}
