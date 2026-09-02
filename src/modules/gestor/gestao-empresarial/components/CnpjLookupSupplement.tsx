import React from 'react';
import type { CompanyLookupDraft } from '../services/cnpjLookupService';

interface CnpjLookupSupplementProps {
  snapshot?: CompanyLookupDraft;
}

const formatDate = (value?: string) => {
  if (!value) return '-';
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
};

export const CnpjLookupSupplement: React.FC<CnpjLookupSupplementProps> = ({ snapshot }) => {
  const hasSupplementalData = Boolean(
    snapshot?.porteOficial
    || snapshot?.naturezaJuridica
    || snapshot?.situacaoCadastral
    || snapshot?.dataSituacaoCadastral
    || snapshot?.situacaoEspecial
    || snapshot?.dataInicioAtividade
    || snapshot?.identificadorMatrizFilial
    || snapshot?.telefoneAlternativo
    || snapshot?.fax
    || snapshot?.opcaoPeloSimples !== undefined
    || snapshot?.opcaoPeloMei !== undefined
    || snapshot?.codigoMunicipioIbge
    || snapshot?.cnaesSecundarios?.length
    || snapshot?.regimeTributarioHistorico?.length
    || snapshot?.qsa?.length,
  );

  if (!snapshot || !hasSupplementalData) return null;

  return (
    <section className="detail-card-section">
      <div className="section-title-row">
        <h4>Dados oficiais complementares do CNPJ</h4>
      </div>
      <div className="details-grid-layout">
        {snapshot.situacaoCadastral && (
          <div className="detail-field-box">
            <label>Situação cadastral</label>
            <p>{snapshot.situacaoCadastral}</p>
          </div>
        )}
        {snapshot.dataSituacaoCadastral && (
          <div className="detail-field-box">
            <label>Data da situação cadastral</label>
            <p>{formatDate(snapshot.dataSituacaoCadastral)}</p>
          </div>
        )}
        {snapshot.motivoSituacaoCadastral && (
          <div className="detail-field-box">
            <label>Motivo da situação cadastral</label>
            <p>
              {snapshot.motivoSituacaoCadastral}
              {snapshot.motivoSituacaoCadastralCodigo
                ? ` (${snapshot.motivoSituacaoCadastralCodigo})`
                : ''}
            </p>
          </div>
        )}
        {snapshot.dataInicioAtividade && (
          <div className="detail-field-box">
            <label>Início da atividade</label>
            <p>{formatDate(snapshot.dataInicioAtividade)}</p>
          </div>
        )}
        {snapshot.identificadorMatrizFilial && (
          <div className="detail-field-box">
            <label>Estabelecimento na Receita</label>
            <p>{snapshot.identificadorMatrizFilial}</p>
          </div>
        )}
        {snapshot.porteOficial && (
          <div className="detail-field-box">
            <label>Porte oficial retornado</label>
            <p>{snapshot.porteOficial}</p>
          </div>
        )}
        {snapshot.naturezaJuridica && (
          <div className="detail-field-box">
            <label>Natureza jurídica oficial</label>
            <p>
              {snapshot.naturezaJuridica}
              {snapshot.naturezaJuridicaCodigo ? ` (${snapshot.naturezaJuridicaCodigo})` : ''}
            </p>
          </div>
        )}
        {snapshot.telefoneAlternativo && (
          <div className="detail-field-box">
            <label>Telefone alternativo</label>
            <p>{snapshot.telefoneAlternativo}</p>
          </div>
        )}
        {snapshot.fax && (
          <div className="detail-field-box">
            <label>Fax</label>
            <p>{snapshot.fax}</p>
          </div>
        )}
        {snapshot.opcaoPeloSimples !== undefined && (
          <div className="detail-field-box">
            <label>Opção pelo Simples na Receita</label>
            <p>
              {snapshot.opcaoPeloSimples ? 'Sim' : 'Não'}
              {snapshot.dataOpcaoPeloSimples
                ? ` — desde ${formatDate(snapshot.dataOpcaoPeloSimples)}`
                : ''}
              {snapshot.dataExclusaoDoSimples
                ? ` — exclusão em ${formatDate(snapshot.dataExclusaoDoSimples)}`
                : ''}
            </p>
          </div>
        )}
        {snapshot.opcaoPeloMei !== undefined && (
          <div className="detail-field-box">
            <label>Opção pelo MEI na Receita</label>
            <p>
              {snapshot.opcaoPeloMei ? 'Sim' : 'Não'}
              {snapshot.dataOpcaoPeloMei
                ? ` — desde ${formatDate(snapshot.dataOpcaoPeloMei)}`
                : ''}
              {snapshot.dataExclusaoDoMei
                ? ` — exclusão em ${formatDate(snapshot.dataExclusaoDoMei)}`
                : ''}
            </p>
          </div>
        )}
        {snapshot.situacaoEspecial && (
          <div className="detail-field-box">
            <label>Situação especial</label>
            <p>
              {snapshot.situacaoEspecial}
              {snapshot.dataSituacaoEspecial
                ? ` — desde ${formatDate(snapshot.dataSituacaoEspecial)}`
                : ''}
            </p>
          </div>
        )}
        {(snapshot.codigoMunicipio || snapshot.codigoMunicipioIbge) && (
          <div className="detail-field-box">
            <label>Códigos do município</label>
            <p>
              {snapshot.codigoMunicipio ? `Receita: ${snapshot.codigoMunicipio}` : ''}
              {snapshot.codigoMunicipio && snapshot.codigoMunicipioIbge ? ' · ' : ''}
              {snapshot.codigoMunicipioIbge ? `IBGE: ${snapshot.codigoMunicipioIbge}` : ''}
            </p>
          </div>
        )}
        {(snapshot.pais || snapshot.nomeCidadeExterior) && (
          <div className="detail-field-box">
            <label>Localização internacional</label>
            <p>
              {[snapshot.nomeCidadeExterior, snapshot.pais].filter(Boolean).join(' / ')}
              {snapshot.codigoPais ? ` (${snapshot.codigoPais})` : ''}
            </p>
          </div>
        )}
        {snapshot.enteFederativoResponsavel && (
          <div className="detail-field-box">
            <label>Ente federativo responsável</label>
            <p>
              {snapshot.enteFederativoResponsavel}
              {snapshot.qualificacaoResponsavelCodigo
                ? ` · qualificação ${snapshot.qualificacaoResponsavelCodigo}`
                : ''}
            </p>
          </div>
        )}
        {snapshot.cnaesSecundarios?.length ? (
          <div className="detail-field-box">
            <label>CNAEs secundários</label>
            <p>{snapshot.cnaesSecundarios.map((item) => (
              item.descricao ? `${item.codigo} — ${item.descricao}` : item.codigo
            )).join('; ')}</p>
          </div>
        ) : null}
        {snapshot.regimeTributarioHistorico?.length ? (
          <div className="detail-field-box">
            <label>Histórico tributário retornado</label>
            <p>{snapshot.regimeTributarioHistorico.map((item) => (
              `${item.ano || 'Ano não informado'} — ${item.formaTributacao}`
              + (item.cnpjSCP ? ` · SCP ${item.cnpjSCP}` : '')
              + (item.quantidadeEscrituracoes !== undefined
                ? ` · ${item.quantidadeEscrituracoes} escrituração(ões)`
                : '')
            )).join('; ')}</p>
          </div>
        ) : null}
        {snapshot.qsa?.length ? (
          <div className="detail-field-box">
            <label>Quadro societário público</label>
            <p>{snapshot.qsa.map((member) => {
              const details = [
                member.qualificacao,
                member.tipoSocio,
                member.dataEntradaSociedade
                  ? `desde ${formatDate(member.dataEntradaSociedade)}`
                  : '',
                member.faixaEtaria,
                member.pais,
                member.nomeRepresentanteLegal
                  ? `representante: ${member.nomeRepresentanteLegal}`
                  : '',
                member.qualificacaoRepresentanteLegal,
              ].filter(Boolean).join(' · ');
              return details ? `${member.nome} — ${details}` : member.nome;
            }).join('; ')}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
};
