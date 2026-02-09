import { api } from "./api";
import { type LatestResponse, type CurrentRoundResponse, type CheckinTemplateResponse, 
  type UpdateCheckinTemplateResponse, type TodayScheduledRoundsResponse, type DiscordUserSnapshot,
  type DiscordVoiceStatsResponse, type DiscordVoiceChannelsResponse, type DiscordAnnounceResponse } from "../types/admin.types";

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

export async function getDashboard(
  shiftId?: string,
  page?: number,
  limit?: number,
  q?: string
) {
  const params: any = {};
  if (shiftId) params.shiftId = shiftId;
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (q && q.trim()) params.q = q.trim();

  return api.get("/admin/dashboard", { params }).then((r) => r.data);
}

export async function getDaily(shiftId?: string, date?: string, page?: number, limit?: number, q?: string) {
  const params: any = {}; 
  if (shiftId) params.shiftId = shiftId;
  if (date) params.date = date;
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (q && q.trim()) params.q = q.trim();
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

export async function getDiscordUsers(server: "0" | "1" = "0") {
  return api.get("/discord/users", { params: { server } })
    .then((r) => r.data as { ok: true; users: DiscordUserSnapshot[] });
}

export async function getDiscordSnapshots(userIds: string[]) {
  return api
    .post("/discord/snapshots", { userIds })
    .then((r) => r.data as { ok: true; byUserId: Record<string, DiscordUserSnapshot> });
}

export async function getdiscordVoiceStats(date?: string, server: "0" | "1" = "0") {
  const params: any = { server };
  if (date) params.date = date;
  return api.get("/discord/voice", { params }).then((r) => r.data as DiscordVoiceStatsResponse);
}

export async function getDiscordVoiceChannels(server: "0" | "1" = "0") {
  return api.get("/discord/voice-channels", { params: { server } })
    .then((r) => r.data as DiscordVoiceChannelsResponse);
}

export async function postDiscordAnnounce(body: { channelIds: string[]; text: string; voice: string; },  server: "0" | "1" = "0") {
   return api.post("/discord/announce", body, { params: { server } })
    .then((r) => r.data as DiscordAnnounceResponse);
}

export async function postDiscordTtsPreview(body: { text: string; voice: string; }) {
  return api.post("/discord/tts/preview", body).then((r) => r.data as { ok: true; url: string });
}

export async function getDiscordGroups(server: "0" | "1" = "0") {
  return api.get("/discord/groups", { params: { server } }).then((r) => r.data);
}

export async function postDiscordGroup(body: { name: string }, server: "0" | "1" = "0") {
   return api.post("/discord/groups", body, { params: { server } }).then((r) => r.data);
}

export async function getDiscordGroupMembers(groupId: string, server: "0" | "1" = "0") {
  return api.get(`/discord/groups/${groupId}/members`, { params: { server } }).then((r) => r.data);
}

export async function postDiscordGroupMembers(groupId: string, body: { members: Array<{ discordUserId: string; matchedUserId: string | null }> }, server: "0" | "1" = "0") {
  return api.post(`/discord/groups/${groupId}/members`, body, { params: { server } }).then((r) => r.data);
}

export async function postDiscordMoveMembers(body: { discordUserIds: string[]; targetChannelId: string }, server: "0" | "1" = "0") {
  return api.post("/discord/move-members", body, { params: { server } })
    .then((r) => r.data);
}

export async function deleteDiscordGroupMembers(groupId: string, body: { discordUserIds: string[] }, server: "0" | "1" = "0") {
  return api.delete(`/discord/groups/${groupId}/members`, { data: body, params: { server } }).then((r) => r.data);
}
