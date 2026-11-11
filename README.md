# Atlas para Foundry VTT

Módulo do Foundry VTT (v14 em diante) da família Atlas. Importa as **pessoas** de um mundo ou de uma campanha do Atlas como entradas de diário, só lendo os dados (nada volta para o Atlas).

## Instalar

1. Copie esta pasta para `Data/modules/atlas-foundry` do Foundry (ou compacte como `atlas-foundry.zip` com o `module.json` na raiz e instale pelo manifesto quando houver uma release).
2. Ative o módulo **Atlas** no mundo.
3. No Atlas, abra **Perfil → Integrações**, crie um token (por exemplo "Foundry da mesa") e copie.
4. No Foundry, em **Configurações → Configurar módulos → Atlas**, cole o token. O token é do navegador (escopo `client`); o endereço da API é do mundo e já vem preenchido.

## Usar

Na aba **Diário**, o mestre vê o botão **Importar do Atlas**:

1. Escolha o mundo e, se quiser, uma campanha dele (na campanha, "Ver como" escolhe um dos seus personagens; o padrão é o mestre).
2. **Carregar pessoas**, filtre e marque quem importar.
3. **Importar**: cada pessoa vira uma entrada de diário na pasta `Atlas · <nome>`, com uma página de retrato (quando há imagem) e uma de ficha (apelidos, situação, idade, altura, cargos, tags e a descrição em markdown; menções viram o nome em negrito).

Importar de novo a mesma pessoa atualiza a entrada (pelo flag `atlas-foundry.personId`): as páginas do Atlas são trocadas e as páginas que você criou à mão ficam.

Outros módulos e macros podem abrir a janela com `game.modules.get('atlas-foundry').api.openImporter()`.

## Desenvolvimento

- JavaScript puro em ES modules, sem build. `scripts/main.js` registra configurações e o botão; `importer-application.js` é a janela (ApplicationV2 + Handlebars); `atlas-client.js` fala com a API; `person-journal.js` monta as páginas; `journal-writer.js` cria ou atualiza as entradas.
- `npm test` roda os testes do cliente e da montagem das páginas (`node --test`, sem dependências).
- A API aceita o token pessoal (`atlas_pat_…`) só em `GET` e libera CORS sem credenciais para qualquer origem, então o Foundry pode estar em qualquer endereço.
