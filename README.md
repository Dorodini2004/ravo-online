# Trading Basics Academy

Eine deutschsprachige Lernwebsite für Patrik und Fabian auf der vorhandenen Next.js-16-/React-19-Struktur. Ausschließlich Grundlagen und simulierte Daten, keine Handelsstrategie, Signale oder Echtgeldanbindung.

## Online-Veröffentlichung

Für dieses Projekt wird das bereits mit GitHub verbundene Render-Hosting verwendet:
`https://ravo-online.onrender.com`. Die Adresse darf erst nach erfolgreichem
Render-Deployment als neue Academy-Version betrachtet werden.

Die Unterseiten verwenden direkte Hash-Links, etwa `/#lessons/3`, `/#tests` und
`/#settings`; sie funktionieren ohne serverseitige Sitzungen und nach Neuladen.
Der Browser-Test prüft alle zehn Bereiche direkt und nach Neuladen.

Render baut aus `Dorodini2004/ravo-online`, Branch `main`. Startkommando bleibt
`NODE_ENV=production npm run start`; der Server verwendet Render-Port `PORT` und
bindet in Produktion an `0.0.0.0`. Der vorhandene kostenlose Tarif wird beibehalten.
Der Betrieb hängt nicht vom eingeschalteten PC ab. Kostenlose Render-Webdienste
können bei Inaktivität schlafen; der nächste Aufruf startet sie wieder.

Lokale Lernstände werden nicht hochgeladen. Vor dem Wechsel zur Online-Adresse
in der lokalen Academy **JSON exportieren**, dann online **JSON importieren**.
Backups nicht in `public/` ablegen. `.gitignore` schließt bekannte Backupnamen,
Projektarchive und den fremden Projektordner aus. Die Veröffentlichung benötigt
keine API-Schlüssel oder sonstigen Geheimnisse im Frontend.

Vor jeder Veröffentlichung:

```powershell
npm.cmd test
npm.cmd run build
node scripts/academy-release-check.mjs
```

Der Release-Check prüft auslieferbare Dateien auf bekannte Geheimnisformate,
private Backupnamen und Browser-Testnotizen; neue Profile müssen leer sein.
Nach dem Deployment kann die tatsächliche HTTPS-Seite mit einem isolierten
Browserprofil geprüft werden:

```powershell
$env:ACADEMY_URL="https://ravo-online.onrender.com"
npm.cmd run test:academy:browser
```

Offizielle Hosting-Dokumentation: [Render-Deployments](https://render.com/docs/deploys)
und [Grenzen kostenloser Webdienste](https://render.com/docs/free).

## Lokale Entwicklung

Voraussetzung: Node.js 24 und npm.

```powershell
npm.cmd install
npm.cmd run dev:academy
```

Dann **http://127.0.0.1:3000** öffnen. Unter Windows vermeidet `npm.cmd` mögliche PowerShell-Ausführungsrichtlinien für `npm.ps1`. Auf anderen Systemen funktioniert `npm run dev:academy`.

Immer dieselbe Adresse verwenden: `localhost` und `127.0.0.1` haben getrennte lokale Browserspeicher. Die Vorschau ist nur an den eigenen Rechner gebunden. Das Layout ist für Smartphone, Desktop und breite Monitore ausgelegt.

## Benutzen

1. Oben rechts **Patrik** oder **Fabian** auswählen.
2. Mit **Weiterlernen** oder dem **14-Tage-Lernpfad** beginnen. Jede Lektion enthält Ziele, Erklärungen, Beispiele, Zahlenaufgabe, typische Fehler, Zusammenfassung und acht Quizfragen.
3. **Als bearbeitet markieren** zählt zum Lesefortschritt. Verständnis wird separat über bestandene Quiz nachgewiesen (mindestens 80 %).
4. Im **Übungsbereich** zwölf Aufgabentypen bearbeiten. Die Aufgaben bieten neue Zahlen oder Szenarien, echte SVG-Charts, nachvollziehbare Lösungen und numerische Alternativen zum Zeichnen. Chartkerzen sind mit Tab und Enter bedienbar. Auf kleinen Displays ist der Chart seitlich scrollbar.
5. Tag 7: Zwischentest mit 20 Fragen. Tag 14: Abschlusstest mit 30 Fragen und praktische Aufgaben. Der vollständige Lernnachweis erfordert alle Tagesquiz, beide großen Tests und jeden Praxistyp. Bei Praxis zählt der letzte Versuch je Typ.
6. **Fehler & Wiederholungen** nutzen: nach einem Fehler ungefähr +1 Tag, dann nach richtigen Wiederholungen +3 und +7 Tage. Nach der Prüfung mit **Ergebnis speichern & weiter** speichern. Frühzeitiges Üben ist erlaubt.
7. Notizen und eigene Übungsregeln im **Lernjournal** bzw. **Regelbuch** festhalten. Die Fokuszeit unterstützt Start, Pause, Fortsetzen und **Beenden & speichern**. Beim Profilwechsel wird eine laufende Session dem bisherigen Profil zugeordnet. Eine noch nicht beendete Session muss vor dem Schließen gespeichert werden.

45–60 Minuten Kernsession pro Tag; freiwillige Vertiefung bis insgesamt ungefähr zwei Stunden. Pausentage sind erlaubt. Ein Lernnachweis ist keine Echtgeldfreigabe und kein Profitabilitätsnachweis.

## Daten sichern

**Einstellungen → JSON exportieren** sichert beide Profile einschließlich Lernfortschritt, Tests, Praxis, Fehlern, Journal, Regeln und gespeicherter Lernzeit.

**JSON importieren** prüft Version, Struktur, Datentypen, Frage-IDs, Antwortbewertungen und Testumfang. Erst nach Bestätigung werden beide lokalen Profile ersetzt. Ungültige Dateien verändern den Lernstand nicht. Der Import überträgt nichts an einen Server.

Profile sind lokale Lernprofile, keine geschützten Benutzerkonten. Alle Personen mit Zugriff auf diesen Browser können beide Profile öffnen. Keine geräteübergreifende Synchronisierung. Das Löschen von Browserdaten entfernt den Lernstand; regelmäßig exportieren. Der Browser-Schlüssel lautet `trading-basics-academy-v1`.

Es gibt keine vorbefüllten Lernstatistiken. Simulierte Chart- und Rechenbeispiele sind ausdrücklich gekennzeichnet. Quellen und Prüfdatum stehen in der Website.

## Prüfungen

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:academy:browser
```

Die Browserprüfung benötigt eine laufende lokale Vorschau und verwendet standardmäßig ein installiertes Microsoft Edge im Headless-Modus. Alternativ `$env:ACADEMY_BROWSER="chrome"` für installiertes Chrome. Jeder Durchlauf verwendet ein isoliertes, anschließend verworfenes Browserprofil und verändert keine persönlichen Lernstände. Screenshots entstehen unter `.next/academy-*.png`.

Die Unit-Tests prüfen Inhalte, Rechenlogik mit unabhängig berechneten Beispielen, Rundung und Eingabegrenzen, Datenisolation, Importvalidierung, Wiederholungsintervalle, Swing-Bestätigung, Aggregation, Zonentoleranzen und Europe/Vienna-Datumsgrenzen. Browserprüfungen decken Navigation, alle Quizgrößen, alle Praxistypen, Profilwechsel, Speicherung nach Neuladen, Journal, Import/Export, Löschbestätigung, Timer sowie Desktop-/Mobilcharts ab.

## Projektstruktur

- `src/academy/Academy.tsx`: Navigation und lokale Profile, Lernseiten, Journal und Datensicherung.
- `src/academy/content.ts`: 14 Lektionen, 112 stabile Fragen, Lexikon und Primärquellen.
- `src/academy/Chart.tsx`: interaktive SVG-Kerzen mit Zeit- und Preisachsen.
- `src/academy/Exercises.tsx`: Praxisaufgaben und zwei Rechenwerkzeuge.
- `src/academy/logic.mjs`: reine Rechen-, Speicher-, Validierungs- und Wiederholungslogik.
- `src/academy/Quiz.tsx`: gemischte Antwortreihenfolgen, Bewertung und Erklärungen.
- `src/academy/academy.css`: responsive, abgegrenzte Dark-Design-Oberfläche.

Die bisherigen Spieldateien und Routen sind erhalten. Die Academy ist die neue Startseite `/`. Der ursprüngliche Socket-Server bleibt über `npm run dev` verfügbar; für die reine Academy genügt `dev:academy`.
