# Firefox Local Bridge — ghid pentru utilizatori

**Tu alegi browserul, durata și acțiunile permise.** Versiunea 0.2.0 este un prototip independent pentru Windows; nu este un produs oficial Mozilla sau OpenAI.

## Instalare simplă

Descarcă **`firefox-local-bridge-v0.2.0-windows.zip`**, extrage-l într-un dosar permanent și deschide **`START-HERE.html`**. Ghidul poate fi citit fără internet și are pași în română, engleză și rusă.

1. Rulează **`Setup-Windows.cmd` din Explorer**. El detectează Node.js, înregistrează componenta Firefox și adaugă conexiunea locală în Codex. Păstrează celelalte setări și face o copie de rezervă. Nu ai nevoie de administrator și nici de comenzi pentru instalarea bibliotecilor în pachetul Windows.
2. Dacă nu găsește Node.js, instalează **Node.js 24 LTS** de pe [site-ul oficial](https://nodejs.org/) și rulează din nou instalarea. Dacă există deja runtime-ul inclus în Codex, programul îl poate folosi.
3. În Firefox 140+ deschide `about:debugging#/runtime/this-firefox`, apasă **Load Temporary Add-on / Загрузить временное дополнение** și selectează **`extension/manifest.json`**.
4. Repornește complet ChatGPT/Codex. Deschide un site obișnuit, apasă pictograma extensiei și alege limba **Română**.
5. Alege domeniul accesului și durata, apoi pornește **Acces pentru asistent**.

Test: **„Verifică Firefox Local Bridge, arată filele disponibile și citește fila activă.”**

Extensia este momentan instalată **temporar**: după repornirea Firefox trebuie încărcată din nou. Instalarea permanentă necesită o versiune semnată de Mozilla. Nu dezactiva verificarea semnăturilor.

## Durata accesului

- Alege 15 minute, 1 oră, 4 ore sau 1 zi.
- **Aleg eu durata**: introdu un număr întreg de minute, ore sau zile, între 1 minut și 365 de zile.
- **Până îl opresc eu**: nu există cronometru. Accesul se termină la oprire, deconectare ori repornirea Firefox/extensiei.
- Într-o sesiune activă poți schimba durata și apăsa **Aplică durata începând de acum**. Durata se calculează de la acel moment.
- Asistentul poate propune o durată, cu un motiv. O vezi în extensie și alegi **Permite** sau **Respinge**. Nu își poate prelungi singur accesul. Dacă sesiunea este deja oprită, o reactivezi tu.

Limba, durata preferată și domeniul accesului sunt reținute. Accesul activ și permisiunea pentru ferestre private nu sunt reținute; după repornire accesul este oprit.

## Domeniul accesului și confirmările

**Tot browserul** permite lucrul cu filele web disponibile în timpul sesiunii. **Doar fila curentă** se oprește la navigare sau reîncărcare. Pentru ferestre private sunt necesare atât permisiunea acordată manual în setările Firefox, cât și comutatorul extensiei.

Citirea și derularea folosesc sesiunea activată. Pentru fiecare apăsare, completare de câmp sau navigare apare un **?** pe pictogramă: deschide extensia și confirmă sau respinge acțiunea în aproximativ 90 de secunde. Oprirea accesului anulează cererile în așteptare, dar nu anulează acțiunile deja efectuate.

Paginile interne Firefox, unele domenii protejate și editorii complecși nu sunt suportate. Câmpurile de parole, plăți și coduri unice sunt blocate pentru completare; filtrarea nu este o garanție pentru toate site-urile.

## Dacă nu se conectează

- **No such native application**: deschide **`.installed/Register-Firefox.reg` din Explorer**, confirmă înregistrarea acestei componente și repornește asistentul. Unele aplicații împachetate izolează înregistrarea făcută din interiorul lor.
- **Disconnected / MCP session unavailable**: verifică dacă asistentul este pornit, serverul `firefox_local_bridge` este activ și nu este folosit de un al doilea chat. Repornește asistentul, apoi pornește din nou accesul.
- **Alt client MCP**: valorile exacte sunt în **`.installed/Connection.html`**, creat după instalare. Alege STDIO și 120 de secunde pentru așteptarea comenzilor.
- Dacă muți dosarul, dezinstalează vechea înregistrare și rulează instalarea din noua locație.

## Actualizare și dezinstalare

Dacă ai deja versiunea 0.1 și dosarul a fost actualizat în același loc, apasă **Reload / Перезагрузить** lângă extensie în `about:debugging`, repornește asistentul și activează o sesiune nouă. Nu trebuie reimportată înregistrarea dacă dosarul nu s-a schimbat.

Pentru eliminare: oprește accesul, rulează **`Uninstall-Windows.cmd` din Explorer**, apoi elimină extensia și intrarea MCP din asistent. Fișierele proiectului rămân.

## Date și starea proiectului

Proiectul nu are server propriu în cloud și nu are telemetrie. Totuși, **textul citit ajunge în conversație și poate fi procesat de furnizorul asistentului AI**. Vezi [SECURITY.md](SECURITY.md).

Pachetul **`github-source.zip`** este pentru publicarea codului pe GitHub; pachetul **`windows.zip`** este pentru utilizatori. Versiunea 0.2 a fost verificată automat; funcțiile noi de durată și instalarea pe un cont Windows curat necesită și verificare manuală. Numele recomandat pentru repository: **`firefox-local-bridge`**.
