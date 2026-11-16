# GoR Network 4.4 - Betrieb und Freigabe

## Umgesetzt

39 Slash-Befehle, goldene Network-Karten und zusätzliche Wege im bestehenden Menü: Events, Ideen, Kontakt/Rechtliches und Botstatus. Kanal-, Rollen- und Nachrichtenzuordnungen bleiben erhalten. Die neue Version erstellt keinen zweiten Discord und überträgt keine fremden Server.

Neue Befehle: `/rechtliches`, `/meine_daten`, `/datenanfrage`, `/beschwerde`, `/einspruch`, `/ideen`, `/events`, `/finanzbericht`, `/update_vorschau`, `/update_anwenden`.

Datenschutzanfragen haben benannte Zuständige und einen internen Monatsprüftermin. Beschwerdegegner und ursprüngliche Einspruchsbearbeiter werden bei der Zuständigkeitsprüfung ausgeschlossen. Öffentliche Teamkarten zeigen nur zuständige Fälle. Inhaber und Administratoren bleiben technisch privilegiert.

Zahlungsunterlagen werden nicht mehr durch ein neues Discord-Formular abgefragt. Auch ein noch offenes altes Zahlungsformular wird ohne Lesen seines Inhalts zum externen Kontakt umgeleitet. Bestehende Zahlungsfälle werden nicht pauschal gelesen, gelöscht oder an neue Personen freigegeben.

## Nach dem Deployment zuerst prüfen

1. Version 4.4.0, `discord_ready` und `commands_registered` mit `confirmed: 39` prüfen. Ein grüner Build bestätigt keine erfolgreiche Live-Interaktion.
2. Normales Mitglied: `/start`, `/rechtliches`, `/meine_daten`, Ideen, Events und private Antworten testen. Als Inhaber `/einrichtung` öffnen.
3. In `/einrichtung` über **Kontaktwege einrichten** fünf tatsächliche HTTPS-Seiten hinterlegen: Betreiberangaben, Datenschutz, externer Kontakt, geschützter Zahlungs-Support und Einspruch ohne Mitgliedschaft.
4. Seiten tatsächlich prüfen und anschließend **Links geprüft bestätigen** wählen. Das ist eine Betreiberbestätigung der Informationswege, keine automatische juristische Abnahme. Eine Änderung setzt die Bestätigung zurück.
5. Datenschutzkontakte gezielt mit `/einrichtung_automatik aktiv:true datenschutz_person:@Person` benennen; mit `kontakt_entfernen:true` wieder entfernen. Änderungen wirken auf neue App-Zuständigkeitsprüfungen. Eine begrenzte Prüfung kontrolliert zusätzlich bis zu acht zugewiesene Fallzugriffe je Wartungslauf und entfernt nicht mehr berechtigte Einzelzuweisungen. Bei vielen Fällen und unbestätigten API-Antworten ist dies keine sofortige globale Sperre. Direkte bestehende Discord-Zugriffe bei dringenden Teamwechseln zusätzlich sofort prüfen.

Die verfügbaren Umgebungsvariablen für öffentliche Links sind `GOR_IMPRESSUM_URL`, `GOR_PRIVACY_URL`, `GOR_CONTACT_URL`, `GOR_PAYMENT_SUPPORT_URL`, `GOR_APPEAL_URL`. Hinterlegte Laufzeitwerte haben vor gespeicherten Links Vorrang. Keine geheimen oder persönlichen Zugangsparameter in URLs verwenden. Die Bestätigung erfolgt durch den tatsächlichen Inhaber im Bot.

## Daten und Aufbewahrung

Neue Tabellen werden ergänzt; vorhandene Fälle bleiben erhalten. Historische Fälle erhalten `unclassified`, keinen rückwirkenden Löschtermin. Neue 4.4-Fälle erhalten beim Abschluss einen 30-Tage-Prüftermin. Ein Abschluss ist keine Löschung und keine Bestätigung eines erfüllten gesetzlichen Auskunftsanspruchs.

Als Inhaber in `/einrichtung` **Aufbewahrung prüfen** öffnen. Altbestand einzeln einstufen. Fällige Fallkanäle werden erst nach einer konkreten persönlichen Vorschau und einer endgültigen Einzelbestätigung gelöscht. Der Bot prüft dieselbe Kanal-ID, Kennung, Zugriffe und den unveränderten Stand nochmals. **Discord-Nachrichten lassen sich durch eine Container-Rücksicherung nicht wiederherstellen.**

Begründete Ausnahmen: `/team fall:42 aufbewahrung:180 grund:rechtliche_sicherung`. `aufbewahrung:0` hebt die zusätzliche Ausnahme auf; das löscht noch keinen Kanal. Die Notwendigkeit muss innerhalb der gewählten Frist erneut bewertet werden.

Nach bestätigter Kanallöschung und Ablauf von 90 Tagen ab Fallabschluss werden zugehörige personenbezogene Metadaten ohne aktive Ausnahme bereinigt. Das getrennte Journal `erasure-ledger.jsonl` unterstützt Rücksicherungen; Einträge laufen nach 37 Tagen aus. `erasure-highwater.txt` erhält ausschließlich den höchsten vergebenen Fallnummernstand. Interaktionskennungen bleiben sieben Tage, normale Auditdaten 90 Tage. Lokale Sicherungen: höchstens sieben automatische und sieben manuelle Kopien, zusätzlich höchstens 30 Tage.

## Konkrete Updatevorschau und manuelle Gestaltung

`/update_vorschau` liest den tatsächlichen Serverstand einschließlich eigener Infotafeln und nativer Konfiguration. Sie beschreibt den gesamten geplanten Abgleich und erkannte Gestaltungsabweichungen. Eine persönliche Vorschau ist 15 Minuten gültig. `/update_anwenden vorgang:…` oder der Bestätigungsknopf prüft den Stand frisch; Abweichungen machen eine neue Vorschau nötig. Andere Bereiche und private Fallkanäle gehören nicht zur Layoutpflege.

Geschützte Felder: `/einrichtung_automatik aktiv:true schutz:channel:lounge:topic stunden:24`. Unterstützt werden bekannte Rollenfelder `name`, `color`, `hoist`, Kategorie-`name`, Kanal-`name`, `topic`, `rateLimitPerUser` sowie `guild:profile:name` und `guild:profile:description`. Rechte, Rollenwahl und private Kanalprofile können damit nicht von Sicherheitsprüfungen ausgenommen werden. `stunden:0` beendet den Schutz.

Native Regelbestätigung bleibt ein gesondert zu prüfender Discord-Schritt, soweit Discord keine dokumentierte Bearbeitungsschnittstelle bereitstellt.

## Ideen, Events und Finanzen

`/ideen aktion:vorschlagen` erklärt den öffentlichen Charakter des Vorschlags. Die Leitung verwendet `aktion:status`, Nummer, Status und Begründung. Eigene Vorschläge können nicht selbst entschieden werden. `/ideen aktion:eigen` zeigt die eigene Auswahl.

`/events` zeigt öffentliche native Termine. Eventteam und Leitung können mit `aktion:planen` eine private Vorschau anlegen. Beginn mit Zeitzone angeben, etwa `2026-11-21T19:00+01:00`. Nach Bestätigung wird der native Termin erstellt und erneut gelesen. Unklare Anlagen werden nicht automatisch wiederholt; der Inhaber kann sie mit `aktion:zuordnen`, Vorgang und Event-ID exakt bestätigen. Absagen benötigen eine eigene Vorschau. Der Bot verschickt keine Werbe-DMs.

`/finanzbericht aktion:entwurf` steht Finanzzuständigkeit und Inhaber zur Verfügung. Zeitraum, bestätigte Eurobeträge und `zwecke_geprueft:true` angeben. Die persönliche Vorschau wird genau einmal veröffentlicht und anschließend über `/finanzbericht` abgerufen. Private Beiträge werden nicht zum Network-Bestand gerechnet. Feuerwehrweitergaben werden als Ausgänge der ausgewiesenen Network-Abrechnung abgezogen. Keine Zahlung oder steuerliche Bescheinigung wird ausgelöst.

## Weitere Projekte

Vor `phase:pilot` benötigt `/projektstatus` einen bestätigten Ansprechpartner, ein ausdrücklich freigegebenes `pilotbudget`, den HTTPS-Verweis zur tatsächlichen `vereinbarung` und `absprachen_geprueft:true`. Die Prüfung umfasst Betreiber, Budget, Rechte, Daten und Ausstieg. Standard sind 30 Tage, ein zusätzlicher Pilot zur Zeit. Vor `phase:aufgenommen` muss `pilot_ausgewertet:true` bestätigt sein. Keine automatische Eigentums- oder Vertragsübertragung.

## Unabhängige verschlüsselte Sicherung

Eine neue Infrastruktur wird nicht gebucht. Ein bereits vorhandenes S3-kompatibles Ziel kann durch die berechtigte Person geschützt eingerichtet werden:

- `GOR_BACKUP_REMOTE_APPROVED=true`: tatsächlicher Empfänger, Vertragsrolle und Datenübermittlung wurden geprüft.
- `GOR_BACKUP_KEY`: geschützt verwalteter 32-Byte-Schlüssel als kanonisches Base64; niemals im Discord oder Repository veröffentlichen.
- `GOR_BACKUP_S3_BUCKET`, `GOR_BACKUP_S3_ENDPOINT`, `GOR_BACKUP_S3_ACCESS_KEY`, `GOR_BACKUP_S3_SECRET_KEY`, optional `GOR_BACKUP_S3_REGION`.

Übertragen werden nur AES-256-GCM-verschlüsselte Pakete. Ein Upload wird durch Zurücklesen und Integritätsvergleich bestätigt. Aktuelles Löschjournal und tägliche Datenbanksicherung sind getrennte Objekte unter dem festgelegten GoR-Präfix. Nach 30 Tagen entfernt der Bot ausschließlich selbst in seinem Manifest erfasste Sicherungsobjekte. Objektversionierung, Providerkopien und weitere externe Ablagen müssen zusätzlich beim tatsächlichen Anbieter entsprechend konfiguriert und geprüft werden.

Ohne vollständige freigegebene Konfiguration zeigt der Bot die unabhängige Sicherung als offen. Ein lokales Backup wird nicht als unabhängig oder extern verschlüsselt ausgegeben. Den Schlüssel getrennt vom Speicherziel aufbewahren und dessen Wiedergewinnbarkeit tatsächlich testen.

## Rücksicherung zuerst offline

Produktiven Bot anhalten und aktuelle Dateien zusätzlich sichern. **Den aktuellen getrennten Löschjournalstand beschaffen und prüfen.** Ein altes Snapshot-Journal allein genügt nicht. Das Werkzeug erwartet `GOR_BACKUP_KEY` geschützt und `GOR_RESTORE_LEDGER_CONFIRMED=true` nach dieser tatsächlichen Prüfung.

```sh
bun restore_backup.ts --snapshot /sicher/snapshot.gorbak --ledger /sicher/current-erasure-ledger.gorbak
bun restore_backup.ts --snapshot /sicher/snapshot.gorbak --ledger /sicher/current-erasure-ledger.gorbak --out /sicher/geprueft.sqlite
```

Ohne `--out` wird nur geprüft. Mit `--out` wird ausschließlich eine **neue**, noch nicht vorhandene Datei geschrieben, niemals eine aktive Datenbank überschrieben. Format, Zielserver, Integrität und 30-Tage-Zeitraum werden geprüft. Aktuelle Löschmarkierungen und Fallnummernstand werden erneut angewandt. Getrennte Journaldateien mit übernehmen; danach in einer Testkopie Funktionen und Zugriffe prüfen. Erst anschließend den echten Wiederanlauf durch die verantwortliche Person durchführen.

## Noch tatsächlich zu vervollständigen

Betreiber- und Kontaktangaben, geprüfte öffentliche Rechtsinformationen, tatsächliches externes Sicherungsziel und Dienstleisterverträge, Rollenbesetzung, aktuelle Rechnungen, alter Wortlaut von Finanzierungszusagen, konkreter Feuerwehrempfänger und jede individuelle Projektvereinbarung. Die Vorlagen unter `docs/rechtliches` sind ausdrücklich Entwürfe und werden nicht mit offenen Feldern automatisch als fertige Rechtsdokumente veröffentlicht.
