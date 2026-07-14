# Controle interno de versão

Esta pasta é a fonte única da versão exibida pelo sistema.

Em toda alteração destinada a publicação:

1. adicione uma entrada no topo de `CHANGELOG.md` com versão, data e resumo objetivo;
2. atualize `CURRENT_RELEASE` em `release.ts` quando houver mudança de versão;
3. mantenha a versão no formato definido para o canal atual, por exemplo `Beta 1.005`;
4. registre alterações de banco, integrações e comportamento visível ao usuário.

Os componentes devem importar `CURRENT_RELEASE`; não copie o número da versão em outros arquivos.
