# GoR Network · Community-Bot

Ein gemeinsamer Einstieg für Spieler. Klare Wege für Support und neue Serverprojekte. GoR verbindet verschiedene Spiele und Communities unter einem Network.

## Neu in Version 4.2.0

- **Zentrales Community-Menü:** acht Schaltflächen für Einstieg, Spiele, Rollen, Hilfe, Projektaufnahme, FAQ, eigene Anliegen und Unterstützung. Einheitliche Karten, klare Anlaufstellen und private Navigation.
- **Persönlicher Einstieg:** `/start` und `/hilfe` führen in drei Schritten zu Regeln, Mitspielern und Möglichkeiten zum Mitgestalten. `/faq` beantwortet typische Fragen, auf Wunsch zu einem bestimmten Thema.
- **Deine Anliegen:** `/meine_faelle` zeigt Mitgliedern ausschließlich ihre letzten zehn eigenen Anfragen einschließlich Bearbeitung und Projektphase.
- **Teamboard:** `/team` zeigt zuständige Fälle, unübernommene Anliegen und zu prüfende Vorgänge. `/faelle` bietet Seiten, Aktualisierung und verständliche Fallstände.
- **Aufnahme neuer Gameserver:** fünf klare Formularfelder und sechs nachvollziehbare Aufnahmephasen. Alle Spiele sind willkommen; die Leitung entscheidet über die Zusammenarbeit.
- **Konkrete Serverprüfung:** Rollen, Kategorien, Kanäle, Botrechte, Rangfolge der Auswahlrollen, Community-Funktionen und lokaler Sicherungsstand werden übersichtlich angezeigt.

## Das Menü auf deinem Discord aktivieren

Nach dem bestätigten Botstart als **Discord-Inhaber** einmal `/communitypanel` ausführen. Der Bot legt das Menü im vorhandenen Startkanal an. Erneutes Ausführen aktualisiert dieselbe gespeicherte Nachricht. `/supportpanel` richtet wie bisher das Bedienfeld im Supportkanal ein.

Mitglieder starten über `/start` oder die Schaltflächen. Ein öffentlicher Klick öffnet eine persönliche Ansicht; die Navigation darin aktualisiert diese Ansicht. Öffentliche Karten werden dabei nicht durch persönliche Inhalte ersetzt.

Wenn eine frühere Anlage unklar ist, zuerst die bereits vorhandene Nachricht mit `/communitypanel_zuordnen` beziehungsweise `/panel_zuordnen` bestätigen. Vorhandene Community-Kanäle, Mitgliedsrollen und Gesprächsverläufe werden weiterverwendet.

## Befehle

| Mitglieder | Zuständige Betreuung | Network-/Communityleitung | Inhaber |
| --- | --- | --- | --- |
| `/start`, `/hilfe`, `/faq` | `/team`, `/faelle` | `/projektstatus` | `/communitypanel` |
| `/rollen`, `/status` | `/uebernehmen` | `/serverpruefen` | `/communitypanel_zuordnen` |
| `/support`, `/meine_faelle` | `/schliessen` gemäß Fallzuordnung | `/ankuendigung` | `/supportpanel`, `/panel_zuordnen` |
| `/projektanfrage` | | | `/fall_zuordnen` |
| `/unterstuetzen` | | | `/vorgaenge`, `/vorgang_zuordnen`, `/backup` |

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
| Privater Support | mit dauerhaftem Speicher standardmäßig aktiv; `GOR_SUPPORT_ENABLED=false` pausiert neue Fälle |
| Gesundheitsprüfung | `/health`, Startfrist 120 Sekunden |
| Neustart | bei Fehler, zehn Versuche; Schlafmodus aus |
| Beendigung | keine parallelen alten und neuen Instanzen; 15 Sekunden Beendigungsfrist |

Relative und zitierte Datenpfade werden einheitlich aufgelöst. Im Container wird `data` zu `/app/data`, `./betrieb` zu `/app/betrieb`. Absolute Pfade bleiben am bisherigen Ort. Ein fehlendes Volume erlaubt Orientierung und Rollenwahl; private Fälle, Veröffentlichungen und dauerhafte Verwaltung bleiben bis zur Vorbereitung pausiert.

`service_starting` nennt die Version. Erst **`discord_ready`** bestätigt die geprüfte Discord-Verbindung; **`commands_registered`** bestätigt die Befehle. Ein grüner Build allein bestätigt den Login nicht. Fehlende Token und nicht rechtzeitig bestätigte Verbindungen beenden den Start mit einem festen Diagnosecode. Tokenwerte und fremde Fehlerkörper werden nicht protokolliert.

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

Die Discord-Gegenstelle ist in den automatischen Prüfungen simuliert. Die Live-Abnahme auf dem Zielserver steht in [docs/BETRIEB.md](docs/BETRIEB.md).
