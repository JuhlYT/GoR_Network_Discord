# GoR Network · Discord-Bot

Privater Support, Projektaufnahme, eigene Spielerrollen und Ankündigungen für **GoR Network**. Die Anwendung läuft als dauerhaft verbundener Bot mit Bun und discord.js; die Bot-Datenbank bleibt auf einem eigenen Volume erhalten.

## Reparatur v4.1.2

Der Container akzeptiert jetzt auch eigene absolute Volume-Mountpfade, etwa `/gor-storage` oder `/var/lib/gor-network`. Die bisherige Beschränkung auf drei Pfade hat einen Neustartkreislauf ausgelöst und wurde entfernt. Abschließende Schrägstriche werden normalisiert; vorhandene Daten bleiben am gewählten Speicherort. Systemverzeichnisse, das Anwendungsverzeichnis selbst und symbolische Links werden nicht als Datenverzeichnis verwendet. Die Containerprüfung startet den Bot auch mit abweichenden Mountpfaden und prüft den tatsächlichen Datenbankpfad.

### Weitere Startkorrekturen seit v4.1.1

Der Discord-Verbindungsaufbau ist jetzt von zusätzlichen Betriebsprüfungen getrennt:

- Der Token wird als `GOR_DISCORD_BOT_TOKEN`, `DISCORD_TOKEN`, `DISCORD_BOT_TOKEN`, `BOT_TOKEN` oder `TOKEN` erkannt. Ein versehentlicher `Bot `-Präfix und äußere Anführungszeichen werden entfernt. Der Wert wird nie ausgegeben.
- Ein fehlendes Railway-Volume verhindert die Verbindung nicht mehr. Der Bot läuft dann eingeschränkt mit Orientierung, Status und Rollenwahl. Fälle und Veröffentlichungen bleiben bis zur Anbindung eines dauerhaften Volumes gesperrt.
- Bestehendes Administratorrecht wird gemeldet, beendet den Bot aber nicht mehr. Die feste Bindung an Anwendung und Server sowie alle Nutzer- und Rollenprüfungen bleiben erhalten.
- Eine fehlgeschlagene Befehlsregistrierung schaltet den Bot nicht mehr offline. Die Registrierung wird erneut versucht; andere vorhandene Anwendungsbefehle bleiben erhalten.
- Startfehler erhalten feste Diagnosecodes und Hinweise, ohne Zugangsdaten oder Discord-Anfrageinhalte auszugeben.

Nach einem automatischen GitHub-Deploy startet die neue Fassung über den vorhandenen Dockerfile. Im Laufzeitprotokoll bestätigt `discord_ready` die geprüfte Verbindung; `commands_registered` bestätigt die Befehle.

**Quellcode und Bereitstellungskonfiguration allein bedeuten noch keinen laufenden Bot.** Für den Start werden ein nutzbares Railway-Konto, der Bot-Token als geschützte Variable und die unten beschriebene Abnahme benötigt.

## Funktionen

| Bereich | Verhalten |
| --- | --- |
| Einstieg | Orientierung, Status und Informationen zur freiwilligen Unterstützung |
| Support | Fünf Anliegenarten, private Fallkanäle, Zuständigkeiten, Übernahme und Abschluss |
| Network | Projektanfragen als Einstieg für neue Spiele und Serverprojekte |
| Rollen | Fünf feste Spiel- und Benachrichtigungsrollen mit Rechteprüfung |
| Ankündigungen | Private Vorschau, persönliche Bestätigung, drei feste Zielkanäle |
| Betrieb | Wiederverbindung, Gesundheitsprüfung, Verbindungswächter und sauberes Beenden |
| Daten | SQLite auf dauerhaftem Volume, konsistente Sicherungen und Wiederaufnahme nach Abbrüchen |

Es werden keine Nachrichtentexte mitgelesen. Supportantworten und Aufnahmeentscheidungen übernimmt das zuständige Team. Der Bot löst keine Zahlungen aus und verändert keine Finanzierungszwecke.

## Railway starten

1. In einem eigenen GoR-Projekt einen Dienst aus **JuhlYT/GoR_Network_Discord**, Branch **main**, verbinden. Railway erkennt den Dockerfile im Hauptordner. Der Container bringt die Startanweisung mit; keine abweichende Startanweisung eintragen.
2. Ein dauerhaftes Volume mit zunächst **500 MB** am Pfad **`/data`** an diesen Dienst anschließen. Genau **eine Replik** verwenden und den Schlafmodus ausschalten.
3. Die folgenden Variablen im Dienst setzen. Einen vorhandenen versiegelten Token nicht erneut anlegen oder überschreiben.

| Variable | Wert |
| --- | --- |
| `GOR_DISCORD_BOT_TOKEN` | Gültiger Bot-Token; alternativ wird eine der oben genannten Tokenvariablen verwendet |
| `GOR_DATA_DIR` | `/data` |
| `GOR_SUPPORT_ENABLED` | `true` nach der Vorbereitung der Zuständigkeiten |

`PORT` wird von Railway bereitgestellt. Keine Zugangsdaten in GitHub-Dateien, Issues oder Commitnachrichten speichern.

4. Gesundheitsroute **`/health`**, Startfrist **120 Sekunden**, Neustart bei Fehlern mit **10 Versuchen**, keine parallelen alten und neuen Instanzen und **15 Sekunden** Beendigungsfrist einstellen. Beim eingebauten Containerstart werden die Volume-Rechte vorbereitet; der Bot selbst läuft als Benutzer `bun`. `/data` ist der empfohlene Mountpfad; eigene absolute Speicherpfade werden ebenfalls unterstützt. Das tatsächlich angehängte Volume hat Vorrang vor einem veralteten Datenpfad. Den vorhandenen Mountpfad für diese Reparatur nicht ändern; so bleibt die bestehende Datenbank am bisherigen Ort.
5. Deploymentzustand **SUCCESS**, Protokollereignis **`discord_ready`** und `/health` = **200** bestätigen. Danach die Discord-Abnahme durchführen. Eine öffentliche Domain wird für die Gateway-Verbindung nicht benötigt.

Die entsprechende Railway-Konfiguration steht unter `.railway/railway.ts`. Sie verwendet Infrastructure as Code und verwaltet mit dem Partial `gor-discord-bot` nur die zugehörigen Ressourcen. Vor einem Apply immer den Plan lesen. Der Ausdruck `preserve()` erhält einen bereits geschützten Token; er enthält und erzeugt keinen Zugang. Die Datei ersetzt keine Kontofreischaltung und keine sichere Tokenhinterlegung.

```sh
railway config plan
railway config apply
```

Diese Befehle erst im zugehörigen GoR-Projekt verwenden. Bei unerwarteten Änderungen den Plan prüfen; keine Löschfreigabe auf Verdacht hinzufügen.

## Discord vorbereiten

Der Bot ist fest an die GoR-Anwendung `1571174833025450064` und den Server `1571171516677361704` gebunden. Für seine Verwaltungsfunktionen benötigt er folgende Einzelrechte: Kanäle sehen, Nachrichten senden, Links einbetten, Nachrichtenverlauf lesen, Kanäle verwalten und Rollen verwalten. Die Botrolle muss oberhalb der fünf auswählbaren Rollen liegen. Administratorrecht ist nicht erforderlich. Eine falsche Anwendung wird weiterhin abgewiesen.

Privilegierte Gateway-Intents für Mitglieder, Präsenz und Nachrichteninhalte bleiben ausgeschaltet. Die vorhandenen Rollen und Kanäle werden anhand ihrer IDs verwendet. Der Bot erstellt nicht den kompletten Server erneut.

Nach dem ersten erfolgreichen Start führt der Inhaber `/supportpanel` aus. Bei einer unklaren früheren Anlage zuerst das vorhandene Bedienfeld mit `/panel_zuordnen` bestätigen.

## Befehle

| Mitglieder | Zuständige Betreuung | Network-/Communityleitung | Inhaber |
| --- | --- | --- | --- |
| `/hilfe` | `/faelle` | `/serverpruefen` | `/fall_zuordnen` |
| `/status` | `/uebernehmen` | `/ankuendigung` | `/supportpanel` |
| `/support` | `/schliessen` gemäß Fallzuordnung | | `/panel_zuordnen` |
| `/projektanfrage` | | | `/vorgaenge` |
| `/rollen` | | | `/vorgang_zuordnen` |
| `/unterstuetzen` | | | `/backup` |

Ein Anfragender darf seinen eigenen Fall ebenfalls abschließen. Der Inhaber kann alle Anliegenarten bearbeiten. Andere bestehende Anwendungsbefehle werden beim Start nicht pauschal gelöscht.

## Prüfen und entwickeln

Getestete Laufzeit: **Bun 1.4.4**. Abhängigkeiten und Containerbasis sind festgelegt.

```sh
bun install --frozen-lockfile
bun run check
bun run smoke
```

Die CI prüft Typen, Fallzustände, Neustarts, Zuständigkeiten, Kanalzugriffe, Doppelklicks, Veröffentlichungskontrolle und Backup-Wiederherstellung. Prozess- und Containertests prüfen zusätzlich Tokenalias, fehlendes Volume, vorhandenes Administratorrecht und fehlgeschlagene Befehlsregistrierung. Die Discord-Gegenstelle ist dabei ausdrücklich simuliert, Zugangsdaten werden nicht benötigt. HTTP-Prozess, Containerentrypoint, Benutzerwechsel und SIGTERM laufen tatsächlich. Ein Live-Funktionstest auf Discord wird dadurch nicht ersetzt.

Für einen lokalen Start `GOR_DATA_DIR` auf ein eigenes Datenverzeichnis setzen und den Token geschützt in die Prozessumgebung geben. `bun run start` startet den Bot. Eine gleichzeitige zweite Instanz derselben Anwendung vermeiden.

Die ausführliche Datenhaltung und Abnahme stehen in [docs/BETRIEB.md](docs/BETRIEB.md).
