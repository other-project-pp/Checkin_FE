export type RoundStatus =
  | "success"
  | "pending"
  | "late"
  | "absent"
  | "none"
  | "X"
  | "XX"
  | "TX"
  | "กิจ"
  | "ป่วย"
  | "PN"
  | "KL"
  | "KP"
  | "CL"
  | "NV";

// Latest Page
export type LatestRow = {
  userId: string;
  name: string;
  websiteName: string;
  department: string;
  shift: string;
  profileUrl: string | null;
  round1: { status: RoundStatus; images: string[]; checkinTime: string | null; checkinId?: string | null;};
  round2: { status: RoundStatus; images: string[]; checkinTime: string | null; checkinId?: string | null; };
};

export type LatestResponse = {
  ok: boolean;
  meta: {
    shiftId: string;
    shiftName: string;
    shiftTime: string;
    round: number | null;
    startAt: string | null;
    endAt10: string | null;
  };
  counts: { success: number; pending: number; late: number; absent: number };
  rows: LatestRow[];
};

// Previous Page
export type CurrentRoundResponse = {
  ok: boolean;
  active: null | {
    shiftId: string;
    shiftName?: string | null;
    round?: number | null;
    createdAt?: string;
  };
};

// Absence Page
export type AbsenceType = "dayoff" | "sick" | "personal" | "leave";

export type AbsenceDate = { y: number; m: number; day: number };

export type AbsenceRow = {
  userId: string;
  name: string;
  profileUrl: string | null;
  websiteName: string | null;
  department: string | null;
  type: AbsenceType;
  note?: string | null;
};

export type AbsenceResponse = {
  ok: true;
  date: AbsenceDate;
  counts: { dayoff: number; sick: number; personal: number; leave: number };
  rows: AbsenceRow[];
};

// Dashboard
export type DashRow = {
  userId: string;
  name: string;
  profileUrl: string | null;
  department: string | null;
  websiteName: string | null;
  shiftId: string;
  shiftName: string;
  round1: { status: RoundStatus; images: string[]; checkinTime: string | null; checkinId?: string | null; };
  round2: { status: RoundStatus; images: string[]; checkinTime: string | null; checkinId?: string | null; };
  remark: "dayoff" | "sick" | "personal" | "leave" | null;
};

export type DashShift = {
  shiftId: string;
  shiftName: string;
  shiftTime: string;
  userCount: number;
};

export type DashboardResponse = {
  ok: true;
  meta: { serverTime: string };
  totalUsers: number;
  shifts: DashShift[];
  rows: DashRow[];
  subCounts?: SubCounts;
};

//Daily
export type DailyRow = {
  userId: string;
  name: string;
  profileUrl: string | null;
  department: string | null;
  websiteName: string | null;
  shiftId: string;
  shiftName: string;
  round1: { status: RoundStatus; images: string[]; checkinTime: string | null; checkinId?: string | null; };
  round2: { status: RoundStatus; images: string[]; checkinTime: string | null; checkinId?: string | null; };
};

export type DailyShift = {
  shiftId: string;
  shiftName: string;
  shiftTime: string;
  userCount: number;
};

export type DailyResponse = {
  ok: true;
  meta: { serverTime: string };
  totalUsers: number;
  shifts: DailyShift[];
  rows: DailyRow[];
  subCounts?: SubCounts;
};

// Sub Counts
export type SubCounts = {
  submitted: number;
  notSubmitted: number;
  late: number;
  notPaid: number;
  offTotal: number;
  off: { X: number; XX: number; TX: number; personal: number; sick: number; PN: number; KL: number };
  KP: number;
  CL: number;
};

//Checkin Template
export type CheckinTemplateResponse = {
  ok: boolean;
  data: {
    key: "default";
    template: string | null;
    updatedAt: string | null;
  };
};

export type UpdateCheckinTemplateResponse = {
  ok: boolean;
  data: any;
};

// ===== Settings: Today Scheduled Rounds =====
export type ScheduledRoundStatus = "pending" | "sent" | "skipped" | "cancelled" | "error" | string;

export type ScheduledRoundItem = {
  _id: string;
  round: 1 | 2;
  sendAt: string;       // ISO string
  windowEndAt: string;  // ISO string
  status: ScheduledRoundStatus;
};

export type TodayScheduledRoundsItem = {
  shiftName: string;
  sessionDate: string; // "YYYY-MM-DD"
  rounds: ScheduledRoundItem[];
};

export interface TodayScheduledRoundsResponse {
  ok: boolean;
  date: string;
  prevDate: string;
  nextDate: string;
  days: { date: string; items: TodayScheduledRoundsItem[] }[];
}
