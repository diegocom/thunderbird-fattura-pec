"""Rigenera i messaggi di prova. OpenSSL serve solo a rigenerare il P7M sintetico."""
import argparse
from email.message import EmailMessage
from email.policy import SMTP
from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1] / "fixtures"
INVOICE = """<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>00000000000</IdCodice></IdTrasmittente>
      <ProgressivoInvio>DEMO</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000000</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>Fornitore Dimostrativo S.r.l.</Denominazione></Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede><Indirizzo>Via di Prova 1</Indirizzo><CAP>00100</CAP><Comune>Roma</Comune><Nazione>IT</Nazione></Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>11111111111</IdCodice></IdFiscaleIVA>
        <Anagrafica><Nome>Anna</Nome><Cognome>Dimostrativa</Cognome></Anagrafica>
      </DatiAnagrafici>
      <Sede><Indirizzo>Via di Prova 2</Indirizzo><CAP>00100</CAP><Comune>Roma</Comune><Nazione>IT</Nazione></Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali><DatiGeneraliDocumento>
      <TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-11-03</Data>
      <Numero>DEMO/01</Numero><ImportoTotaleDocumento>122.00</ImportoTotaleDocumento>
    </DatiGeneraliDocumento></DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea><Descrizione>Attività di prova &lt;img src=x onerror=alert(1)&gt;</Descrizione>
        <Quantita>2.00</Quantita><PrezzoUnitario>50.00</PrezzoUnitario>
        <PrezzoTotale>100.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>100.00</ImponibileImporto><Imposta>22.00</Imposta></DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
"""

SIMPLIFIED = """<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronicaSemplificata xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.0" versione="FSM10">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>00000000000</IdCodice></IdTrasmittente>
      <ProgressivoInvio>DEMO</ProgressivoInvio><FormatoTrasmissione>FSM10</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000000</IdCodice></IdFiscaleIVA>
      <Denominazione>Fornitore Dimostrativo S.r.l.</Denominazione>
      <Sede><Indirizzo>Via di Prova 1</Indirizzo><CAP>00100</CAP><Comune>Roma</Comune><Nazione>IT</Nazione></Sede>
      <RegimeFiscale>RF01</RegimeFiscale>
    </CedentePrestatore>
    <CessionarioCommittente>
      <IdentificativiFiscali><CodiceFiscale>11111111111</CodiceFiscale></IdentificativiFiscali>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali><DatiGeneraliDocumento>
      <TipoDocumento>TD07</TipoDocumento><Divisa>EUR</Divisa><Data>2026-11-03</Data><Numero>DEMO/S1</Numero>
    </DatiGeneraliDocumento></DatiGenerali>
    <DatiBeniServizi>
      <Descrizione>Servizio di prova</Descrizione><Importo>55.00</Importo><DatiIVA><Aliquota>10.00</Aliquota></DatiIVA>
    </DatiBeniServizi>
    <DatiBeniServizi>
      <Descrizione>Articolo di prova</Descrizione><Importo>12.20</Importo><DatiIVA><Imposta>2.20</Imposta></DatiIVA>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronicaSemplificata>
"""


def mail(subject, identifier, pec=False):
    message = EmailMessage(policy=SMTP)
    message["From"] = "PEC di prova <pec@example.invalid>"
    message["To"] = "Destinatario di prova <utente@example.invalid>"
    message["Subject"] = subject
    message["Date"] = f"Tue, 03 Nov 2026 12:{identifier:02}:00 +0100"
    message["Message-ID"] = f"<fattura-pec-{identifier}@example.invalid>"
    if pec:
        message["X-Trasporto"] = "posta-certificata"
        message["X-TipoRicevuta"] = "completa"
    message.set_content("Messaggio sintetico per la prova di Fattura PEC.")
    return message


def add_xml(message, name, contents):
    message.add_attachment(contents.encode("utf-8"), maintype="application", subtype="xml", filename=name)


def add_metadata(message):
    add_xml(message, "daticert.xml",
            '<?xml version="1.0" encoding="ISO-8859-1"?>\n<!DOCTYPE postacert SYSTEM "daticert.dtd">\n'
            '<postacert tipo="posta-certificata"><dati/></postacert>')


def original(identifier):
    return mail("Messaggio originale di prova", 10 + identifier)


def signed_xml(openssl):
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder)
        (path / "invoice.xml").write_bytes(INVOICE.encode("utf-8"))
        subprocess.run([
            openssl, "req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes",
            "-subj", "/CN=Fattura PEC Fixture", "-days", "30", "-out", "cert.pem", "-keyout", "key.pem",
        ], cwd=path, check=True, stderr=subprocess.DEVNULL)
        return subprocess.check_output([
            openssl, "cms", "-sign", "-cades", "-binary", "-nodetach", "-outform", "DER",
            "-signer", "cert.pem", "-inkey", "key.pem", "-in", "invoice.xml",
        ], cwd=path)


def generate(openssl):
    ROOT.mkdir(exist_ok=True)

    direct = mail("01 PEC con XML diretto", 1, pec=True)
    add_metadata(direct)
    add_xml(direct, "IT00000000000_demo.xml", INVOICE)

    nested = mail("02 PEC con XML in postacert.eml", 2, pec=True)
    add_metadata(nested)
    nested_xml = original(2)
    add_xml(nested_xml, "IT00000000000_demo.xml", INVOICE)
    nested.add_attachment(nested_xml, filename="postacert.eml")

    signed = mail("03 PEC con P7M in postacert.eml", 3, pec=True)
    add_metadata(signed)
    nested_p7m = original(3)
    p7m = signed_xml(openssl)
    nested_p7m.add_attachment(p7m, maintype="application", subtype="pkcs7-mime",
                              filename="IT00000000000_demo.xml.p7m")
    # Un EML generico e codificato base64 esercita il parser MIME di riserva.
    signed.add_attachment(nested_p7m.as_bytes(), maintype="application", subtype="octet-stream",
                          filename="postacert.eml")

    metadata = mail("04 PEC con soli metadati", 4, pec=True)
    add_metadata(metadata)
    nested_meta = original(4)
    add_xml(nested_meta, "IT00000000000_demo.xml", "<MetadatiInvioFile><IdentificativoSdI>123</IdentificativoSdI></MetadatiInvioFile>")
    add_xml(nested_meta, "notifica.xml", "<NotificaScarto><IdentificativoSdI>123</IdentificativoSdI></NotificaScarto>")
    metadata.add_attachment(nested_meta, filename="postacert.eml")

    multiple = mail("05 PEC con due fatture", 5, pec=True)
    add_metadata(multiple)
    add_xml(multiple, "fattura-1.xml", INVOICE)
    multi_nested = original(5)
    add_xml(multi_nested, "fattura-2.xml", INVOICE.replace("DEMO/01", "DEMO/02"))
    multiple.add_attachment(multi_nested, filename="postacert.eml")

    broken = mail("06 PEC con XML illeggibile", 6, pec=True)
    add_metadata(broken)
    add_xml(broken, "fattura-rotta.xml", "<FatturaElettronica>")

    native_signed = mail("07 PEC con P7M in postacert.eml RFC 822", 7, pec=True)
    add_metadata(native_signed)
    native_original = original(7)
    native_original.add_attachment(p7m, maintype="application", subtype="pkcs7-mime",
                                   filename="IT00000000000_demo.xml.p7m")
    native_original.get_payload()[-1].set_param("smime-type", "signed-data")
    native_signed.add_attachment(native_original, filename="postacert.eml")

    simplified = mail("08 PEC con XML semplificato", 8, pec=True)
    add_xml(simplified, "fattura-semplificata.xml", SIMPLIFIED)

    for name, message in {
        "01-xml-diretto": direct, "02-xml-annidato": nested, "03-p7m-annidato": signed,
        "04-soli-metadati": metadata, "05-piu-fatture": multiple, "06-xml-illeggibile": broken,
        "07-p7m-rfc822": native_signed, "08-xml-semplificato": simplified,
    }.items():
        (ROOT / f"{name}.eml").write_bytes(message.as_bytes())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--openssl", default="openssl")
    generate(parser.parse_args().openssl)
