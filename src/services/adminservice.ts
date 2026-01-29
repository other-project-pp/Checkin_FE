import { api } from "./api";
import { type LatestResponse, type CurrentRoundResponse, type CheckinTemplateResponse, type UpdateCheckinTemplateResponse, type TodayScheduledRoundsResponse, type DiscordUserSnapshot } from "../types/admin.types";

export async function getLatest(shiftId: string) {
  const res = await api.get<LatestResponse>("/admin/latest", {
    params: { shiftId },
  });
  return res.data;
}

export async function getCurrentRound() {
  const res = await api.get<CurrentRoundResponse>("/admin/round");
  return res.data;
}

export async function getPreviousRound() {
  return api.get("/admin/previous").then((r) => r.data);
}

export async function getAbsence() {
  return api.get("/admin/absence").then((r) => r.data);
}

export async function getDashboard(shiftId?: string) {
  const params = shiftId ? { shiftId } : undefined;
  const res = api.get("/admin/dashboard", { params }).then((r) => r.data);
  console.log("res", res);
  return res;
}

export async function getDaily(shiftId?: string, date?: string) {
  const params: any = {}; 
  if (shiftId) params.shiftId = shiftId;
  if (date) params.date = date;
  return api.get("/admin/daily", { params }).then((r) => r.data);
}

export async function setTelegramHook(body: {
  botToken: string;
  botName: string;
  webhookSecret: string;
  webhookUrl: string;
}) {
  return api.post("/hook", body).then((r) => r.data);
}

export async function getCheckinImages(checkinId: string) {
  return api.get(`/admin/checkins/${checkinId}/images`).then((r) => r.data as { ok: true; images: string[] });
}

export async function getCheckinTemplate() {
  const res = await api.get<CheckinTemplateResponse>("/admin/checkin-template");
  return res.data;
}

export async function updateCheckinTemplate(template: string) {
  const res = await api.put<UpdateCheckinTemplateResponse>("/admin/checkin-template", { template });
  return res.data;
}

export async function getTodayScheduledRounds() {
  const res = await api.get<TodayScheduledRoundsResponse>("/admin/schedule");
  return res.data;
}

export async function updateScheduledRoundTime(id: string, sendAtHHmm: string) {
  const res = await api.put(`/admin/schedule/${id}/time`, {sendAtHHmm });
  return res.data;
}

export async function getDiscordUsers() {
  return api.get("/discord/users").then((r) => r.data as { ok: true; users: DiscordUserSnapshot[] });
}