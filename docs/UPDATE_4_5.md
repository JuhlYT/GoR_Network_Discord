# GoR Network 4.5.1 – Servergestaltung mit tatsächlichem Ergebnis

Seit 4.5.1 zeigen `/einrichten` und **Server jetzt gestalten** den Fortschritt und danach das tatsächliche Ergebnis in derselben persönlichen Antwort. Ein bereits laufender Abgleich wird mitverfolgt. Es wird dafür kein zweiter Einrichtungslauf gestartet.

Der Abschluss unterscheidet zwischen **Bereits passend**, **Einrichtung abgeschlossen** und **Einrichtung mit offenen Punkten**. Geprüfte Änderungen und offene Schlüssel werden genannt; der beigefügte Bericht enthält die vollständige Liste ohne Tokens, private Fallinhalte oder fremde Fehlertexte. Bei fehlendem Volume, verweigerten Rechten oder einer zu niedrigen Botrolle erscheinen konkrete Hinweise. Ein fehlgeschlagener äußerer Einrichtungsschritt erzeugt ebenfalls einen Fehlerbericht.

`/einrichtung` zeigt während eines laufenden Abgleichs den aktuellen Schritt und Fortschritt. Die HTTP-Antwort nennt `setup_step`, `setup_completed` und `setup_total`; der Verbindungsstatus bleibt davon getrennt.

## Servergestaltung seit 4.5

Der Aufbau ist im Bot programmiert. Es müssen keine Rollen, Kategorien oder Infotafeln nach einer Vorlage von Hand gepflegt werden. Nach einer bestätigten Discord-Verbindung beginnt die Automatik selbstständig, sofern `GOR_AUTO_SETUP` nicht ausdrücklich deaktiviert ist.

## Was der Bot gestaltet

| Bereich | Fester Umfang |
| --- | --- |
| Rollen | 16 bekannte GoR-Rollen, Namen, Farben, Hervorhebung und Reihenfolge |
| Kategorien und Kanäle | zehn Kategorien und 41 Text-/Sprachkanäle mit Themen, Schreibpausen, Zuordnung und Rechteprofilen |
| Infotafeln | elf eigene Nachrichten einschließlich Startmenü, Regeln, Support, Projektaufnahme und Finanzierung |
| Serverprofil | Name, Beschreibung, Sprache, Regel- und Updatekanal, AFK, Systemkanal und Benachrichtigungen |
| Einstieg | native Interessen- und Benachrichtigungsauswahl mit sicheren optionalen Rollen |
| Erwähnungsschutz | eigene AutoMod-Regel, soweit keine fremde passende Regel bereits aktiv ist |
| Bot | Servernickname, Präsenz, 39 Slash-Befehle und persönliche Navigation |

Die Definition steht in `server_blueprint.ts`, die Inhalte in `server_content.ts` und `community_ui.ts`. Zusätzliche Bereiche, normale Beiträge und persönliche Fallkanäle gehören nicht zur Gestaltung und werden nicht gelöscht oder umgenutzt.

## Direkte Bedienung

Als Serverinhaber `/einrichtung` öffnen. Dort stehen **Server jetzt gestalten**, **Änderungen ansehen**, **Automatik pausieren/fortsetzen** und **Botstatus** bereit. Alle Klicks prüfen die aktuelle Inhaberberechtigung. Ein öffentlicher Beitrag wird durch diese persönlichen Ansichten nicht überschrieben.

`/einrichten` startet denselben vollständigen Gestaltungsablauf einmalig. `/update_vorschau` und `/update_anwenden` bleiben für eine an den tatsächlichen Serverstand gebundene persönliche Vorschau verfügbar.

Nach Änderungen an bekannten Rollen, bekannten Kanälen oder am Serverprofil wird nach fünf Sekunden ein gemeinsamer Abgleich angefordert. Eine aktive Pause bleibt bestehen. Eigene Änderungen während eines laufenden Abgleichs starten keine Ereignisschleife. Der regelmäßige vollständige Lauf bleibt spätestens alle 15 Minuten aktiv; bei offenen Punkten gelten die begrenzten Wiederholungsfristen.

## Gestaltung ohne Volume

Der vorherige vollständige Abbruch der Gestaltung bei `storage=temporary` ist entfernt. Der Bot kann alle tatsächlich vorhandenen und eindeutig über ihre GoR-IDs oder ihr vorhandenes Journal zugeordneten Bereiche gestalten. Vorhandene eigene Infotafeln werden über gespeicherte IDs, frühere feste GoR-Nachrichten oder den verifizierten eigenen Inhalt wiedergefunden.

Neue Rollen, Kategorien, Kanäle, Infotafeln und AutoMod-Regeln werden ohne dauerhaftes Journal **nicht** angelegt. Ein verlorener Erstellungsaufruf darf nach einem Neustart keine zweite Anlage auslösen. Solche fehlenden Einträge erscheinen einzeln unter `/einrichtung`; die übrige Gestaltung läuft weiter.

Ohne Volume ist eine über die Steuerknöpfe gewählte Pause nur bis zum nächsten Botstart gespeichert. `GOR_AUTO_SETUP=false` pausiert automatische Läufe dauerhaft über die Laufzeitkonfiguration. Das wird im Bedienfeld angezeigt; die Schaltfläche behauptet bei einer solchen Laufzeitpause keine erfolgte Aktivierung. Ein ausdrücklicher einmaliger Abgleich bleibt möglich.

## Vollständige Neuanlage und gespeicherte Anfragen

Mit einem tatsächlich an den Botdienst angebundenen Volume verwendet der Bot automatisch den vollständigen Modus: fehlende Bereiche werden verdeckt angelegt, eingerichtet, erneut gelesen und erst mit den vorgesehenen Rechten freigegeben. Das Journal und seine Wiederaufnahme werden wie bisher dauerhaft gespeichert.

Ein Eintrag in `GOR_DATA_DIR` erzeugt kein Volume. Railway stellt `RAILWAY_VOLUME_MOUNT_PATH` beim tatsächlichen Anbinden bereit; dessen Pfad hat Vorrang. Ein weiterer Hostinganbieter oder eine zusätzliche Datenbank wird nicht benötigt.

Private Anfragen, personenbezogene Fallverwaltung, Finanzentwürfe und neue Veröffentlichungen benötigen weiterhin die tatsächliche dauerhafte Datenhaltung. Die frühere irreführende Antwort „Diese Funktion wird gerade vorbereitet“ ist durch einen konkreten Speicherhinweis ersetzt. Gestaltung und private Anfragen werden nicht mehr pauschal gemeinsam gesperrt.

## Prüfung

Die automatisierten Prüfungen verwenden eine simulierte Discord-Gegenstelle. Sie decken den Aufbau eines leeren Servers mit dauerhaftem Journal, wiederholten Abgleich ohne doppelte Anlagen, verlorene Antworten, Wiederaufnahme und private Rechte ab. Die zusätzlichen Prüfungen testen frischen Start mit bekannten Bereichen ohne Journal, Reparatur vorhandener Infotafeln und das Ausbleiben neuer Discord-Anlagen im eingeschränkten Modus.

Zusätzliche Prozessprüfungen testen den tatsächlichen Interaktionshandler für Start, Pause, Fortsetzen, fehlende Inhaberrechte und zusammengefasste Ereignisse sowie den automatischen Start ohne Volume. Ein grüner CI-Lauf ersetzt keine Live-Prüfung von Botrechten und tatsächlicher Discord-Bedienung.

Der Bot kann seine Rolle nicht selbst über höhere Rollen heben und sich keine fehlenden Rechte erteilen. Betreiberangaben, reale Kosten und Projektvereinbarungen werden weiterhin durch die zuständigen Menschen angegeben; offene Rechtsvorlagen werden nicht als fertige Tatsachen veröffentlicht.
