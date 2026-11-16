# Atlas para Foundry VTT

Módulo do Foundry VTT (v14 em diante) da família Atlas. Importa as **pessoas** de um mundo ou de uma campanha do Atlas como entradas de diário, só lendo os dados (nada volta para o Atlas).

## Instalar

1. Copie esta pasta para `Data/modules/atlas-foundry` do Foundry (ou compacte como `atlas-foundry.zip` com o `module.json` na raiz e instale pelo manifesto quando houver uma release).
2. Ative o módulo **Atlas** no mundo.
3. No Atlas, abra **Perfil → Integrações**, crie um token (por exemplo "Foundry da mesa") e copie.
4. No Foundry, em **Configurações → Configurar módulos → Atlas**, cole o token. O token fica neste navegador (escopo `client`); o endereço da API é interno e não é editável.
5. Ainda nas configurações do Atlas, abra **Configurar integração**, escolha o mundo e, se quiser, a campanha. Salve. A origem é compartilhada neste mundo do Foundry (escopo `world`). Sem campanha selecionada, o acesso é ao próprio mundo. Na campanha, **Ver como** permite usar um dos seus personagens; o padrão é o mestre.

Nas configurações do Atlas, **Idioma do Atlas** permite escolher **Português (Brasil)**, **English** ou **Seguir o idioma do Foundry** (padrão). A preferência fica salva neste navegador e atualiza as janelas do módulo, sem mudar o idioma do Foundry ou dos outros módulos. Nomes, histórias e documentos importados conservam seu texto original.

## Usar

Na aba **Diário**, o mestre vê o botão **Importar do Atlas**:

1. A janela carrega as pessoas da origem salva nas configurações. Use **Abrir configurações** para mudar a origem e **Carregar pessoas** para atualizar a lista.
2. Filtre, marque quem importar e clique em **Importar**: cada pessoa vira uma entrada de diário na pasta `Atlas · <nome>`, com uma página de retrato (quando há imagem), uma de ficha (apelidos, situação, idade, altura, cargos, tags e descrição) e uma página para cada documento acessível no Atlas. Markdown e menções são convertidos para o Foundry.

Importar de novo a mesma pessoa atualiza a entrada (pelo flag `atlas-foundry.personId`): as páginas do Atlas são atualizadas mantendo seus identificadores e permissões; documentos que deixaram de vir do Atlas são removidos, e as páginas que você criou à mão ficam.

## Documentos das pessoas

A importação inclui automaticamente os documentos de cada pessoa, com título, subtítulo, texto, autoria, parâmetros e tags. Na ficha, a aba **Documentos** lista essas páginas e abre cada uma no diário padrão do Foundry. A aba **Páginas locais** continua reservada ao que foi criado na mesa.

- Para trazer documentos de uma pessoa já importada, selecione-a e importe novamente.
- O módulo consulta todas as páginas da API, usando o mesmo mundo/campanha e a mesma escolha de **Ver como** da pessoa. Importa apenas os documentos que essa visão pode consultar.
- Documentos novos começam privados para o mestre. Como personagens do Atlas e usuários do Foundry têm identificadores diferentes, o compartilhamento é definido nas permissões de cada página pelo próprio Foundry. Reimportar preserva essas permissões e os UUIDs das páginas.
- Se a leitura dos documentos falhar, aquela pessoa é contada como erro e sua entrada anterior não é modificada.

## Vincular fichas dos jogadores aos aventureiros da campanha

Em **Configurar integração**, selecione uma campanha. A seção **Fichas de jogadores → Aventureiros da campanha** mostra apenas Actors com dono jogador (`hasPlayerOwner` do Foundry). Para cada ficha, escolha um dos aventureiros da campanha selecionada no Atlas e salve. **Sem aventureiro vinculado** remove a associação. Cada ficha representa um aventureiro por campanha e cada aventureiro só pode estar vinculado a uma ficha.

Para disponibilizar uma ficha, conceda a um jogador o nível **Dono** nas permissões do Actor. Actors controlados apenas pelo mestre e entradas de diário não entram na lista. O destino do vínculo usa somente os aventureiros da campanha; as pessoas do Atlas continuam na importação de diários.

Os vínculos ficam nos flags `atlas-foundry.adventurerLinks` dos Actors, com `worldId`, `campaignId`, `adventurerId` e `name`. Trocar de campanha ou usar apenas o mundo preserva os vínculos anteriores. Ao salvar uma campanha, vínculos antigos dessa campanha em Actors sem dono jogador são removidos. As associações não criam Actors, não substituem suas fichas e não modificam permissões.

Outros módulos e macros podem usar a API local:

```js
const atlas = game.modules.get('atlas-foundry').api;
atlas.openImporter();
atlas.openSettings();
atlas.getScope(); // Mundo ou campanha configurada; null sem mundo.
atlas.getActorLink(game.actors.get('ACTOR_ID')); // Vínculo de ficha com dono jogador; null sem campanha.
atlas.getActorLink(game.actors.get('ACTOR_ID'), 'CAMPAIGN_ID'); // Outra campanha.
```

## Identificação das chamadas

Toda requisição à API, inclusive as páginas seguintes de uma listagem, envia `X-Atlas-Client: foundry`. A API reconhece a integração por esse cabeçalho e precisa permiti-lo no CORS antes de usar esta versão do módulo. É uma identificação declarada pelo cliente; a autenticação continua pelo token pessoal, com acesso somente de leitura e as permissões existentes.

## Ficha de pessoa Atlas

As pessoas importadas abrem na ficha **Pessoa Atlas**, com retrato, apelidos, situação, idade, altura, cargos, tags e história. A organização segue as fichas do Foundry: cabeçalho compacto com retrato e informações rápidas, abas nativas de **Ficha**, **História**, **Documentos** e **Páginas locais**, e conteúdo com rolagem própria. As abas também aceitam navegação por teclado (setas, Home e End). A ficha usa os dados já importados, sem precisar consultar a API ou ter o token do mestre para abrir.

Situação, idade e altura aparecem apenas no cabeçalho. A aba **Ficha** mostra cargos e tags, sem repetir essas informações.

A identidade visual usa o tema padrão **Codex** do Atlas: pergaminho sutil, tons de tinta e couro, vermelho e dourado. A textura de papel vem do Atlas UI. As fontes originais (Cinzel Decorative, Cormorant SC e EB Garamond) estão incluídas no módulo com suas licenças, sem carregar Google Fonts durante o uso. As cores e fontes ficam isoladas na ficha, sem alterar o tema das outras janelas do Foundry. Esta versão usa a aparência padrão; não sincroniza os estilos ou paletas personalizados de cada mundo.

Parágrafos iniciados por `{capitular} ` exibem a primeira letra ampliada, como no Atlas. O marcador não aparece na ficha, inclusive em entradas já importadas. Nas novas importações, a formatação também é salva na página para funcionar no diário padrão do Foundry.

- Para entradas importadas antes desta versão, importe a pessoa novamente ou escolha **Pessoa Atlas** em **Configurar ficha** no menu da entrada.
- **Abrir diário** abre a interface padrão do Foundry para editar e criar páginas. As páginas locais também aparecem como atalhos na aba **Páginas locais** e continuam preservadas nas reimportações.
- A reimportação atualiza os dados vindos do Atlas. Uma ficha alternativa escolhida manualmente é preservada.
- O compartilhamento continua pelas permissões de entrada e página do Foundry. Leitores com acesso limitado veem apenas a identidade e o retrato permitido; a ficha completa exige acesso de observador. O módulo não cria Actors nem depende de um sistema de regras.

## Desenvolvimento

- JavaScript puro em ES modules, sem build. `scripts/main.js` registra configurações e o botão; `settings-application.js` configura a origem e os vínculos; `actor-links.js` valida e prepara as associações; `importer-application.js` é a janela de importação (ApplicationV2 + Handlebars); `atlas-client.js` fala com a API; `person-journal.js` monta as páginas; `journal-writer.js` cria ou atualiza as entradas.
- `person-sheet.js` registra uma DocumentSheetV2 para JournalEntry; `person-sheet-data.js` monta a ficha apenas com as páginas autorizadas; `templates/person-sheet.hbs`, `styles/atlas-theme.css` e `styles/atlas.css` definem seu visual. A origem dos elementos do tema está em `assets/README.md`.
- `npm test` roda os testes do cliente e da montagem das páginas (`node --test`, sem dependências).
- A API aceita o token pessoal (`atlas_pat_…`) só em `GET` e libera CORS sem credenciais para qualquer origem, então o Foundry pode estar em qualquer endereço.
