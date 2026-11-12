# Tema Atlas

A ficha adapta o tema padrão Codex do `MestreBardo/atlas-ui`, consultado no commit `e32e052ae57d46d5923d3bd7247ba405dfda9a03`:

- `src/styles.css`: cores, fontes, textura de pergaminho, fundo de couro, botões e tags.
- `src/index.html`: famílias e pesos das fontes.
- `src/app/shared/components/book-modal/book-modal.component.html`: composição em duas páginas, nome e retrato na página esquerda, conteúdo à direita e sombra na dobra do livro.
- `src/app/shared/components/codex-frame/`: moldura dupla com cantos dourados.
- `src/app/features/persons/pages/person/person.page.html`: título, apelidos e informações de personagem.
- `public/images/logo.webp` → `images/logo.webp` (sem alterações).
- `public/textures/paper-noise.webp` → `textures/paper-noise.webp` (sem alterações).

`styles/atlas-theme.css` mantém as cores originais com prefixo `--atlas-`, dentro de `.atlas-person-sheet`. As fontes têm nomes CSS exclusivos para evitar conflitos com outros módulos.

## Fontes

Cinzel Decorative, Cormorant SC e EB Garamond foram obtidas do Google Fonts e incluídas localmente. Cada família é distribuída sob a SIL Open Font License 1.1; os arquivos `fonts/*-OFL.txt` preservam os avisos e as licenças. Os binários das fontes não foram modificados.
