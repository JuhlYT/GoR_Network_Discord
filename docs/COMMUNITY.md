# GoR im Alltag

## Ein gemeinsamer Eingang

Der Discord-Inhaber veröffentlicht mit `/communitypanel` das Community-Menü im vorhandenen Startkanal. Die acht Schaltflächen führen zu persönlichem Einstieg, Spielen und Network, Rollenwahl, Support, Projektvorstellung, FAQ, eigenen Anliegen und freiwilliger Unterstützung. Das Menü bleibt öffentlich; persönliche Antworten erscheinen ausschließlich für das klickende Mitglied. Innerhalb dieser privaten Karten wird die vorhandene Ansicht aktualisiert.

Ein erneutes `/communitypanel` aktualisiert die gespeicherte Nachricht. Nach einer unklaren Anlage bestätigt `/communitypanel_zuordnen nachricht:…` eine tatsächlich vorhandene, zum Bot gehörende Menü-Nachricht. Es wird kein zweites Menü auf Verdacht angelegt.

## Spieler finden ihren Weg

`/start` führt zu Regeln, Vorstellungen, Interessen und Mitspielersuche. `/faq thema:…` erklärt einzelne Themen. `/rollen` zeigt die aktuelle Auswahl; andere Rollen bleiben erhalten. Der Bereich Spiele verweist auf die vorhandenen Projekte und Termine sowie auf Guardians of the Republic. Er behauptet keine ungeprüften Online- oder Spielerzahlen.

Die Unterstützungskarte nennt Zeit, Ideen, Technik, Events, Reichweite und freiwillige Finanzierung als Möglichkeiten. Aktuelle Verwendungszwecke und Kosten werden aus den vorgesehenen Informationskanälen entnommen. Persönliche Zahlungsfragen gehören in den privaten Support.

## Eigene Anliegen und Teamarbeit

`/meine_faelle` zeigt einem Mitglied seine letzten zehn eigenen Anfragen mit Status, Bearbeitung und gegebenenfalls Projektphase. Andere Mitglieder sehen diese Übersicht nicht.

`/team` zeigt die Bereiche, für die die aktuelle Rolle zuständig ist, und zählt offene, unübernommene sowie zu prüfende Fälle. `/faelle` blättert durch alle zuständigen offenen Anliegen. Jede Seite wird beim Aufruf neu ermittelt. Mit `/uebernehmen fall:…` kann ein unbeteiligter zuständiger Bearbeiter den privaten Kanal erhalten. Zuständigkeiten und Schutz von Finanzfällen bleiben erhalten.

## Serverprojekte aufnehmen

Alle Spiele können vorgestellt werden. Das Formular enthält fünf Angaben:

1. Projektname.
2. Spiel und Spielmodus.
3. Aktueller Stand, Team und aktive Spieler.
4. Konzept und gewünschte Zusammenarbeit.
5. Optionaler Kontakt oder öffentlicher Projektlink.

Die Inhalte stehen im privaten Discord-Fall. In der Datenbank werden Zuordnung, Phase, letzter Bearbeiter und Zeitpunkt gespeichert. Es werden keine privaten Mitgliederlisten oder Zugänge abgefragt.

| Phase | Nächster regulärer Schritt |
| --- | --- |
| Neu eingegangen | In Prüfung |
| In Prüfung | Im Gespräch |
| Im Gespräch | Pilotphase |
| Pilotphase | Aufnahme beschlossen |
| Abgelehnt | Erneute Prüfung bei einer noch offenen Anfrage |
| Aufnahme beschlossen | Erneute Prüfung bei einer noch offenen Anfrage |

In jeder laufenden Phase kann die Leitung ablehnen. `/projektstatus fall:… phase:…` ändert den Stand atomar und protokolliert die Entscheidung. Der Anfragende sieht ihn über `/meine_faelle`. Übersprungene Phasen, doppelte Übergänge, eigene Anfragen sowie geschlossene oder ungeklärte Fälle werden zurückgewiesen.

Eine Aufnahmeentscheidung verändert keine Eigentumsrechte, Botrollen oder fremden Server. Die Beteiligten vereinbaren Zuständigkeiten, Kosten, Pilotbedingungen und die Einrichtung der jeweiligen Spielebereiche gesondert. Geschlossene Fälle behalten ihren Stand; eine neue Vorstellung wird als neuer Fall eingereicht.

## Live-Abnahme der Erweiterung

1. Als Inhaber `/communitypanel` ausführen und anschließend erneut ausführen: Es bleibt bei derselben Nachricht.
2. Als Testmitglied jede Schaltfläche öffnen. Persönliche Antworten dürfen nicht im öffentlichen Menü erscheinen.
3. Im privaten Einstieg zwischen Karten wechseln und Rollenwahl öffnen. Es wird die persönliche Karte aktualisiert.
4. Zwei Testmitglieder stellen je einen Fall. `/meine_faelle` zeigt ausschließlich die eigenen Anfragen.
5. Als normale Person `/team` und `/projektstatus` versuchen: keine Teamdaten und kein Entscheidungszugriff.
6. Eine Projektanfrage vollständig ausfüllen und als unbeteiligte Leitung schrittweise bis zur Pilotphase prüfen. Der Anfragende sieht den neuen Stand. Nach einem Botneustart bleibt er bestehen.
7. Als zuständiges Teammitglied `/faelle` und `/team` prüfen; Zahlungsfälle bleiben auf die Finanzzuständigkeit beziehungsweise den Inhaber begrenzt.
8. `/serverpruefen` ausführen und die gemeldete Struktur, Botrechte und Rangfolge der Auswahlrollen mit Discord vergleichen.
