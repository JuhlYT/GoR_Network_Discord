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
- **Veröffentlichung unklar:** `/vorgaenge`, den ursprünglichen Zielkanal lesen und eine tatsächlich passende Nachricht mit `/vorgang_zuordnen` bestätigen. Autor, Inhalt und Zeitpunkt müssen passen. Nicht auf Verdacht erneut veröffentlichen.

Ankündigungen bleiben 15 Minuten als private Vorschau verfügbar. Nur ihr Verfasser darf sie veröffentlichen; seine aktuelle Leitungsrolle wird vor der Bestätigung geprüft. Massenbenachrichtigungen sind ausgeschaltet.

## Daten und Sicherungen

`/data/support.sqlite` enthält Metadaten, Einstellungen, Interaktionskennungen und vorbereitete Veröffentlichungstexte. SQLite verwendet WAL und vollständige Synchronisierung. Beim Start läuft eine Integritätsprüfung. Ein fehlendes Railway-Volume führt zum Abbruch.

Konsistente Sicherungen liegen unter `/data/backups`. Ein aktiver Dienst sichert beim Start und danach spätestens beim nächsten minütlichen Wartungslauf, sobald 24 Stunden vergangen sind. `/backup` erstellt einen zusätzlichen lokalen Stand. Aufbewahrt werden je sieben automatische und manuelle Sicherungen. Diese Kopien auf demselben Volume ersetzen keine unabhängige Sicherung gegen den Verlust des gesamten Volumes.

Fallkanäle und abgeschlossene Fallzuordnungen werden nicht automatisch gelöscht. Die Leitung legt die weitere Aufbewahrung fest. Interaktionskennungen bleiben sieben Tage, Metadatenprotokolle ohne Gesprächsinhalte 180 Tage. Abgelaufene Entwürfe werden geleert; bestätigte oder verworfene Veröffentlichungstexte werden nach einem Tag aus dem lokalen Vorgang entfernt. Unklare Veröffentlichungen behalten ihren Vergleichsinhalt für die Prüfung.

Beim Wechsel von der früheren Python-Fassung zuerst deren Prozess stoppen, eine konsistente Sicherung der bisherigen SQLite-Datenbank erstellen und als `/data/support.sqlite` übernehmen. Datenbank, WAL und SHM eines laufenden Prozesses nicht einzeln kopieren. Fall- und Einstellungsformat werden weiterverwendet. Der Bot blockiert neue Fälle, wenn ältere Fallkanäle ohne passende Datenbankzuordnung gefunden werden.

## Gesundheit und Neustart

| Route | Bedeutung |
| --- | --- |
| `/live` | HTTP-Prozess läuft; bestätigt keine Discord-Verbindung |
| `/health`, `/ready` | 200 nur bei bestätigter Discord-Bereitschaft und erreichbarer Datenbank, sonst 503 |
| andere Pfade | 404; keine Datenbankdownloads und keine HTTP-Verwaltung |

Die HTTP-Antworten enthalten Dienstname, Version und Status. Fehlerobjekte und HTTP-Anfrageinhalte werden nicht ausgegeben. Der Bot verbindet sich über discord.js wieder. Bleibt er länger als fünf Minuten ohne bestätigte Verbindung, beendet der Wächter den Prozess mit Fehlerstatus; die Railway-Neustartregel übernimmt. Nach zehn fehlgeschlagenen Neustarts muss die Ursache geprüft werden.

Bei SIGTERM werden laufende verwaltete Änderungen abgewartet und der Dienst sauber beendet. Eine feste Grenze von zwölf Sekunden verhindert ein endloses Hängen. Das dauerhafte Volume und die eine Replik verhindern parallele aktive Datenbankinstanzen bei einer Bereitstellung.

## Abnahme auf Discord

1. `/status` und `/serverpruefen`: korrekte Anwendung, vorhandene Rollen und Kanäle. Fehlende Rechte beheben. Community, Regelprüfung, Onboarding und AutoMod müssen jeweils in Discord bestätigt werden.
2. Testmitglied: `/rollen` setzen und abwählen. Bestehende andere Rollen bleiben erhalten; Teamrollen und interne Zugriffe dürfen nicht auswählbar sein.
3. Privaten allgemeinen Testfall eröffnen. Anfragender sieht ihn; fremdes Mitglied sieht ihn nicht. Ein unbeteiligter zuständiger Betreuer kann übernehmen. Abschluss sperrt das Schreiben für Beteiligte und erhält den Verlauf.
4. Privaten Finanztestfall anlegen. Moderation und Technik erhalten allein durch ihre Rolle keinen Zugriff. Eine Finanzzuständigkeit kann übernehmen.
5. Dienst mit offenem Testfall neu starten. Zuordnung und Bedienfeld bleiben erhalten, kein zweiter Fall entsteht.
6. Ankündigung als Vorschau öffnen und verwerfen. Danach eine bewusst gewählte Testankündigung einmal bestätigen und im richtigen Kanal nachlesen.
7. Eine Sicherung erstellen und ihre Wiederherstellung zuerst in einer getrennten Testkopie prüfen.

Projektanfragen ermöglichen Gespräche und eine Pilotphase für weitere Spiele und Server. Aufnahme, Partnerschaft, Fusion, Vertragszusagen und Finanzentscheidungen werden von der Leitung getroffen.
