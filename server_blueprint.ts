/** GoR-owned layout; unrelated channels and member assignments are outside this blueprint. */
export type Profile = "public_chat" | "public_read" | "events_read" | "finance_public" | "support_read" | "cw_chat" | "cw_read" | "team" | "team_read" | "moderation_private" | "leadership" | "intake_private" | "finance_private" | "cw_team" | "waiting" | "afk";
export type RoleSpec = { key: string; name: string; color: number; hoist: boolean; selfAssignable: boolean };
export type ChannelSpec = { key: string; name: string; type: "text" | "voice"; profile: Profile; topic: string; slowmode: number };
export type CategorySpec = { key: string; name: string; profile: Profile; channels: ChannelSpec[] };
export type Layout = { roles: RoleSpec[]; categories: CategorySpec[] };
export const LAYOUT: Layout = {
  "roles": [
    {
      "key": "networkleitung",
      "name": "Networkleitung",
      "color": 14265174,
      "hoist": true,
      "selfAssignable": false
    },
    {
      "key": "communityleitung",
      "name": "Communityleitung",
      "color": 12882768,
      "hoist": true,
      "selfAssignable": false
    },
    {
      "key": "moderation",
      "name": "Netzwerk Moderation",
      "color": 14518929,
      "hoist": true,
      "selfAssignable": false
    },
    {
      "key": "support",
      "name": "Support",
      "color": 7521710,
      "hoist": true,
      "selfAssignable": false
    },
    {
      "key": "technik",
      "name": "Technik",
      "color": 7842280,
      "hoist": true,
      "selfAssignable": false
    },
    {
      "key": "finanzen",
      "name": "Finanzen",
      "color": 11124362,
      "hoist": false,
      "selfAssignable": false
    },
    {
      "key": "eventteam",
      "name": "Eventteam",
      "color": 11836115,
      "hoist": false,
      "selfAssignable": false
    },
    {
      "key": "cw-leitung",
      "name": "CW Projektleitung",
      "color": 7842280,
      "hoist": true,
      "selfAssignable": false
    },
    {
      "key": "cw-team",
      "name": "CW Team",
      "color": 9482199,
      "hoist": false,
      "selfAssignable": false
    },
    {
      "key": "creator",
      "name": "Creator",
      "color": 12100041,
      "hoist": false,
      "selfAssignable": false
    },
    {
      "key": "partner",
      "name": "Partner",
      "color": 11055549,
      "hoist": false,
      "selfAssignable": false
    },
    {
      "key": "cw-spieler",
      "name": "Clone Wars RP",
      "color": 9417958,
      "hoist": false,
      "selfAssignable": true
    },
    {
      "key": "ping-netzwerk",
      "name": "News zum Netzwerk",
      "color": 8884381,
      "hoist": false,
      "selfAssignable": true
    },
    {
      "key": "ping-events",
      "name": "Community Events",
      "color": 8884381,
      "hoist": false,
      "selfAssignable": true
    },
    {
      "key": "ping-cw",
      "name": "CW News und Events",
      "color": 8884381,
      "hoist": false,
      "selfAssignable": true
    },
    {
      "key": "ping-entwicklung",
      "name": "Entwicklung verfolgen",
      "color": 8884381,
      "hoist": false,
      "selfAssignable": true
    }
  ],
  "categories": [
    {
      "key": "ankommen",
      "name": "01 | ANKOMMEN",
      "profile": "public_read",
      "channels": [
        {
          "key": "start",
          "name": "start",
          "type": "text",
          "profile": "public_read",
          "topic": "Willkommen bei GoR Network. Projekte, Mitspieler und Hilfe findest du hier.",
          "slowmode": 0
        },
        {
          "key": "regeln",
          "name": "regeln",
          "type": "text",
          "profile": "public_read",
          "topic": "Gemeinsame Regeln für Mitglieder und Team. Projektregeln gelten zusätzlich im jeweiligen Spiel.",
          "slowmode": 0
        },
        {
          "key": "neuigkeiten",
          "name": "neuigkeiten",
          "type": "text",
          "profile": "public_read",
          "topic": "Wichtige Netzwerkneuigkeiten. Projektmeldungen stehen in den Projektbereichen.",
          "slowmode": 0
        },
        {
          "key": "projekte",
          "name": "projekte",
          "type": "text",
          "profile": "public_read",
          "topic": "Welche Projekte zu GoR gehören und welchen Status sie haben.",
          "slowmode": 0
        },
        {
          "key": "termine",
          "name": "termine",
          "type": "text",
          "profile": "events_read",
          "topic": "Gemeinsame Events und Termine mit freiwilligen Benachrichtigungen.",
          "slowmode": 0
        }
      ]
    },
    {
      "key": "community",
      "name": "02 | COMMUNITY",
      "profile": "public_chat",
      "channels": [
        {
          "key": "lounge",
          "name": "lounge",
          "type": "text",
          "profile": "public_chat",
          "topic": "Zum Ankommen, Quatschen und Kennenlernen.",
          "slowmode": 3
        },
        {
          "key": "vorstellungen",
          "name": "vorstellungen",
          "type": "text",
          "profile": "public_chat",
          "topic": "Stell dich vor, wenn du magst. Nickname und Interessen reichen.",
          "slowmode": 5
        },
        {
          "key": "mitspielersuche",
          "name": "mitspielersuche",
          "type": "text",
          "profile": "public_chat",
          "topic": "Spiel, Zeitpunkt, freie Plätze und Vorhaben nennen. Gemeinsam eine Runde finden.",
          "slowmode": 10
        },
        {
          "key": "ideen",
          "name": "ideen",
          "type": "text",
          "profile": "public_chat",
          "topic": "Eine Idee pro Thread. Rückmeldung mit Status und Begründung.",
          "slowmode": 10
        },
        {
          "key": "fragen",
          "name": "fragen",
          "type": "text",
          "profile": "public_chat",
          "topic": "Allgemeine Fragen. Private Angaben und Beschwerden bitte über den Support.",
          "slowmode": 3
        }
      ]
    },
    {
      "key": "spielen",
      "name": "03 | GEMEINSAM SPIELEN",
      "profile": "public_chat",
      "channels": [
        {
          "key": "voice-lounge",
          "name": "Netzwerk Lounge",
          "type": "voice",
          "profile": "public_chat",
          "topic": "",
          "slowmode": 0
        },
        {
          "key": "voice-spielrunde1",
          "name": "Spielrunde 1",
          "type": "voice",
          "profile": "public_chat",
          "topic": "",
          "slowmode": 0
        },
        {
          "key": "voice-spielrunde2",
          "name": "Spielrunde 2",
          "type": "voice",
          "profile": "public_chat",
          "topic": "",
          "slowmode": 0
        },
        {
          "key": "voice-afk",
          "name": "AFK",
          "type": "voice",
          "profile": "afk",
          "topic": "",
          "slowmode": 0
        }
      ]
    },
    {
      "key": "unterstuetzung",
      "name": "04 | GOR UNTERSTÜTZEN",
      "profile": "public_read",
      "channels": [
        {
          "key": "gor-unterstuetzen",
          "name": "gor-unterstützen",
          "type": "text",
          "profile": "finance_public",
          "topic": "Freiwillige Unterstützung. Verwendung, Bedingungen und Zahlungsstatus: gor-shop.de",
          "slowmode": 0
        },
        {
          "key": "kosten-und-stand",
          "name": "kosten-und-stand",
          "type": "text",
          "profile": "finance_public",
          "topic": "Veröffentlichte Kosten und bestätigte Finanzierung. Keine einzelnen Zahlungsdaten.",
          "slowmode": 0
        }
      ]
    },
    {
      "key": "hilfe",
      "name": "05 | HILFE UND KONTAKT",
      "profile": "public_read",
      "channels": [
        {
          "key": "support",
          "name": "support",
          "type": "text",
          "profile": "support_read",
          "topic": "So erreichst du das Team bei Fragen, Beschwerden oder privaten Anliegen.",
          "slowmode": 0
        },
        {
          "key": "netzwerk-aufnahme",
          "name": "netzwerk-aufnahme",
          "type": "text",
          "profile": "public_read",
          "topic": "Partnerschaft, Probephase und Eingliederung. Zuständigkeit und Budget werden vorher geklärt.",
          "slowmode": 0
        },
        {
          "key": "kontakt",
          "name": "kontakt-und-rechtliches",
          "type": "text",
          "profile": "public_read",
          "topic": "Offizielle Websites, Kontakt und rechtliche Informationen.",
          "slowmode": 0
        },
        {
          "key": "support-voice",
          "name": "Support Warteraum",
          "type": "voice",
          "profile": "waiting",
          "topic": "",
          "slowmode": 0
        }
      ]
    },
    {
      "key": "clonewars",
      "name": "06 | CLONE WARS RP",
      "profile": "cw_chat",
      "channels": [
        {
          "key": "cw-start",
          "name": "cw-start",
          "type": "text",
          "profile": "cw_read",
          "topic": "Einstieg in Guardians of the Republic Clone Wars RP.",
          "slowmode": 0
        },
        {
          "key": "cw-neuigkeiten",
          "name": "cw-neuigkeiten",
          "type": "text",
          "profile": "cw_read",
          "topic": "Ankündigungen und Änderungen zu Clone Wars RP.",
          "slowmode": 0
        },
        {
          "key": "cw-austausch",
          "name": "cw-austausch",
          "type": "text",
          "profile": "cw_chat",
          "topic": "Fragen und Gespräche rund um Clone Wars RP.",
          "slowmode": 10
        },
        {
          "key": "cw-events",
          "name": "cw-events",
          "type": "text",
          "profile": "cw_read",
          "topic": "Projektveranstaltungen. Termine erst nach Freigabe veröffentlichen.",
          "slowmode": 0
        },
        {
          "key": "cw-fehler",
          "name": "cw-fehler",
          "type": "text",
          "profile": "cw_chat",
          "topic": "Fehler melden: Was passiert, wie wiederholbar, welche Version? Keine geheimen Schlüssel posten.",
          "slowmode": 10
        },
        {
          "key": "cw-ideen",
          "name": "cw-ideen",
          "type": "text",
          "profile": "cw_chat",
          "topic": "Vorschläge zu Clone Wars RP. Ein Vorschlag pro Thread.",
          "slowmode": 10
        },
        {
          "key": "cw-besprechung",
          "name": "Einsatzbesprechung",
          "type": "voice",
          "profile": "cw_chat",
          "topic": "",
          "slowmode": 0
        },
        {
          "key": "cw-lounge",
          "name": "Kompanie Lounge",
          "type": "voice",
          "profile": "cw_chat",
          "topic": "",
          "slowmode": 0
        }
      ]
    },
    {
      "key": "team",
      "name": "07 | TEAM",
      "profile": "team",
      "channels": [
        {
          "key": "team-info",
          "name": "team-info",
          "type": "text",
          "profile": "team_read",
          "topic": "Interne Abläufe und Zuständigkeiten. Keine personenbezogenen Falldetails.",
          "slowmode": 0
        },
        {
          "key": "team-austausch",
          "name": "team-austausch",
          "type": "text",
          "profile": "team",
          "topic": "Gemeinsame Organisation ohne Belege oder vertrauliche Beschwerden.",
          "slowmode": 0
        },
        {
          "key": "team-aufgaben",
          "name": "team-aufgaben",
          "type": "text",
          "profile": "team",
          "topic": "Aufgaben mit Verantwortlichem, Termin und Status.",
          "slowmode": 0
        },
        {
          "key": "discord-updates",
          "name": "discord-updates",
          "type": "text",
          "profile": "moderation_private",
          "topic": "Discord Community Updates für zuständige Moderatoren.",
          "slowmode": 0
        },
        {
          "key": "automod-alarm",
          "name": "automod-alarm",
          "type": "text",
          "profile": "moderation_private",
          "topic": "AutoMod Hinweise. Zugriff nur für zuständige Netzwerkmoderatoren.",
          "slowmode": 0
        },
        {
          "key": "team-voice",
          "name": "Teamrunde",
          "type": "voice",
          "profile": "team",
          "topic": "",
          "slowmode": 0
        }
      ]
    },
    {
      "key": "leitung",
      "name": "08 | LEITUNG",
      "profile": "leadership",
      "channels": [
        {
          "key": "entscheidungen",
          "name": "entscheidungen",
          "type": "text",
          "profile": "leadership",
          "topic": "Entscheidungen, Gründe, Zuständigkeit und nächste Prüfung.",
          "slowmode": 0
        },
        {
          "key": "projektaufnahmen",
          "name": "projektaufnahmen",
          "type": "text",
          "profile": "intake_private",
          "topic": "Prüfung möglicher Netzwerkprojekte. Technik nur soweit erforderlich.",
          "slowmode": 0
        }
      ]
    },
    {
      "key": "finanzen-intern",
      "name": "09 | FINANZEN INTERN",
      "profile": "finance_private",
      "channels": [
        {
          "key": "finanzbelege",
          "name": "finanzbelege",
          "type": "text",
          "profile": "finance_private",
          "topic": "Vertrauliche Belege und Abgleich. Keine Zahlungsgeheimnisse oder vollständigen Kartendaten.",
          "slowmode": 0
        },
        {
          "key": "finanzplanung",
          "name": "finanzplanung",
          "type": "text",
          "profile": "finance_private",
          "topic": "Freigegebene Budgets, Fälligkeiten und Finanzierung nach Projekt.",
          "slowmode": 0
        }
      ]
    },
    {
      "key": "cw-team",
      "name": "10 | CW TEAM",
      "profile": "cw_team",
      "channels": [
        {
          "key": "cw-teamchat",
          "name": "cw-team",
          "type": "text",
          "profile": "cw_team",
          "topic": "Interne Organisation des Clone Wars Projekts.",
          "slowmode": 0
        },
        {
          "key": "cw-aufgaben",
          "name": "cw-aufgaben",
          "type": "text",
          "profile": "cw_team",
          "topic": "CW Aufgaben mit nachvollziehbarer Zuständigkeit und Status.",
          "slowmode": 0
        },
        {
          "key": "cw-teamvoice",
          "name": "CW Teamraum",
          "type": "voice",
          "profile": "cw_team",
          "topic": "",
          "slowmode": 0
        }
      ]
    }
  ]
};
export const LEGACY_MESSAGE_IDS: Record<string,string> = {
  "start": "1571187694338441417",
  "regeln": "1571187725711843389",
  "projekte": "1571187750592581706",
  "gor-unterstuetzen": "1571187776584548454",
  "kosten-und-stand": "1571187798994714659",
  "support": "1571187828543594627",
  "netzwerk-aufnahme": "1571187849166979217",
  "kontakt": "1571187872021872744",
  "cw-start": "1571187900077310086",
  "ideen": "1571187926992158782",
  "team-info": "1571187950375407619"
};
