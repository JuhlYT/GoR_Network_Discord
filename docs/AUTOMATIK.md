# Automatische GoR-Einrichtung

Version 4.3.0 gleicht nach jedem bestätigten Botstart die konfigurierte GoR-Struktur ab. Danach erfolgt der Abgleich alle 15 Minuten. Bei offenen Fehlern wird nach fünf Minuten erneut geprüft; eine belegte Einrichtungssperre wird nach einer Minute erneut geprüft. Ein laufender Abgleich bleibt auf eine Instanz begrenzt. Die Discord-Verbindung ist von der Einrichtung getrennt und bleibt bei einzelnen Einrichtungsfehlern verfügbar.

## Umfang

| Bereich | Automatisches Verhalten |
| --- | --- |
| Rollen | 16 Zuordnungen, Namen, Farben, Hervorhebung, Reihenfolge und sichere Auswahlrollen |
| Kategorien | zehn nummerierte Bereiche mit expliziten Rechteprofilen |
| Kanäle | 41 Zuordnungen, Namen, Kategorien, Themen, Schreibpausen und Rechte |
| Infotafeln | elf verifizierte Nachrichten einschließlich Community- und Supportmenü |
| Serverprofil | GoR-Name, Beschreibung, Community, deutscher Sprachraum, Regeln, Updates, AFK und Benachrichtigungen |
| Einstieg | zwei native Auswahlfragen und sieben Standardkanäle; davon fünf öffentliche Schreibkanäle |
| Erwähnungsschutz | maximal acht eindeutige Erwähnungen und Discord-Raidschutz, ohne automatischen Timeout |
| Bot | Befehle, Präsenz, Servernickname und dauerhafte Zuordnungen |

Die Definition steht in `server_blueprint.ts`, Inhalte in `server_content.ts`. Vorhandene IDs aus der bisherigen Einrichtung werden wiederverwendet. Nach neu angelegten Bereichen gespeicherte IDs haben bei späteren Starts Vorrang vor den ursprünglichen IDs. Mitgliederzuweisungen werden nicht pauschal umgeschrieben. Native Einstiegsauswahlen vergeben nur die vorgesehenen optionalen Rollen.

Die Automatik ergänzt fehlende Einträge und korrigiert Abweichungen an den verwalteten Einträgen. Änderungen an Namen, Farben, Themen und Kanalrechten dieser Bereiche werden beim nächsten Lauf wieder auf die Definition gebracht. Vorübergehende manuelle Gestaltung deshalb bei Bedarf mit `/einrichtung_automatik aktiv:false` vorbereiten. Zusätzliche, nicht zugeordnete Bereiche, normale Beiträge und persönliche Fallkanäle gehören nicht zum verwalteten Layout und werden nicht gelöscht oder umgenutzt.

## Rechte und Privatsphäre

Neue Kategorien und Kanäle werden zunächst für normale Mitglieder verborgen angelegt. Erst danach folgen Name, Zuordnung und das vollständige vorgesehene Rechteprofil. Finanzbereiche bleiben bei Networkleitung und Finanzzuständigkeit; allgemeine Teamrollen erhalten keinen pauschalen Einblick in persönliche Fälle.

Bevor die native Rollenwahl freigegeben wird, prüft der Bot Auswahlrollen, Botrangfolge und private Kanalüberschreibungen. Ist eine Reparatur nicht möglich, bleibt die native Rollenvergabe pausiert. Zusätzliche interne Zugriffe einer Auswahlrolle in nicht verwalteten Bereichen werden gemeldet, ohne diese Bereiche zu verändern.

Eine vorhandene fremde Erwähnungsschutzregel wird erhalten. Eine deaktivierte fremde Regel wird als offener Punkt gemeldet. Die eigene Regel blockiert Erwähnungsspam, leitet aber keine Nachrichteninhalte aus Support- oder Finanzkanälen in Teamkanäle weiter. Zusätzliche native Onboardingfragen werden erhalten; die zwei GoR-Fragen werden anhand ihrer Titel mit ihren vorhandenen IDs aktualisiert.

Discord begrenzt die verfügbaren Rechte und die Rollenhierarchie. Der Bot kann seine eigene Rolle nicht über höherstehende Rollen heben und sich kein Administratorrecht geben. Fehlende Rechte werden unter `/einrichtung` aufgeführt. Community-Aktivierung benötigt Administratorrecht; andere Verwaltungsfunktionen verwenden die erforderlichen Einzelrechte. Die native Regelbestätigung ist ein eigener Discord-Schritt: Die offizielle API dokumentiert derzeit keine Bearbeitung der Membership-Screening-Konfiguration. Der Bot setzt den Regelkanal und behauptet keine bereits erfolgte native Regelbestätigung.

Offizielle Referenzen: [Community und Onboarding](https://docs.discord.com/developers/resources/guild), [AutoMod](https://docs.discord.com/developers/resources/auto-moderation).

## Wiederaufnahme

Vor einer Anlage speichert `managed_resources` eine feste Kennung. Rollen und Kanäle werden zuerst mit dieser eindeutigen vorläufigen Kennung angelegt. Geht die Antwort verloren, wird derselbe Eintrag beim nächsten Lauf anhand der Kennung gefunden. Eine sichere API-Ablehnung kann später erneut versucht werden; ein unklarer Netzwerkabbruch ohne gefundenen Eintrag bleibt zur Prüfung gesperrt.

Menüs werden über gespeicherte Nachrichten-IDs, frühere GoR-Anker oder ihren vollständigen Inhalt und Botautor gefunden. Neue Nachrichten verwenden zusätzlich eine feste Nonce. Ein nicht gefundenes, unklar angelegtes Menü wird nicht erneut gepostet. Nach Änderungen werden die betreffenden Objekte erneut von Discord gelesen und verglichen.

Vor Änderungen werden bis zu fünf Konfigurationsstände pro betroffenem Eintrag in `setup_snapshots` aufbewahrt. Diese enthalten verwaltete Namen, Rechte, Themen oder eigene Infotafeln, keine privaten Fallgespräche. Die SQLite-Sicherungen enthalten auch das Einrichtungsjournal. Die Einrichtungssperre läuft nach einem abgebrochenen Prozess aus; ein laufender Prozess erneuert sie schrittweise.

## Steuerung

| Befehl | Verhalten |
| --- | --- |
| `/einrichtung` | Leitung: Modus, letzter Lauf, Änderungen und offene Schlüssel |
| `/einrichten` | Inhaber: sofortigen Abgleich starten, auch als Einzellauf bei pausierter Automatik |
| `/einrichtung_automatik aktiv:…` | Inhaber: laufende automatische Pflege aktivieren oder pausieren |
| `/einrichtung_zuordnen schluessel:… id:…` | Inhaber: einen tatsächlich vorhandenen passenden Eintrag zuordnen |
| `/einrichtung_freigeben schluessel:… nicht_vorhanden:true` | Inhaber: nach eigener Prüfung eine sicher nicht erfolgte Anlage erneut freigeben |

Schlüssel sind beispielsweise `role:support`, `category:ankommen`, `channel:start` oder `message:start`. Es können ausschließlich konfigurierte GoR-Einträge zugeordnet werden. Private Fallkanäle und fremde Nachrichten werden abgewiesen. Bei Namenskonflikten zuerst den vorhandenen Eintrag prüfen und zuordnen.

`GOR_AUTO_SETUP=false` stoppt automatische Läufe über die Laufzeitkonfiguration. Ohne dauerhaftes Railway-Volume bleibt die automatische Verwaltung pausiert, damit nach einem Neustart kein Einrichtungsjournal verloren geht. Orientierung und Verbindung bleiben verfügbar.

## Abnahme auf Discord

1. Startprotokoll: `discord_ready`, danach `auto_setup_started` und `auto_setup_finished` mit Fehleranzahl prüfen.
2. `/einrichtung`: die verwalteten Bereiche und offene Punkte mit Discord vergleichen.
3. Öffentliche Karten, Rollenwahl und private Fallübersichten als Testmitglied öffnen.
4. Finanz- und Teambereiche mit unbeteiligten Testrollen prüfen.
5. Bot neu starten: gleiche Rollen, Kanäle und Nachrichtenzuordnungen, keine zusätzlichen Anlagen.
6. Automatik pausieren und fortsetzen; der Status muss den gewählten Modus korrekt anzeigen.
7. Einen unkritischen verwalteten Kanalnamen ändern und einen Abgleich durchführen: bestehende ID und Beiträge bleiben erhalten, der Name wird zurückgesetzt.
