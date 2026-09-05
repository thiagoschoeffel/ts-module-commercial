# TS Module Commercial

Aplicação independente que expõe `CommercialPage.vue` por Module Federation.
O módulo contém as experiências de Clientes, Cardápios, Planos e Créditos e Financeiro,
integradas à API autenticada e isoladas pela Organização da sessão.

A preferência de entregador do Cliente usa o identificador do cadastro mantido
em Gestão. Somente entregadores ativos podem ser escolhidos; uma preferência já
existente continua visível caso o entregador seja inativado.

## Cardápios

O módulo também permite planejar e publicar o cardápio de cada dia operacional
em `/cardapios`. Ofertas e produzíveis partem do Catálogo de Gestão e são
preservados como snapshots no cardápio. A persistência é autoritativa na API.

Na listagem de cardápios, a ação **Importar planilha** disponibiliza um modelo
`.xlsx` preenchido com o catálogo atual. As abas `Opções` e `Ofertas` aceitam
vários dias no mesmo arquivo. Antes da confirmação, o módulo valida datas,
categorias, itens produzíveis, ofertas, preços e disponibilidade. Os cardápios
válidos são criados como rascunho e dias já existentes nunca são substituídos.

Estados previsíveis do calendário podem ser revisados com `?mock=sem-cardapios`
e `?mock=erro`.

## Planos e Créditos

A rota `/planos` reúne cadastro de planos, aquisições de clientes e extrato de
créditos. Cada aquisição preserva um snapshot do benefício e das condições
contratadas. O consumo é vinculado ao pedido e distribuído por FIFO entre as
aquisições elegíveis; o estorno retorna à aquisição do consumo original.

Planos, aquisições e movimentações são carregados da API. Os saldos são derivados
do ledger e o crédito financeiro permanece separado do crédito de plano.

Estados previsíveis podem ser revisados com `?mock=sem-planos`,
`?mock=sem-resultados` e `?mock=erro`.

## Financeiro

A rota `/financeiro` separa cobranças, pagamentos e crédito financeiro. Um
pagamento pode ser alocado parcialmente em várias cobranças do mesmo cliente;
o valor recebido e não alocado gera automaticamente uma movimentação positiva
no extrato de crédito financeiro. Cliente, pedido, valores e responsável são
preservados como histórico na API. Pagamentos usam `Idempotency-Key`, alocações
são validadas na mesma transação e saldos nunca são editados diretamente.

```bash
npm install
npm run dev
```

A aplicação é executada em http://localhost:4175. O host carrega o arquivo
`remoteEntry.js` em http://localhost:4175/remoteEntry.js.
