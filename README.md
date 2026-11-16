# GoR Network · Community-Bot

Ein gemeinsamer Einstieg für Spieler. Klare Wege für Support und neue Serverprojekte. GoR verbindet verschiedene Spiele und Communities unter einem Network.

## Version 4.5.0: Servergestaltung direkt durch den Bot

Die automatische Gestaltung startet auch ohne Railway-Volume für alle bereits eindeutig zugeordneten GoR-Rollen, Kategorien, Kanäle und eigenen Infotafeln. Ein fehlender Datenspeicher blockiert nicht mehr den gesamten Gestaltungsablauf. Neue Discord-Anlagen benötigen weiterhin das dauerhafte Journal, damit unklare Antworten nach einem Neustart keine Duplikate erzeugen. Private Fallverwaltung bleibt daran getrennt gebunden.

`/einrichtung` enthält für den Inhaber **Server jetzt gestalten**, **Änderungen ansehen** und **Automatik pausieren/fortsetzen**. Änderungen an verwalteten Rollen, Kanälen und am Serverprofil lösen nach fünf Sekunden einen zusammengefassten Abgleich aus. Zusätzliche Bereiche werden nicht übernommen. Bei pausierter Automatik und während eigener Gestaltung werden keine Ereignisschleifen gestartet.

Der vollständige Aufbau ist im Bot definiert: 16 Rollen, zehn Kategorien, 41 Kanäle und elf eigene Infotafeln sowie Community-Profil, AFK, Auswahlfragen und Erwähnungsschutz. Mit dauerhaftem Journal werden fehlende GoR-Einträge automatisch ergänzt. Details und technische Grenzen: [docs/UPDATE_4_5.md](docs/UPDATE_4_5.md).

## Version 4.4.0: Community, Datenschutz und kontrollierte Updates

39 Befehle, ein überarbeitetes Menü in Gold, native Veranstaltungsplanung, öffentliche Ideen mit nachvollziehbarem Stand und einzeln freigegebene Finanzberichte. Datenschutzanfragen und Beschwerden haben gesonderte Zuständigkeiten. Zahlungsunterlagen werden nicht mehr in neuen Discord-Fällen erfasst.

Mit `/einrichtung` richtet der Inhaber die tatsächlichen öffentlichen Kontakt- und Informationswege ein. Es werden keine Betreiberangaben erfunden und keine offenen Rechtsvorlagen automatisch veröffentlicht. Eigene Metadaten sind mit `/meine_daten` erreichbar; `/datenanfrage` eröffnet den begrenzten Bearbeitungsweg. Externe Kontakte bleiben auch für Menschen ohne Serverzugang erforderlich.

`/update_vorschau` bindet die konkrete Vorschau an den frisch gelesenen Server- und Konfigurationsstand. Geschützte Gestaltungsfelder werden zeitlich befristet erhalten; Sicherheitsrechte bleiben prüfbar. Alte Fallkanäle erhalten keinen rückwirkenden automatischen Löschtermin. Fällige Kanäle werden einzeln nach Vorschau bestätigt. Ein getrenntes Löschjournal wird bei Rücksicherungen erneut angewandt.

Unabhängige AES-256-GCM-Sicherungen können mit einem tatsächlich eingerichteten und freigegebenen S3-Ziel aktiviert werden; sie werden erst nach Zurücklesen als bestätigt ausgegeben. Ohne dieses Ziel bleibt der Punkt sichtbar offen. Ein zusätzlicher Projektpilot braucht bestätigte Betreiber-, Budget-, Rechte-, Daten- und Ausstiegsabsprachen.

**Start und konkrete Befehle:** [docs/UPDATE_4_4.md](docs/UPDATE_4_4.md). **Rechtsentwürfe:** [docs/rechtliches](docs/rechtliches). Die tatsächliche Discord-Abnahme, Betreiberangaben und Dienstleisterkonfiguration bleiben getrennt vom erfolgreichen Softwaretest.

## Fehlende Slash-Befehle: Reparatur in Version 4.3.1

Die 29 Befehle werden direkt über Discords REST-API auf dem GoR-Server registriert, sobald der geschützte Token geladen wurde. Dieser Schritt wartet nicht mehr auf die Gateway-Verbindung oder die automatische Servereinrichtung. Anwendung und Zielserver werden vorher über Discord geprüft. Nach erfolgreicher Registrierung läuft alle 15 Minuten eine erneute Prüfung; fehlgeschlagene Versuche werden nach einer Minute erneut geprüft. Ein einzelner abgelehnter Befehl blockiert die übrigen nicht.

Vorhandene Befehle werden anhand ihres vollständigen Schemas einschließlich Standardfreigabe und NSFW-Kennzeichnung abgeglichen. Die GoR-Befehle verwenden normale, nicht altersbeschränkte Standardfreigaben; Verwaltungsaktionen prüfen weiterhin die tatsächliche Zuständigkeit bei jeder Ausführung. Zusätzliche manuelle Freigaben unter Discord **Servereinstellungen → Integrationen** bleiben erhalten. Andere Befehle werden nicht gelöscht.

Erst der Logeintrag `commands_registered` mit `confirmed: 29` bestätigt einen vollständigen Leseabgleich mit Discord. `discord_ready` bestätigt separat die Verbindung zum Empfangen der Befehle. Beide werden benötigt. Details zur Diagnose, wenn Discord die Befehle weiter ausblendet, stehen in [docs/BETRIEB.md](docs/BETRIEB.md#slash-befehle-fehlen).

## Automatische Einrichtung seit Version 4.3.0

Nach einer bestätigten Discord-Verbindung richtet sich der Bot selbst ein. Die GoR-Pflege startet automatisch und gleicht den verwalteten Aufbau danach bei Änderungen und spätestens alle 15 Minuten erneut ab. Ohne dauerhaftes Journal gestaltet sie vorhandene bekannte Bereiche; mit Journal ergänzt sie außerdem fehlende Einträge. Ein manuelles `/communitypanel` ist für den Einstieg nicht mehr erforderlich.

- **16 Rollen:** vorhandene Rollen weiterverwenden, Farben und Darstellung vereinheitlichen, fehlende Rollen ergänzen und ihre Reihenfolge unterhalb der Botrolle ordnen. Auswahlrollen bleiben ohne globale Rechte. Vorhandene zusätzliche Teamrechte werden erhalten; Moderationsrollen erhalten die vorgesehenen Nachrichten- und Threadrechte.
- **10 Kategorien und 41 Kanäle:** nummerierte Bereichsüberschriften, richtige Zuordnung, Themen, Schreibpausen und vollständige Rechteprofile für öffentliche, interne, CW- und Finanzbereiche.
- **11 Infotafeln:** Regeln, Einstieg, Projekte, Finanzierung, Kontakt und Teamabläufe werden automatisch veröffentlicht beziehungsweise auf ihren vorhandenen Nachrichten aktualisiert. Community- und Supportmenü sind eingeschlossen.
- **Native Discord-Funktionen:** Community-Profil, Regel- und Updatekanal, AFK, Standardbenachrichtigungen, deutscher Einstieg mit zwei Auswahlfragen und ein grundlegender Schutz gegen Erwähnungsspam.
- **Bot-Betrieb:** Befehlsregistrierung, Präsenz, Servernickname, dauerhafte IDs, Einrichtungssperre und Wiederaufnahme nach Abbrüchen. Fehler in der Einrichtung schalten die Gateway-Verbindung nicht ab.

Der Bot verwaltet die festgelegte GoR-Struktur. Zusätzliche, nicht zugeordnete Rollen und Kanäle sowie private Fallkanäle bleiben erhalten. Unklare frühere Anlagen werden zuerst anhand ihrer gespeicherten Kennung oder ihres genauen Inhalts gesucht; eine nicht bestätigte Erstellung wird nicht blind wiederholt. Der ausführliche Ablauf steht in [docs/AUTOMATIK.md](docs/AUTOMATIK.md).

## Community-Funktionen seit Version 4.2.0

- **Zentrales Community-Menü:** acht Schaltflächen für Einstieg, Spiele, Rollen, Hilfe, Projektaufnahme, FAQ, eigene Anliegen und Unterstützung. Einheitliche Karten, klare Anlaufstellen und private Navigation.
- **Persönlicher Einstieg:** `/start` und `/hilfe` führen in drei Schritten zu Regeln, Mitspielern und Möglichkeiten zum Mitgestalten. `/faq` beantwortet typische Fragen, auf Wunsch zu einem bestimmten Thema.
- **Deine Anliegen:** `/meine_faelle` zeigt Mitgliedern ausschließlich ihre letzten zehn eigenen Anfragen einschließlich Bearbeitung und Projektphase.
- **Teamboard:** `/team` zeigt zuständige Fälle, unübernommene Anliegen und zu prüfende Vorgänge. `/faelle` bietet Seiten, Aktualisierung und verständliche Fallstände.
- **Aufnahme neuer Gameserver:** fünf klare Formularfelder und sechs nachvollziehbare Aufnahmephasen. Alle Spiele sind willkommen; die Leitung entscheidet über die Zusammenarbeit.
- **Konkrete Serverprüfung:** Rollen, Kategorien, Kanäle, Botrechte, Rangfolge der Auswahlrollen, Community-Funktionen und lokaler Sicherungsstand werden übersichtlich angezeigt.

## Das Menü auf deinem Discord aktivieren

Die automatische Einrichtung veröffentlicht Community- und Supportmenü selbst. `/einrichtung` zeigt den Fortschritt und konkrete offene Punkte. Der Inhaber kann mit `/einrichten` einen sofortigen Abgleich starten. `/communitypanel` und `/supportpanel` bleiben als gezielte Aktualisierung einzelner Menüs verfügbar.

Mitglieder starten über `/start` oder die Schaltflächen. Ein öffentlicher Klick öffnet eine persönliche Ansicht; die Navigation darin aktualisiert diese Ansicht. Öffentliche Karten werden dabei nicht durch persönliche Inhalte ersetzt.

Wenn eine frühere Anlage unklar ist, zuerst die bereits vorhandene Nachricht mit `/communitypanel_zuordnen` beziehungsweise `/panel_zuordnen` bestätigen. Vorhandene Community-Kanäle, Mitgliedsrollen und Gesprächsverläufe werden weiterverwendet.

## Befehle

| Mitglieder | Zuständige Betreuung | Network-/Communityleitung | Inhaber |
| --- | --- | --- | --- |
| `/start`, `/hilfe`, `/faq` | `/team`, `/faelle` | `/projektstatus`, `/einrichtung` | `/communitypanel`, `/einrichten` |
| `/rollen`, `/status` | `/uebernehmen` | `/serverpruefen` | `/communitypanel_zuordnen` |
| `/support`, `/meine_faelle` | `/schliessen` gemäß Fallzuordnung | `/ankuendigung` | `/supportpanel`, `/panel_zuordnen` |
| `/projektanfrage` | | | `/fall_zuordnen` |
| `/unterstuetzen` | | | `/vorgaenge`, `/vorgang_zuordnen`, `/backup` |

Zusätzlich stehen dem Inhaber `/einrichtung_automatik`, `/einrichtung_zuordnen` und `/einrichtung_freigeben` zur Verfügung.

Die Rechte werden bei jeder Interaktion frisch geprüft. Die Teamübersichten enthalten nur Fälle aus der jeweiligen Zuständigkeit; Zahlungsanliegen bleiben bei Finanzzuständigkeit oder Inhaber. Der Anfragende darf seinen eigenen Fall ebenfalls abschließen.

## Projekte in GoR aufnehmen

Das Formular fragt nach Projektname, Spiel und Modus, aktuellem Stand, gewünschter Zusammenarbeit und einem optionalen öffentlichen Kontaktlink. Die Angaben landen im privaten Fallkanal. In der Bot-Datenbank stehen Zuordnung und Phase, keine Formularbeschreibungen.

**Neu → Prüfung → Gespräch → Pilotphase → Aufnahmeentscheidung.** Eine Ablehnung ist in jeder laufenden Phase möglich. Die Leitung kann eine noch offene Anfrage aus einer Entscheidung wieder in die Prüfung nehmen. Eigene Projektanfragen müssen durch eine andere zuständige Leitung geprüft werden.

Mit `/projektstatus fall:… phase:…` schreibt die Leitung den Stand fort. Mitglieder sehen ihn in `/meine_faelle`. Über Besitzrechte, Serverzugriffe, Kosten und konkrete Zusammenarbeit wird mit den Beteiligten entschieden; der Phasenbefehl richtet keine fremden Server ein.

Der ausführliche Ablauf steht in [docs/COMMUNITY.md](docs/COMMUNITY.md).

## Railway betreiben

Der Dienst verwendet das Repository **JuhlYT/GoR_Network_Discord**, Branch **main**, und den Dockerfile im Hauptordner. Die geschützten Variablen und das bestehende Volume beim Update beibehalten. Der Container enthält die Startanweisung.

| Einstellung | Wert |
| --- | --- |
| Laufzeit | Bun 1.4.4, festgelegte Produktionsabhängigkeiten |
| Bot-Token | `GOR_DISCORD_BOT_TOKEN`; alternativ `DISCORD_TOKEN`, `DISCORD_BOT_TOKEN`, `BOT_TOKEN` oder `TOKEN` |
| Daten | dauerhaftes Volume, empfohlen `/data`; eine Replik |
| Automatische Pflege | standardmäßig aktiv; `GOR_AUTO_SETUP=false` deaktiviert automatische Läufe |
| Privater Support | mit dauerhaftem Speicher standardmäßig aktiv; `GOR_SUPPORT_ENABLED=false` pausiert neue Fälle |
| Gesundheitsprüfung | `/health`, Startfrist 120 Sekunden |
| Neustart | bei Fehler, zehn Versuche; Schlafmodus aus |
| Beendigung | keine parallelen alten und neuen Instanzen; 15 Sekunden Beendigungsfrist |

Relative und zitierte Datenpfade werden einheitlich aufgelöst. Im Container wird `data` zu `/app/data`, `./betrieb` zu `/app/betrieb`. Absolute Pfade bleiben am bisherigen Ort. Ein fehlendes Volume erlaubt Orientierung, Rollenwahl und automatische Reparatur vorhandener GoR-Gestaltung; private Fälle, neue Anlagen und dauerhafte Veröffentlichungsverwaltung bleiben bis zur tatsächlichen Anbindung pausiert.

`service_starting` nennt die Version. Erst **`discord_ready`** bestätigt die geprüfte Discord-Verbindung; **`commands_registered`** mit 39 bestätigten Befehlen bestätigt die Registrierung. Ein grüner Build allein bestätigt den Login nicht. Fehlende Token und nicht rechtzeitig bestätigte Verbindungen beenden den Start mit einem festen Diagnosecode. Tokenwerte und fremde Fehlerkörper werden nicht protokolliert.

Die optionale Infrastructure-as-Code-Konfiguration steht unter `.railway/railway.ts`. Ein Apply gehört nur in das zugehörige GoR-Projekt, nachdem der Plan geprüft wurde; ein bestehender versiegelter Token wird mit `preserve()` erhalten.

## Discord-Bindung und Rechte

Die Anwendung ist an Bot `1571174833025450064` und Server `1571171516677361704` gebunden. Für die Verwaltungsfunktionen benötigt sie Kanäle sehen, Nachrichten senden, Links einbetten, Verlauf lesen, Kanäle verwalten und Rollen verwalten. Die Botrolle muss über den auswählbaren Rollen stehen.

Der Bot verwendet ausschließlich den Gateway-Intent für Server. Privilegierte Mitglieder-, Präsenz- und Nachrichteninhalts-Intents sind nicht erforderlich. Nachrichtenverläufe werden nicht zum Trainieren oder automatischen Moderieren mitgelesen. Unterstützung ist freiwillig; Zugehörigkeit hängt von keiner Zahlung ab.

## Prüfen und entwickeln

```sh
bun install --frozen-lockfile
bun run check
bun run smoke
```

Die Prüfungen decken Datenbankerweiterung, Wiederaufnahme, Fallzustände, private Zugriffe, Projektentscheidungen, Karten- und Befehlsgrenzen, doppelte Veröffentlichungen sowie die tatsächlichen Interaktionswege ab. Die CI baut zusätzlich den Produktionscontainer und prüft absolute, relative und zitierte Speicherpfade samt erhaltenem Datenbankinhalt nach einem Neustart.

Die Discord-Gegenstelle ist in den automatischen Prüfungen simuliert. Die Live-Abnahme auf dem Zielserver steht in [docs/BETRIEB.md](docs/BETRIEB.md). Die Rolle des Bots muss über den verwalteten Rollen liegen. Rechte, die Discord dem Bot nicht erteilt hat, kann er sich nicht selbst geben. Native Regelbestätigung wird nicht als eingerichtet behauptet: Discord stellt dafür derzeit keine dokumentierte Bearbeitungs-API bereit.
