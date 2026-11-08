# Fattura PEC per Thunderbird

Seleziona una PEC e fai clic su **Visualizza fattura** nella barra del messaggio. Thunderbird apre una scheda interna con fornitore, cliente, numero, data, righe, riepilogo IVA e totale, se riportato nell’XML. Se ci sono più documenti, anche in un lotto FatturaPA, la scheda mostra l’elenco.

[Scarica il pacchetto .xpi dalle release](https://github.com/diegocom/thunderbird-fattura-pec/releases/latest)

## Installazione e rimozione

1. Usa Thunderbird desktop **153.0 o successivo** su Windows o macOS. Il pacchetto si chiama `fattura-pec-1.2.0.xpi`.
2. In Thunderbird apri **≡ → Componenti aggiuntivi e temi**. Premi l’ingranaggio accanto alla ricerca e scegli **Installa componente aggiuntivo da file…**.
3. Seleziona il file `.xpi` e conferma il permesso per salvare file. Se hai già Fattura PEC, installa l’XPI sopra la versione esistente. Torna alla posta, seleziona un solo messaggio e fai clic su **Visualizza fattura**. Se il riquadro del messaggio è chiuso, riaprilo con **F8**.
4. Per rimuovere l’estensione, apri **≡ → Componenti aggiuntivi e temi → Estensioni**. Accanto a **Fattura PEC**, premi **⋯ → Rimuovi** e conferma.

[Guida ufficiale all’installazione](https://support.mozilla.org/it/kb/installare-componenti-aggiuntivi-thunderbird) · [Guida ai componenti aggiuntivi](https://support.mozilla.org/it/kb/domande-frequenti-componenti-aggiuntivi-thunderbird)

## Salva una fattura in PDF

1. Nella scheda della fattura fai clic su **Salva PDF**. Se la scheda mostra un elenco, apri prima il documento che vuoi esportare.
2. Nella finestra **Salva con nome**, scegli nome e cartella, poi premi **Salva**. Il nome proposto include data e numero della fattura.

Il PDF contiene la fattura visualizzata, con intestazioni delle tabelle ripetute sulle pagine successive. La libreria pdfmake e i font sono inclusi nel pacchetto. Il PDF è generato in memoria e salvato in locale.

## Prova con le PEC sintetiche

1. Estrai lo ZIP dei sorgenti. In Thunderbird fai clic destro su **Cartelle locali**, scegli **Nuova cartella…** e chiamala `Prova Fattura PEC`.
2. Da Esplora file o Finder trascina i file `.eml` della cartella `fixtures` sulla nuova cartella, nel pannello sinistro di Thunderbird.
3. Apri la cartella, seleziona a turno i messaggi e premi **Visualizza fattura**.

| Messaggio | Risultato atteso |
| --- | --- |
| 01 XML diretto, 02 XML annidato, 03 P7M annidato come file, 07 P7M annidato RFC 822 | Apertura diretta di `DEMO/01`, totale `122,00 EUR` |
| 04 Soli metadati | «Nessuna fattura elettronica trovata in questo messaggio.» |
| 05 Più fatture | Due voci. La seconda apre `DEMO/02`. |
| 06 XML illeggibile | Messaggio di errore con il nome `fattura-rotta.xml` |
| 08 XML semplificato | `DEMO/S1` con due righe e i dati IVA riportati nel documento |

## Compatibilità e dati

Manifest V3, sviluppato per la serie **153 ESR**. Il minimo è **153.0**, che introduce `MessageAttachment.type` per distinguere gli allegati inclusi nel messaggio da quelli collegati, rimossi o salvati a parte. Il permesso `messagesRead` serve alla lettura del messaggio e degli allegati. Il permesso `downloads` serve ad aprire il selettore di destinazione e salvare il PDF creato dall’estensione. L’estensione passa all’API solo un URL `blob:` locale e controlla l’esito del singolo salvataggio.

[Note della ESR 153.6.0](https://www.thunderbird.net/en-US/thunderbird/153.6.0esr/releasenotes/) · [Manifest V3](https://developer.thunderbird.net/add-ons/updating/tb128) · [API messaggi](https://webextension-api.thunderbird.net/en/esr-mv3/messages.html) · [API di salvataggio](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/download)

Il pacchetto include PostalMime per leggere `postacert.eml` quando Thunderbird lo espone come file e ASN1js per estrarre l’XML incorporato in CMS SignedData. L’estensione legge gli allegati in memoria, renderizza i valori come testo e funziona offline quando Thunderbird ha già il messaggio. L’anteprima è per consultazione. La verifica della firma e la validazione fiscale sono fuori perimetro. L’estensione legge fino a 25 MiB per allegato XML o P7M e fino a 40 MiB per EML.

Collaudo completato su Windows con Thunderbird 153.6.0 ESR in un profilo offline. La versione 1.2.0 è stata installata sopra la 1.1.0. Sono stati verificati il selettore nativo, l’annullamento e il salvataggio di un PDF di una pagina e di uno con 90 righe. Su macOS resta da eseguire la prova in Thunderbird.

## Test e build dai sorgenti

Servono Node.js 22.12 o successivo e Python 3. Su Windows puoi usare `py -3` al posto di `python3`.

```sh
npm ci
npm test
npm run build
python3 scripts/package.py
```

Il pacchetto viene creato in `dist/`. Le fixture sono già incluse. OpenSSL serve solo se vuoi rigenerare la fixture firmata con `python3 scripts/fixtures.py --openssl openssl`.

## Licenza

Il codice di Fattura PEC è distribuito con [licenza MIT](LICENSE). Le librerie e i font inclusi nell’XPI mantengono le rispettive licenze.
