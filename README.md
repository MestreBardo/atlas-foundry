# Atlas para Foundry VTT

Módulo do Foundry VTT (v14 em diante) da família Atlas. Importa **pessoas, aventureiros, locais, facções e documentos** como entradas de diário. Também pode criar Actors e pacotes de compêndio privados para o mestre. O acesso ao Atlas continua somente de leitura.

## Instalar

1. Copie esta pasta para `Data/modules/atlas-foundry` do Foundry (ou compacte como `atlas-foundry.zip` com o `module.json` na raiz e instale pelo manifesto quando houver uma release).
2. Ative o módulo **Atlas** no mundo.
3. No Atlas, abra **Perfil → Integrações**, crie um token (por exemplo "Foundry da mesa") e copie.
4. No Foundry, em **Configurações → Configurar módulos → Atlas**, cole o token. O token fica neste navegador (escopo `client`); o endereço da API é interno e não é editável.
5. Ainda nas configurações do Atlas, abra **Configurar integração**, escolha o mundo e, se quiser, a campanha. Salve. A origem é compartilhada neste mundo do Foundry (escopo `world`). Sem campanha selecionada, o acesso é ao próprio mundo. Na campanha, **Ver como** permite usar um dos seus personagens; o padrão é o mestre.

Nas configurações do Atlas, **Idioma do Atlas** permite escolher **Português (Brasil)**, **English** ou **Seguir o idioma do Foundry** (padrão). A preferência fica salva neste navegador e atualiza as janelas do módulo, sem mudar o idioma do Foundry ou dos outros módulos. Nomes, histórias e documentos importados conservam seu texto original.

## Usar

Na aba **Diário**, o mestre vê o botão **Importar do Atlas**. A janela usa o mesmo pergaminho, as fontes e as cores da ficha Atlas.

1. A origem vem dos settings. **Abrir configurações** permite mudar o mundo e a campanha; **Atualizar lista** consulta novamente os registros.
2. Escolha **Pessoas**, **Aventureiros**, **Locais** ou **Facções**. Aventureiros aparecem apenas nas campanhas. Se houver uma visão de aventureiro selecionada nos settings, a lista de aventureiros fica limitada a ele.
3. Escolha o destino: **Diários deste mundo** ou **Criar ou atualizar pacotes Atlas**.
4. Se quiser uma ficha também, marque **Criar Actor também** e escolha um tipo de Actor oferecido pelo sistema da mesa.
5. Filtre, marque os registros e clique em **Importar**. Cada registro inclui imagem, perfil, descrição e documentos disponíveis. A janela mostra o progresso e o resultado de cada item.

Pessoas mantêm a ficha **Pessoa Atlas**. Locais e facções importam nome, imagem, descrição, tags, conexões visíveis e documentos. Aventureiros incluem perfil, história e documentos pessoais.

Reimportar atualiza a entrada e suas páginas sem duplicá-las. As páginas importadas mantêm os identificadores; documentos removidos do Atlas deixam de constar na entrada. Páginas locais são preservadas, sem ampliar suas permissões quando a entrada ganha novos leitores. Se a leitura de qualquer página da API falhar, a importação anterior daquele registro não é alterada.

## Documentos e compartilhamento

Os documentos são importados com título, subtítulo, texto, autoria quando disponível, parâmetros e tags. Markdown, menções e capitulares são convertidos para o Foundry.

Na ficha de um Actor vinculado, o botão **Documentos Atlas** no cabeçalho abre os documentos do aventureiro e os documentos de outros registros compartilhados com ele. Actors criados pela importação também recebem acesso ao seu registro de diário por esse botão. A lista funciona com os dados importados, sem consultar o Atlas e sem precisar do token do mestre.

- Um documento de aventureiro vinculado é legível pelos jogadores com permissão **Dono** na ficha correspondente. Compartilhamentos aceitos concedem leitura aos donos das fichas dos aventureiros destinatários. Ser apenas observador da ficha não concede acesso aos documentos privados dela.
- Convites pendentes não concedem acesso. Se o aventureiro autor não estiver vinculado, o documento fica somente para o mestre.
- Documentos escritos por aventureiros sobre pessoas e outros registros seguem seus autores, leitores aceitos e a visibilidade do registro. Documentos do mestre sobre pessoas exigem compartilhamento explícito; documentos do mestre sobre locais e facções acompanham a visibilidade desses registros no Atlas.
- Cada página tem suas próprias permissões. Receber uma carta não dá acesso à história privada do aventureiro autor. O conteúdo dos documentos não é copiado para os flags do Actor.
- Trocar o dono de uma ficha, remover um vínculo ou excluir um Actor recalcula os acessos dos diários importados, com um mestre ativo. Ao abrir a mesa, os acessos também são conferidos.
- Mudanças de compartilhamento feitas no Atlas são aplicadas ao **reimportar**. As permissões das páginas importadas são sincronizadas com esses dados; ajustes manuais nessas páginas podem ser substituídos. Reimporte registros de versões anteriores para aplicar esse modelo.

## Pacotes de compêndio

O destino **Criar ou atualizar pacotes Atlas** cria um pacote de **Diários** da origem e, quando solicitado, outro de **Actors**. A importação ocorre diretamente nos pacotes, sem criar cópias no mundo. Reimportar na mesma origem reutiliza os pacotes e seus registros.

Os pacotes ficam privados para o mestre, pois um compêndio compartilhado pode expor seu conteúdo independentemente das permissões de cada página. Pacotes que foram compartilhados com jogadores ou bloqueados não recebem novas importações até serem configurados novamente.

Para usar os registros com os jogadores, importe-os no mundo. Os metadados de compartilhamento acompanham as páginas e são recalculados pelo módulo quando o diário é criado no mundo. Uma ficha trazida do pacote procura seu diário correspondente no mundo antes de usar a referência do arquivo privado.

## Criação opcional de Actors

**Criar Actor também** cria uma ficha com nome, imagem e referência ao diário. O tipo é escolhido entre os disponíveis no sistema da mesa; atributos, equipamentos e regras usam os padrões desse sistema. O módulo não converte estatísticas do Atlas em regras de D&D, Pathfinder ou outros sistemas.

Se o aventureiro já tiver uma ficha de jogador vinculada, essa ficha é reaproveitada sem substituir nome, atributos, tipo ou permissões. Fichas criadas pela importação são atualizadas sem duplicação e preservam os atributos e as permissões definidos na mesa. Criar uma ficha não atribui jogadores automaticamente: aventureiros sem vínculo continuam com documentos privados para o mestre.

## Vincular fichas dos jogadores aos aventureiros da campanha

Em **Configurar integração**, selecione uma campanha. A seção **Fichas de jogadores → Aventureiros da campanha** mostra apenas Actors com dono jogador (`hasPlayerOwner` do Foundry). Para cada ficha, escolha um dos aventureiros da campanha selecionada no Atlas e salve. **Sem aventureiro vinculado** remove a associação. Cada ficha representa um aventureiro por campanha e cada aventureiro só pode estar vinculado a uma ficha.

Para disponibilizar uma ficha, conceda a um jogador o nível **Dono** nas permissões do Actor. Actors controlados apenas pelo mestre e entradas de diário não entram na lista. O destino do vínculo usa somente os aventureiros da campanha; as pessoas do Atlas continuam na importação de diários.

Os vínculos que autorizam documentos ficam numa configuração de mundo que somente o mestre pode salvar. Os flags dos Actors mantêm apenas uma cópia de identificação; editá-los não concede acesso. Ao atualizar de uma versão anterior, confira os vínculos apresentados e salve as configurações para autorizá-los. Trocar de campanha ou usar apenas o mundo preserva os vínculos anteriores. Ao salvar uma campanha, vínculos antigos dessa campanha em Actors sem dono jogador são removidos. As associações não criam Actors, não substituem suas fichas e não modificam permissões.

Outros módulos e macros podem usar a API local:

```js
const atlas = game.modules.get('atlas-foundry').api;
atlas.openImporter();
atlas.openSettings();
atlas.getScope(); // Mundo ou campanha configurada; null sem mundo.
atlas.openActorDocuments(game.actors.get('ACTOR_ID')); // Lista apenas documentos autorizados.
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
- O compartilhamento continua pelas permissões de entrada e página do Foundry. Leitores com acesso limitado veem apenas a identidade e o retrato permitido; a ficha completa exige acesso de observador. A ficha de diário não depende de um sistema de regras; a criação opcional de Actors usa os tipos disponíveis na mesa.

## Desenvolvimento

- `scripts/main.js` registra configurações, botões e sincronização de permissões. `settings-application.js` configura a origem e os vínculos; `importer-application.js` é a janela de importação.
- `atlas-client.js` consulta os registros e todas as páginas da API; `import-service.js` prepara cada importação; `entity-journal.js`, `entity-writer.js`, `actor-writer.js` e `import-target.js` cuidam dos diários, Actors e pacotes.
- `import-permissions.js` resolve os leitores por vínculo, `permission-sync.js` atualiza as permissões e `journal-lock.js` serializa alterações no mesmo diário. `actor-documents.js` verifica as permissões antes de listar ou abrir uma página.
- A ficha Pessoa Atlas continua em `person-sheet.js` e `person-sheet-data.js`. O tema compartilhado está em `styles/atlas-theme.css`, `styles/atlas.css` e `styles/importer.css`. A origem dos elementos está em `assets/README.md`.
- `npm test` roda os testes sem dependências. Incluem paginação, compartilhamentos aceitos e pendentes, revogação de acesso, páginas locais, pacotes privados, criação de Actors e importação por categoria.
- A API aceita o token pessoal (`atlas_pat_…`) somente em `GET`. O cabeçalho `X-Atlas-Client: foundry` identifica o cliente sem conceder permissões.
