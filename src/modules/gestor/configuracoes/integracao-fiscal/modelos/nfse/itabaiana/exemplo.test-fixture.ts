/** Fixture demonstrativa, sem assinatura/autorização fiscal; não transmitir ao WebISS. */
export const exemploXml = `<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd"><Nfse><InfNfse>
  <Numero>2026000000001</Numero><CodigoVerificacao>MODELO</CodigoVerificacao><DataEmissao>2026-09-09T10:30:00-03:00</DataEmissao>
  <OutrasInformacoes>Modelo demonstrativo do layout próprio. Dados do tomador e identificadores são fictícios; não transmitir este exemplo.</OutrasInformacoes>
  <ValoresNfse><BaseCalculo>405.00</BaseCalculo><Aliquota>3.5100</Aliquota><ValorIss>14.22</ValorIss><ValorLiquidoNfse>390.78</ValorLiquidoNfse></ValoresNfse>
  <PrestadorServico><IdentificacaoPrestador><CpfCnpj><Cnpj>35898750000107</Cnpj></CpfCnpj><InscricaoMunicipal>5938914</InscricaoMunicipal></IdentificacaoPrestador>
    <RazaoSocial>BARRETO &amp; MACHADO ASSESSORIA E CONSULTORIA CONTABIL LTDA</RazaoSocial><NomeFantasia>B &amp; M ASSESSORIA E CONSULTORIA CONTABIL</NomeFantasia>
    <Endereco><Endereco>Rua Antonio Dultra</Endereco><Numero>1169</Numero><Bairro>CENTRO</Bairro><CodigoMunicipio>2802908</CodigoMunicipio><Uf>SE</Uf><Cep>49500151</Cep></Endereco>
    <Contato><Telefone>(79) 99928-4661</Telefone><Email>financeirobem@yahoo.com</Email></Contato>
  </PrestadorServico><OrgaoGerador><CodigoMunicipio>2802908</CodigoMunicipio><Uf>SE</Uf></OrgaoGerador>
  <DeclaracaoPrestacaoServico><InfDeclaracaoPrestacaoServico><Rps><IdentificacaoRps><Numero>99</Numero></IdentificacaoRps><DataEmissao>2026-09-08T08:00:00</DataEmissao></Rps>
    <Competencia>2026-09-01</Competencia><Servico><Valores><ValorServicos>405.00</ValorServicos><ValorDeducoes>0.00</ValorDeducoes>
      <ValorPis>0.00</ValorPis><ValorCofins>0.00</ValorCofins><ValorInss>0.00</ValorInss><ValorIr>0.00</ValorIr><ValorCsll>0.00</ValorCsll><OutrasRetencoes>0.00</OutrasRetencoes>
      <DescontoCondicionado>0.00</DescontoCondicionado><DescontoIncondicionado>0.00</DescontoIncondicionado>
    </Valores><IssRetido>1</IssRetido><ItemListaServico>17.03</ItemListaServico><CodigoCnae>6920601</CodigoCnae><CodigoTributacaoMunicipio>1703</CodigoTributacaoMunicipio>
    <Discriminacao>Serviços contábeis referentes à competência 09/2026.\nExemplo para avaliação do layout próprio da NFS-e.</Discriminacao><CodigoMunicipio>2802908</CodigoMunicipio><ExigibilidadeISS>1</ExigibilidadeISS><MunicipioIncidencia>2800308</MunicipioIncidencia>
    </Servico><TomadorServico><IdentificacaoTomador><CpfCnpj><Cnpj>00000000000000</Cnpj></CpfCnpj></IdentificacaoTomador><RazaoSocial>CLIENTE DEMONSTRATIVO - SEM VALOR FISCAL</RazaoSocial>
    <Endereco><Endereco>Rua de Demonstração</Endereco><Numero>100</Numero><Bairro>Centro</Bairro><CodigoMunicipio>2800308</CodigoMunicipio><Uf>SE</Uf><Cep>49000000</Cep></Endereco><Contato><Email>exemplo@example.invalid</Email></Contato></TomadorServico>
    <RegimeEspecialTributacao>6</RegimeEspecialTributacao><OptanteSimplesNacional>1</OptanteSimplesNacional><IncentivoFiscal>2</IncentivoFiscal>
  </InfDeclaracaoPrestacaoServico></DeclaracaoPrestacaoServico>
</InfNfse></Nfse></CompNfse>`;
