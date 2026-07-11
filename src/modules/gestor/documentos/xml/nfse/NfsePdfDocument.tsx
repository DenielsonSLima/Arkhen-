import React from 'react';
import type { NfseFiscalData, XmlFiscalParty, XmlFiscalSummary } from '../shared/xmlFiscalTypes';
import { resolveNfseVisualIdentity, type NfseVisualIdentityOptions } from './nfseVisualIdentity';
import './NfseXmlViewer.css';

const safeValue = (value?: string) => value || '-';

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const formatDocument = (value: string) => {
  const digits = onlyDigits(value);
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return value || '-';
};

const normalizeBooleanLabel = (value: string) => {
  if (value === '1' || value.toLowerCase() === 'true') return 'Sim';
  if (value === '2' || value === '0' || value.toLowerCase() === 'false') return 'Não';
  return value || '-';
};

const qrCells = (payload: string) => {
  const source = payload || 'nfse';
  let seed = 0;
  for (let index = 0; index < source.length; index += 1) {
    seed = (seed * 31 + source.charCodeAt(index)) >>> 0;
  }

  return Array.from({ length: 81 }, (_, index) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const finder = (row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3);
    if (finder) return row === 0 || row === 2 || col === 0 || col === 2 || (row % 2 === 1 && col % 2 === 1);
    return ((seed >> ((index + row + col) % 24)) & 1) === 1;
  });
};

const Field: React.FC<{ label: string; value?: string; wide?: boolean }> = ({ label, value, wide }) => (
  <div className={wide ? 'nfse-field nfse-field-wide' : 'nfse-field'}>
    <span>{label}</span>
    <strong>{safeValue(value)}</strong>
  </div>
);

const PartyBlock: React.FC<{ title: string; party: XmlFiscalParty }> = ({ title, party }) => (
  <section className="nfse-box">
    <h3>{title}</h3>
    <div className="nfse-party-grid">
      <Field label="Nome/Razão Social" value={party.nome} wide />
      <Field label="CPF/CNPJ" value={formatDocument(party.documento)} />
      <Field label="Inscrição Municipal" value={party.inscricaoMunicipal} />
      <Field label="Inscrição Estadual" value={party.inscricaoEstadual} />
      <Field label="Telefone" value={party.telefone} />
      <Field label="E-mail" value={party.email} />
      <Field label="Endereço" value={party.endereco} wide />
      <Field label="Município/UF" value={[party.municipio, party.uf].filter(Boolean).join('/')} />
      <Field label="CEP" value={party.cep} />
    </div>
  </section>
);

const TaxCell: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="nfse-tax-cell">
    <span>{label}</span>
    <strong>{safeValue(value)}</strong>
  </div>
);

const NfseQrCode: React.FC<{ payload: string }> = ({ payload }) => (
  <div className="nfse-qr" aria-label="QR Code da NFS-e">
    {qrCells(payload).map((active, index) => (
      <span key={index} className={active ? 'active' : ''} />
    ))}
  </div>
);

const getMunicipioHeader = (nfse: NfseFiscalData) => (
  nfse.prestador.municipio
    ? `PREFEITURA MUNICIPAL DE ${nfse.prestador.municipio.toUpperCase()}`
    : 'PREFEITURA MUNICIPAL'
);

interface NfsePdfDocumentProps extends NfseVisualIdentityOptions {
  summary: XmlFiscalSummary;
}

export const NfsePdfDocument: React.FC<NfsePdfDocumentProps> = ({
  summary,
  emitidaPeloSistema,
  empresaLogoUrl,
  empresaNome,
  marcaDaguaTexto,
}) => {
  const nfse = summary.nfse;

  if (!nfse) {
    return (
      <div className="nfse-viewer">
        <article className="nfse-page">
          <section className="nfse-empty">
            <h2>NFS-e sem dados suficientes</h2>
            <p>O XML foi identificado como NFS-e, mas não possui os campos necessários para montar o espelho da nota.</p>
          </section>
        </article>
      </div>
    );
  }

  const total = nfse.valorLiquido || nfse.valorServicos || summary.sections
    .flatMap((section) => section.fields)
    .find((field) => field.label === 'Valor informado')?.value || '-';
  const identity = resolveNfseVisualIdentity(nfse, {
    emitidaPeloSistema,
    empresaLogoUrl,
    empresaNome,
    marcaDaguaTexto,
  });

  return (
    <div className="nfse-viewer">
      <article className="nfse-page">
        {identity.marcaDaguaTexto ? (
          <div className="nfse-watermark">{identity.marcaDaguaTexto}</div>
        ) : null}

        <header className="nfse-header">
          <div className="nfse-city">
            {identity.prefeituraLogoUrl ? (
              <img
                className="nfse-prefeitura-logo"
                src={identity.prefeituraLogoUrl}
                alt={identity.prefeituraNome || getMunicipioHeader(nfse)}
              />
            ) : (
              <div className="nfse-seal">NF</div>
            )}
            <div>
              <p>{identity.prefeituraNome || getMunicipioHeader(nfse)}</p>
              <strong>Secretaria Municipal da Fazenda</strong>
              <span>Documento Auxiliar da Nota Fiscal de Serviços Eletrônica</span>
            </div>
          </div>

          <div className="nfse-brand">
            {identity.empresaLogoUrl ? (
              <img className="nfse-company-logo" src={identity.empresaLogoUrl} alt={identity.empresaNome || 'Empresa emitente'} />
            ) : (
              <div className="nfse-logo">NFS-e</div>
            )}
            <span>{identity.empresaNome || 'Nota Fiscal de Serviço Eletrônica'}</span>
          </div>

          <aside className="nfse-number-box">
            <Field label="Número da NFS-e" value={nfse.numero || summary.title} />
            <Field label="Data e Hora de Emissão" value={nfse.dataEmissao} />
            <Field label="Código de Verificação" value={nfse.codigoVerificacao} />
          </aside>

          <div className="nfse-qr-wrap">
            <NfseQrCode payload={nfse.qrPayload || summary.subtitle} />
            <span>Autenticidade consultável pelo código de verificação</span>
          </div>
        </header>

        <section className="nfse-strip">
          <Field label="Competência" value={nfse.competencia} />
          <Field label="Município de Prestação" value={nfse.municipioPrestacao} />
          <Field label="Natureza da Operação" value={nfse.naturezaOperacao} />
          <Field label="Status do XML" value={summary.status} />
        </section>

        <PartyBlock title="Prestador de Serviços" party={nfse.prestador} />
        <PartyBlock title="Tomador de Serviços" party={nfse.tomador} />

        <section className="nfse-box nfse-service">
          <h3>Discriminação dos Serviços</h3>
          <div className="nfse-service-text">{safeValue(nfse.discriminacao)}</div>
          <div className="nfse-service-grid">
            <Field label="Item da Lista de Serviço" value={nfse.itemListaServico} />
            <Field label="Código de Tributação Municipal" value={nfse.codigoServico} />
            <Field label="CNAE" value={nfse.cnae} />
            <Field label="Regime de Tributação" value={nfse.regimeTributacao} />
            <Field label="Optante Simples Nacional" value={normalizeBooleanLabel(nfse.optanteSimples)} />
            <Field label="Incentivador Cultural" value={normalizeBooleanLabel(nfse.incentivadorCultural)} />
          </div>
        </section>

        <section className="nfse-box">
          <h3>Valores e Tributos Municipais</h3>
          <div className="nfse-tax-grid">
            <TaxCell label="Valor dos Serviços" value={nfse.valorServicos} />
            <TaxCell label="Deduções" value={nfse.deducoes} />
            <TaxCell label="Descontos" value={nfse.descontos} />
            <TaxCell label="Base de Cálculo" value={nfse.baseCalculo} />
            <TaxCell label="Alíquota" value={nfse.aliquota} />
            <TaxCell label="Valor do ISS" value={nfse.valorIss} />
            <TaxCell label="ISS Retido" value={normalizeBooleanLabel(nfse.issRetido)} />
            <TaxCell label="Valor Líquido" value={nfse.valorLiquido} />
          </div>
        </section>

        <section className="nfse-box">
          <h3>Tributos Federais</h3>
          <div className="nfse-tax-grid federal">
            <TaxCell label="PIS" value={nfse.pis} />
            <TaxCell label="COFINS" value={nfse.cofins} />
            <TaxCell label="INSS" value={nfse.inss} />
            <TaxCell label="IR" value={nfse.ir} />
            <TaxCell label="CSLL" value={nfse.csll} />
          </div>
        </section>

        <section className="nfse-total-row">
          <span>Valor Total da NFS-e</span>
          <strong>{total}</strong>
        </section>

        <section className="nfse-box nfse-info">
          <h3>Outras Informações</h3>
          <p>{safeValue(nfse.outrasInformacoes || 'Documento gerado a partir do XML fiscal recebido.')}</p>
        </section>
      </article>
    </div>
  );
};
