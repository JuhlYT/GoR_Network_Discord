# Betrieb, Wiederaufnahme und Abnahme

## Zuständigkeiten

| Anliegen | Zuständige Rollen |
| --- | --- |
| Allgemeine Hilfe | Networkleitung, Communityleitung, Moderation, Support |
| Spiel und Technik | Networkleitung, Communityleitung, Support, Technik |
| Beschwerde | Networkleitung, Communityleitung, Moderation |
| Zahlungsanliegen | Networkleitung, Finanzen |
| Projektaufnahme | Networkleitung, Communityleitung |

Fallkanäle erhalten direkte Rechte für Anfragenden und Bot. Ein unbeteiligter zuständiger Bearbeiter kann den Fall übernehmen; Teamrollen erhalten nicht pauschal Leserechte auf alle Fälle. Der Bot prüft unerwartete direkte Kanalzugriffe. Discord-Inhaber und Administratoren können technisch dennoch zugreifen.

Pro Mitglied gelten drei offene oder unklare Fälle, mindestens eine Minute Abstand und höchstens ein offener Fall derselben Art. Die Datenbank speichert Fallzuordnungen und Zustände, keine Beschreibungen oder Anhänge aus dem Supportformular.

## Unklare Änderungen

Vor externen Änderungen speichert der Bot einen ausstehenden Zustand. Ein unterbrochener oder unbestätigter Vorgang wird nach einem Neustart zur Prüfung blockiert. Weder ein zweiter Bestätigungsklick noch eine erneut zugestellte Interaktion beginnt denselben Versand noch einmal.

- **Fallkanal vorhanden:** Inhaber prüft Kanal, Kategorie und Fallkennung und nutzt `/fall_zuordnen` mit dem bestehenden Kanal.
- **Supportbedienfeld vorhanden:** mit `/panel_zuordnen` bestätigen.
- **Community-Menü vorhanden:** mit `/communitypanel_zuordnen` im Startkanal bestätigen; Autor, Karteninhalt und Schaltflächen müssen zum aktuellen Menü passen.
- **Veröffentlichung unklar:** `/vorgaenge`, den ursprünglichen Zielkanal lesen und eine tatsächlich passende Nachricht mit `/vorgang_zuordnen` bestätigen. Autor, Inhalt und Zeitpunkt müssen passen. Nicht auf Verdacht erneut veröffentlichen.

Ankündigungen bleiben 15 Minuten als private Vorschau verfügbar. Nur ihr Verfasser darf sie veröffentlichen; seine aktuelle Leitungsrolle wird vor der Bestätigung geprüft. Massenbenachrichtigungen sind ausgeschaltet.

## Daten und Sicherungen

`/data/support.sqlite` enthält Metadaten, Einstellungen, Interaktionskennungen und vorbereitete Veröffentlichungstexte. SQLite verwendet WAL und vollständige Synchronisierung. Beim Start läuft eine Integritätsprüfung. Ein fehlendes Railway-Volume führt seit v4.1.1 zu einem eingeschränkten Betrieb statt zu einem Verbindungsabbruch: Orientierung, Status und Rollenwahl funktionieren weiter; Fallverwaltung, neue Veröffentlichungen und dauerhafte Sicherungen bleiben pausiert. Seit 4.5 gestaltet und repariert die Automatik bestehende eindeutig zugeordnete GoR-Bereiche auch ohne Volume; neue Discord-Anlagen benötigen das dauerhafte Journal. Ein temporäres Verzeichnis wird nicht als dauerhafte Speicherung ausgegeben.

Version 4.2.0 ergänzt die Tabelle `project_reviews` mit Fallnummer, Phase, handelnder Person und Zeitpunkt. Vorhandene Tabellen und Fallzuordnungen bleiben erhalten. Formularbeschreibungen werden ausschließlich in den privaten Discord-Fallkanal gesendet. Die persönliche Übersicht fragt nur Fälle des angemeldeten Mitglieds auf diesem Server ab; Teamübersichten filtern bei jeder Interaktion nach dessen aktuellen Zuständigkeiten.

Ein angehängtes Volume hat Vorrang vor `GOR_DATA_DIR`. Seit v4.1.4 werden absolute, relative und in äußere Anführungszeichen gesetzte Speicherpfade gemeinsam aufgelöst. Relative Werte beziehen sich im Container auf `/app`: `data` ergibt `/app/data`, `./betrieb` ergibt `/app/betrieb`. Die Datenbank und Sicherungen liegen direkt im aufgelösten Verzeichnis; vorhandene Daten werden nicht verschoben. Den bestehenden Mountpfad für die Reparatur beibehalten. Das Anwendungsverzeichnis selbst, Systemverzeichnisse und symbolische Links sind keine geeigneten Datenverzeichnisse. Nach dem Anbinden des Volumes und einem Neustart wird der vollständige Betrieb verfügbar. `GOR_SUPPORT_ENABLED=false` pausiert den privaten Support weiterhin ausdrücklich; ohne diesen Schalter ist Support mit dauerhafter Datenhaltung aktiviert.

Konsistente Sicherungen liegen unter `/data/backups`. Ein aktiver Dienst sichert beim Start und danach spätestens beim nächsten minütlichen Wartungslauf, sobald 24 Stunden vergangen sind. `/backup` erstellt einen zusätzlichen lokalen Stand. Aufbewahrt werden je sieben automatische und manuelle Sicherungen. Diese Kopien auf demselben Volume ersetzen keine unabhängige Sicherung gegen den Verlust des gesamten Volumes.

Seit 4.4 werden neue Fälle nach Abschluss nach 30 Tagen zur Einzelprüfung vorgeschlagen. Historische Fälle müssen zuerst eingestuft werden; Fallkanäle werden nur nach konkreter Vorschau und Einzelbestätigung gelöscht. Nach bestätigter Kanallöschung werden personenbezogene Fallmetadaten regelmäßig nach 90 Tagen ab Abschluss ohne aktive Ausnahme bereinigt. Interaktionskennungen bleiben sieben Tage, normale Auditmetadaten 90 Tage. Der vollständige Ablauf und das getrennte Löschjournal stehen in [UPDATE_4_4.md](UPDATE_4_4.md). Abgelaufene Entwürfe werden geleert; bestätigte oder verworfene Veröffentlichungstexte werden nach einem Tag aus dem lokalen Vorgang entfernt. Unklare Veröffentlichungen behalten ihren Vergleichsinhalt für die Prüfung.

Beim Wechsel von der früheren Python-Fassung zuerst deren Prozess stoppen, eine konsistente Sicherung der bisherigen SQLite-Datenbank erstellen und als `/data/support.sqlite` übernehmen. Datenbank, WAL und SHM eines laufenden Prozesses nicht einzeln kopieren. Fall- und Einstellungsformat werden weiterverwendet. Der Bot blockiert neue Fälle, wenn ältere Fallkanäle ohne passende Datenbankzuordnung gefunden werden.

## Gesundheit und Neustart

| Route | Bedeutung |
| --- | --- |
| `/live` | HTTP-Prozess läuft; bestätigt keine Discord-Verbindung |
| `/health`, `/ready` | 200 bei bestätigter Discord-Bereitschaft und erreichbarer Datenbank, sonst 503; `storage` zeigt separat `persistent`, `temporary` oder `local` |
| andere Pfade | 404; keine Datenbankdownloads und keine HTTP-Verwaltung |

Die HTTP-Antworten enthalten Dienstname, Version, Verbindungsstatus, Datenmodus und Stand der Befehlsregistrierung. Fehlerobjekte und HTTP-Anfrageinhalte werden nicht ausgegeben. `discord_ready` bestätigt die Verbindung, `commands_registered` die Registrierung. Ein Registrierungsfehler wird mit einem festen Diagnosecode gemeldet und erneut versucht, ohne die Verbindung zu beenden. Bestehendes Administratorrecht wird als Hinweis protokolliert; es umgeht keine Zuständigkeit oder Zielserverprüfung.

Seit v4.1.3 nennt `service_starting` die gestartete Version. Weitere feste Ereignisse zeigen den Datenbankstart, die Gesundheitsroute, die Verbindung und die Prüfungen von Anwendung und Zielserver. `configuration_token_found` nennt ausschließlich den Variablennamen, niemals seinen Wert. Fehlt der Token, endet der Prozess mit Code 1 und `configuration_token_missing`. Ist der Verbindungsaufbau nach 120 Sekunden nicht bestätigt, endet er mit `startup_timeout` und Code 1. So bleiben fehlerhafte Starts nicht unbegrenzt als unverbundener HTTP-Prozess aktiv. Für die Fehlersuche die aktuellen Deploy Logs ab `service_starting` verwenden; ein erfolgreicher Build ist keine Bestätigung des Discord-Logins.

Der Bot verbindet sich über discord.js wieder. Bleibt er länger als fünf Minuten ohne Gateway-Verbindung, beendet der Wächter den Prozess mit Fehlerstatus; die Railway-Neustartregel übernimmt. Nach zehn fehlgeschlagenen Neustarts muss die Ursache geprüft werden.

Bei SIGTERM werden laufende verwaltete Änderungen abgewartet und der Dienst sauber beendet. Eine feste Grenze von zwölf Sekunden verhindert ein endloses Hängen. Das dauerhafte Volume und die eine Replik verhindern parallele aktive Datenbankinstanzen bei einer Bereitstellung.

## Abnahme auf Discord

### Slash-Befehle fehlen

1. Im aktuellen Railway-Deployment muss `service_starting` die Version **4.5.1** nennen. Ein älteres Deployment enthält diese Reparatur noch nicht.
2. `commands_registration_starting` startet die Gateway-unabhängige Registrierung. `commands_registered` mit `confirmed: 39`, `total: 39` bestätigt die Befehle auf Server `1571171516677361704`. Ein einzelner Fehler nennt unter `commands_definition_failed` den betroffenen Befehlsnamen; andere gültige Befehle werden trotzdem registriert. `commands_registration_failed_retrying` bedeutet, dass die vollständige Registrierung noch nicht bestätigt ist.
3. `discord_ready` muss ebenfalls erscheinen: registrierte Befehle allein bestätigen keine aktive Verbindung zum Empfangen und Beantworten der Interaktionen. Bei `token_invalid`, `wrong_application` oder `guild_access_missing` den Laufzeitwert beziehungsweise die Installation der vorgesehenen GoR-App prüfen. Keine Tokenwerte in Chat oder Screenshots weitergeben.
4. Sind beide Schritte bestätigt, aber `/start` wird im Zielserver nicht angeboten: unter **Servereinstellungen → Integrationen → GoR-App** prüfen, ob die App und ihre Befehle für Nutzer, Rollen und Kanal freigegeben sind. Im betreffenden Kanal muss **Anwendungsbefehle verwenden** erlaubt sein. Danach Discord einmal mit Strg+R neu laden und `/start` im GoR-Startkanal auswählen. Ein direkt auf diesem Server registrierter Befehl benötigt keine globale Wartefrist.

Die Befehlsregistrierung ändert keine manuell gesetzten Integrationsfreigaben. Solche individuellen Befehlsrechte lassen sich nicht mit dem Bot-Token überschreiben. Bei einer normalen Bot-Einladung ist der OAuth-Scope `applications.commands` bereits im Scope `bot` eingeschlossen; eine erneute Einladung ist daher kein pauschaler Reparaturschritt.

Die HTTP-Gesundheitsantwort nennt `commands`, `command_phase`, `command_count` und `command_total` getrennt vom Verbindungsstatus. Ein Teilstand wird nicht als vollständige Registrierung ausgegeben. Die Prüfläufe für den Registry-Code und die Prozessstarts verwenden eine simulierte Discord-Gegenstelle; sie ersetzen nicht die obigen Live-Bestätigungen.

### Funktionsprüfung

1. `/status` und `/serverpruefen`: korrekte Anwendung, vorhandene Rollen und Kanäle. Fehlende Rechte beheben. Community, Regelprüfung, Onboarding und AutoMod müssen jeweils in Discord bestätigt werden.
2. Testmitglied: `/rollen` setzen und abwählen. Bestehende andere Rollen bleiben erhalten; Teamrollen und interne Zugriffe dürfen nicht auswählbar sein.
3. Privaten allgemeinen Testfall eröffnen. Anfragender sieht ihn; fremdes Mitglied sieht ihn nicht. Ein unbeteiligter zuständiger Betreuer kann übernehmen. Abschluss sperrt das Schreiben für Beteiligte und erhält den Verlauf.
4. Privaten Finanztestfall anlegen. Moderation und Technik erhalten allein durch ihre Rolle keinen Zugriff. Eine Finanzzuständigkeit kann übernehmen.
5. Dienst mit offenem Testfall neu starten. Zuordnung und Bedienfeld bleiben erhalten, kein zweiter Fall entsteht.
6. Ankündigung als Vorschau öffnen und verwerfen. Danach eine bewusst gewählte Testankündigung einmal bestätigen und im richtigen Kanal nachlesen.
7. Eine Sicherung erstellen und ihre Wiederherstellung zuerst in einer getrennten Testkopie prüfen.

Projektanfragen ermöglichen Gespräche und eine Pilotphase für weitere Spiele und Server. Aufnahme, Partnerschaft, Fusion, Vertragszusagen und Finanzentscheidungen werden von der Leitung getroffen.

Die Abnahme von Community-Menü, privaten Karten und Projektphasen steht in [COMMUNITY.md](COMMUNITY.md).

Seit Version 4.3.0 startet die automatische Einrichtung nach der bestätigten Gateway-Verbindung. Die HTTP-Gesundheitsantwort nennt ihren Zustand separat in `setup`. Ein offener Einrichtungsschritt macht eine bestehende Discord-Verbindung nicht künstlich ungesund. Die Tabellen `managed_resources`, `setup_lease` und `setup_snapshots` speichern Zuordnungen, eine zeitlich begrenzte Einrichtungssperre und bis zu fünf eigene Konfigurationsstände je Eintrag. Die bestehende Sicherung enthält diese Tabellen ebenfalls. Native Regelbestätigung wird nicht automatisch als erledigt ausgegeben. Details, Pausierung und Wiederaufnahme stehen in [AUTOMATIK.md](AUTOMATIK.md).
