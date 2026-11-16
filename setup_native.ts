import { AutoModerationActionType, AutoModerationRuleEventType, AutoModerationRuleTriggerType, GuildOnboardingMode,
  GuildOnboardingPromptType, PermissionFlagsBits as P, GuildVerificationLevel, GuildExplicitContentFilter, GuildDefaultMessageNotifications } from "discord.js";
import { setupError, type AutoSetup } from "./auto_setup";

const REASON = "GoR automatische Community-Einrichtung";
const DESCRIPTION = "GoR Network – gemeinsam spielen, eigene Projekte entwickeln und als Community wachsen. Alle Spiele sind willkommen.";
function list(value: any): any[] { return Array.isArray(value) ? value : value?.values ? [...value.values()] : []; }
function ids(value: any): string[] { return Array.isArray(value) ? [...value] : value?.keys ? [...value.keys()] : []; }
export function onboardingShape(input: any) {
  return JSON.stringify({ enabled: input.enabled, mode: input.mode,
    defaults: ids(input.defaultChannels ?? input.defaultChannelIds).sort(),
    prompts: list(input.prompts).map(p => ({ title: p.title, type: p.type, single: !!p.singleSelect, required: !!p.required, inOnboarding: !!p.inOnboarding,
      options: list(p.options).map(o => ({ title: o.title, description: o.description || "", roles: ids(o.roles ?? o.roleIds).sort(), channels: ids(o.channels ?? o.channelIds).sort(),
        emoji: o.emoji?.id || o.emoji?.name || o.emoji || null })) })),
  });
}
export function desiredOnboarding(channels: Record<string, string>, roles: Record<string, string>, current: any) {
  const prompts = [
    { title: "Was interessiert dich bei GoR?", type: GuildOnboardingPromptType.MultipleChoice, singleSelect: false, required: false, inOnboarding: true, options: [
      { title: "Gemeinsame Spielrunden", description: "Mitspieler finden und zusammen loslegen.", channels: [channels.mitspielersuche, channels.termine, channels["voice-lounge"]], roles: [] },
      { title: "Clone Wars Roleplay", description: "Guardians of the Republic auf Garry’s Mod.", channels: [channels["cw-start"], channels["cw-austausch"]], roles: [roles["cw-spieler"]] },
      { title: "Erst einmal umsehen", description: "Deine Auswahl kannst du später ändern.", channels: [channels.start, channels.lounge, channels.fragen], roles: [] },
    ] },
    { title: "Welche Meldungen möchtest du erhalten?", type: GuildOnboardingPromptType.MultipleChoice, singleSelect: false, required: false, inOnboarding: true, options: [
      { title: "Netzwerk", description: "Neuigkeiten aus dem gesamten Network.", channels: [channels.neuigkeiten], roles: [roles["ping-netzwerk"]] },
      { title: "Veranstaltungen", description: "Bestätigte gemeinsame Termine.", channels: [channels.termine], roles: [roles["ping-events"]] },
      { title: "Clone Wars", description: "Nachrichten aus dem Clone-Wars-Projekt.", channels: [channels["cw-start"]], roles: [roles["cw-spieler"], roles["ping-cw"]] },
      { title: "Entwicklung", description: "Freigegebene Entwicklungsberichte.", channels: [channels.neuigkeiten], roles: [roles["ping-entwicklung"]] },
    ] },
  ];
  const existing = list(current.prompts);
  const managed = prompts.map(prompt => {
    const matches = existing.filter(p => p.title === prompt.title);
    if (matches.length > 1) throw setupError("name_conflict");
    const old = matches[0];
    return { ...prompt, ...(old?.id ? { id: old.id } : {}), options: prompt.options.map(option => {
      const previous = list(old?.options).filter(o => o.title === option.title);
      return { ...option, ...(previous.length === 1 && previous[0].id ? { id: previous[0].id } : {}) };
    }) };
  });
  const extras = existing.filter(p => !prompts.some(item => item.title === p.title)).map(p => ({
    id: p.id, title: p.title, type: p.type, singleSelect: p.singleSelect, required: p.required, inOnboarding: p.inOnboarding,
    options: list(p.options).map(o => ({ id: o.id, title: o.title, description: o.description || "", roles: ids(o.roles ?? o.roleIds), channels: ids(o.channels ?? o.channelIds), emoji: o.emoji })),
  }));
  return { enabled: true, mode: GuildOnboardingMode.OnboardingDefault,
    defaultChannels: [channels.start, channels.neuigkeiten, channels.lounge, channels.vorstellungen, channels.mitspielersuche, channels.ideen, channels.fragen],
    prompts: [...managed, ...extras], reason: REASON };
}
function ruleShape(rule: any) {
  return JSON.stringify({ name: rule.name, eventType: rule.eventType, triggerType: rule.triggerType,
    metadata: { mentionTotalLimit: rule.triggerMetadata?.mentionTotalLimit, mentionRaidProtectionEnabled: !!rule.triggerMetadata?.mentionRaidProtectionEnabled },
    actions: list(rule.actions).map(a => ({ type: a.type, customMessage: a.metadata?.customMessage || null, channelId: a.metadata?.channelId || null, durationSeconds: a.metadata?.durationSeconds || null })),
    enabled: rule.enabled, exemptRoles: ids(rule.exemptRoles).sort(), exemptChannels: ids(rule.exemptChannels).sort() });
}
export async function reconcileNative(setup: AutoSetup) {
  const { guild, maps, application } = setup.ctx;
  await setup.step("guild:profile", async () => {
    const me = await guild.members.fetchMe(), patch: Record<string, any> = {};
    if (!me.permissions.has(P.ManageGuild)) throw setupError("missing_permissions");
    if (guild.name !== "GoR Network" && !setup.protected("guild:profile","name")) patch.name = "GoR Network";
    if (guild.afkChannelId !== maps.channels["voice-afk"]) patch.afkChannel = maps.channels["voice-afk"];
    if (guild.afkTimeout !== 300) patch.afkTimeout = 300;
    if (guild.systemChannelId !== maps.channels.lounge) patch.systemChannel = maps.channels.lounge;
    if (guild.defaultMessageNotifications !== GuildDefaultMessageNotifications.OnlyMentions) patch.defaultMessageNotifications = GuildDefaultMessageNotifications.OnlyMentions;
    if (guild.verificationLevel < GuildVerificationLevel.Low) patch.verificationLevel = GuildVerificationLevel.Low;
    if (guild.explicitContentFilter !== GuildExplicitContentFilter.AllMembers) patch.explicitContentFilter = GuildExplicitContentFilter.AllMembers;
    if (!guild.features.includes("COMMUNITY")) {
      if (!me.permissions.has(P.Administrator)) throw setupError("missing_permissions");
      patch.features = [...guild.features, "COMMUNITY"];
    }
    if (guild.rulesChannelId !== maps.channels.regeln) patch.rulesChannel = maps.channels.regeln;
    if (guild.publicUpdatesChannelId !== maps.channels["discord-updates"]) patch.publicUpdatesChannel = maps.channels["discord-updates"];
    if (guild.preferredLocale !== "de") patch.preferredLocale = "de";
    if (guild.description !== DESCRIPTION && !setup.protected("guild:profile","description")) patch.description = DESCRIPTION;
    for (const key of [maps.channels["voice-afk"], maps.channels.lounge, maps.channels.regeln, maps.channels["discord-updates"]])
      if (!setup.channels.has(key)) throw setupError("dependency_missing");
    if (!Object.keys(patch).length) { setup.report.unchanged++; return; }
    setup.journal.snapshot("guild:profile", { name: guild.name, afkChannelId: guild.afkChannelId, rulesChannelId: guild.rulesChannelId, publicUpdatesChannelId: guild.publicUpdatesChannelId, description: guild.description });
    await guild.edit({ ...patch, reason: REASON });
    const actual = await guild.fetch();
    if ((!setup.protected("guild:profile","name") && actual.name !== "GoR Network") || !actual.features.includes("COMMUNITY") || actual.rulesChannelId !== maps.channels.regeln
      || actual.publicUpdatesChannelId !== maps.channels["discord-updates"] || actual.afkChannelId !== maps.channels["voice-afk"]
      || actual.afkTimeout !== 300 || actual.systemChannelId !== maps.channels.lounge || (!setup.protected("guild:profile","description") && actual.description !== DESCRIPTION)
      || actual.preferredLocale !== "de" || actual.defaultMessageNotifications !== GuildDefaultMessageNotifications.OnlyMentions
      || actual.verificationLevel < GuildVerificationLevel.Low || actual.explicitContentFilter !== GuildExplicitContentFilter.AllMembers) throw setupError("verification_failed");
    setup.report.updated++;
  });
  await setup.step("bot:nickname", async () => {
    const me = await guild.members.fetchMe();
    if (me.nickname === "GoR · Community") { setup.report.unchanged++; return; }
    await me.setNickname("GoR · Community", REASON);
    if ((await guild.members.fetchMe({ force: true })).nickname !== "GoR · Community") throw setupError("verification_failed");
    setup.report.updated++;
  });
  await setup.step("onboarding:questions", async () => {
    if (!guild.features.includes("COMMUNITY")) throw setupError("native_unavailable");
    if (!setup.privacyReady()) throw setupError("role_safety");
    const me = await guild.members.fetchMe();
    if (!me.permissions.has([P.ManageGuild, P.ManageRoles])) throw setupError("missing_permissions");
    const current = await guild.fetchOnboarding(), desired = desiredOnboarding(maps.channels, maps.roles, current);
    for (const channel of desired.defaultChannels) if (!setup.channels.has(channel)) throw setupError("dependency_missing");
    if (onboardingShape(current) === onboardingShape(desired)) { setup.report.unchanged++; return; }
    setup.journal.snapshot("onboarding:questions", JSON.parse(onboardingShape(current)));
    await guild.editOnboarding(desired);
    if (onboardingShape(await guild.fetchOnboarding()) !== onboardingShape(desired)) throw setupError("verification_failed");
    setup.report.updated++;
  });
  await setup.step("automod:mentions", async () => {
    const rules = await guild.autoModerationRules.fetch(), stored = setup.journal.get("automod:mentions");
    const expectedName = "GoR · Erwähnungsspam";
    let rule = stored?.id ? rules.get(stored.id) : [...rules.values()].find(r => r.name === expectedName && r.creatorId === application);
    if (rule && rule.creatorId !== application) throw setupError("not_owned");
    if (rule && rule.triggerType !== AutoModerationRuleTriggerType.MentionSpam) throw setupError("resource_type");
    const external = [...rules.values()].find(r => r.triggerType === AutoModerationRuleTriggerType.MentionSpam && r.id !== rule?.id);
    if (external) { if (!external.enabled) throw setupError("external_automod"); setup.report.unchanged++; return; }
    const desired = { name: expectedName, eventType: AutoModerationRuleEventType.MessageSend, triggerType: AutoModerationRuleTriggerType.MentionSpam,
      triggerMetadata: { mentionTotalLimit: 8, mentionRaidProtectionEnabled: true }, enabled: true,
      exemptRoles: [maps.roles.networkleitung, maps.roles.communityleitung, maps.roles.moderation], exemptChannels: [],
      // Blocking only: forwarding alerts could disclose private support or finance contents.
      actions: [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Bitte verzichte auf massenhafte Erwähnungen." } }], reason: REASON };
    if (desired.exemptRoles.some(id => !setup.roles.has(id))) throw setupError("dependency_missing");
    if (!rule) {
      if (setup.ctx.allowCreate === false) throw setupError("storage_required");
      const pending = setup.journal.begin("automod:mentions");
      if (!pending.fresh) throw setupError("creation_unknown");
      rule = await guild.autoModerationRules.create(desired); setup.journal.bind("automod:mentions", rule.id); setup.report.created++;
    } else {
      setup.journal.bind("automod:mentions", rule.id);
      if (ruleShape(rule) !== ruleShape(desired)) { await guild.autoModerationRules.edit(rule.id, desired); setup.report.updated++; }
      else setup.report.unchanged++;
    }
    const actual = await guild.autoModerationRules.fetch({ autoModerationRule: rule.id, force: true });
    if (!actual || ruleShape(actual) !== ruleShape(desired)) throw setupError("verification_failed");
  });
}
