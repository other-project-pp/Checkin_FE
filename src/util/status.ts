import { type RoundStatus } from "../types/admin.types";

export const isRosterStatus = (s: RoundStatus) =>
  ["X","XX","TX","ป่วย","กิจ","PN","KP","CL","NV"].includes(s);

export const isOffStatus = (s: RoundStatus) =>
  ["X","XX","TX","ป่วย","กิจ","PN"].includes(s);

export const isNotWorkingStatus = (s: RoundStatus) =>
  ["NV","CL"].includes(s);
