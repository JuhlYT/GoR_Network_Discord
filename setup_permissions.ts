import { PermissionFlagsBits as P, OverwriteType, ChannelType } from "discord.js";
import type { Profile } from "./server_blueprint";

export const READ = P.ViewChannel | P.ReadMessageHistory | P.AddReactions | P.UseApplicationCommands;
export const WRITE = P.SendMessages | P.CreatePublicThreads | P.SendMessagesInThreads | P.EmbedLinks | P.AttachFiles;
export const VOICE = P.Connect | P.Speak | P.Stream | P.UseVAD;
export const BASIC = READ | WRITE | VOICE;
export const NO_WRITE = P.SendMessages | P.CreatePublicThreads | P.CreatePrivateThreads | P.SendMessagesInThreads;
export const MOD = P.ManageMessages | P.ManageThreads;
export const PRIVATE_PROFILES = new Set<Profile>(["team", "team_read", "moderation_private", "leadership", "intake_private", "finance_private", "cw_team"]);
export const STAFF = ["networkleitung", "communityleitung", "moderation", "support", "technik", "finanzen", "eventteam", "cw-leitung", "cw-team"];
export type Overwrite = { id: string; type: number; allow: bigint; deny: bigint };

export function profileOverwrites(profile: Profile, guild: string, application: string, roles: Record<string, string>, available?: Set<string>): Overwrite[] {
  const values = new Map<string, Overwrite>();
  const put = (id: string, allow = 0n, deny = 0n, type: number = OverwriteType.Role) => {
    if (!id) throw Object.assign(new Error("Missing mapped role"), { setupCode: "dependency_missing" });
    const previous = values.get(type + ":" + id) || { id, type, allow: 0n, deny: 0n };
    values.set(type + ":" + id, { id, type, allow: (previous.allow | allow) & ~deny, deny: (previous.deny | deny) & ~allow });
  };
  const grant = (keys: string[], permissions = BASIC) => {
    for (const key of keys) {
      const id = roles[key];
      if (!id || (available && !available.has(id))) throw Object.assign(new Error("Role unavailable"), { setupCode: "dependency_missing" });
      put(id, permissions);
    }
  };
  if (profile === "public_chat") put(guild, BASIC);
  else if (profile === "waiting" || profile === "afk") {
    put(guild, READ | P.Connect | (profile === "waiting" ? WRITE : 0n), P.Speak | P.Stream);
    if (profile === "waiting") grant(["networkleitung", "communityleitung", "moderation", "support"]);
  } else if (["public_read", "events_read", "finance_public", "support_read"].includes(profile)) {
    put(guild, READ, NO_WRITE);
    grant(profile === "finance_public" ? ["networkleitung", "finanzen"] : ["networkleitung", "communityleitung",
      ...(profile === "events_read" ? ["eventteam"] : profile === "support_read" ? ["support"] : [])]);
  } else if (profile === "cw_chat" || profile === "cw_read") {
    put(guild, 0n, P.ViewChannel | (profile === "cw_read" ? NO_WRITE : 0n));
    grant(["cw-spieler"], profile === "cw_read" ? READ : BASIC);
    grant(["networkleitung", "communityleitung", "moderation", "cw-team"]); grant(["cw-leitung"], BASIC | MOD);
  } else {
    put(guild, 0n, P.ViewChannel | (profile === "team_read" ? NO_WRITE : 0n));
    if (profile === "team") grant(STAFF);
    else if (profile === "team_read") { grant(STAFF, READ); grant(["networkleitung", "communityleitung"]); }
    else if (profile === "moderation_private") grant(["networkleitung", "communityleitung", "moderation"]);
    else if (profile === "leadership") grant(["networkleitung", "communityleitung"]);
    else if (profile === "intake_private") grant(["networkleitung", "communityleitung", "technik"]);
    else if (profile === "finance_private") grant(["networkleitung", "finanzen"]);
    else if (profile === "cw_team") { grant(["networkleitung", "communityleitung", "cw-team"]); grant(["cw-leitung"], BASIC | MOD); }
    else throw Object.assign(new Error("Unknown profile"), { setupCode: "invalid_profile" });
  }
  put(application, BASIC | P.CreatePrivateThreads, 0n, OverwriteType.Member);
  return [...values.values()];
}
export function overwriteShape(values: Iterable<any>) {
  return JSON.stringify([...values].map(o => [o.id, o.type, String(o.allow?.bitfield ?? o.allow ?? 0), String(o.deny?.bitfield ?? o.deny ?? 0)])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || Number(a[1]) - Number(b[1])));
}
export function compatibleType(type: number, expected: "text" | "voice" | "category") {
  return expected === "category" ? type === ChannelType.GuildCategory : expected === "voice" ? type === ChannelType.GuildVoice
    : type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement;
}
