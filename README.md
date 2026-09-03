# TS Module Commercial

Aplicação independente que expõe `CommercialPage.vue` por Module Federation.
Nesta primeira versão, o módulo contém a experiência de Clientes e usa mocks
locais persistidos no navegador apenas para demonstração.

## Cardápios

O módulo também permite planejar e publicar o cardápio de cada dia operacional
em `/cardapios`. Ofertas e produzíveis partem do Catálogo de Gestão e são
preservados como snapshots no cardápio. A persistência demonstrativa usa a chave
`ts-commercial-daily-menus-v1` do `localStorage`.

Estados previsíveis do calendário podem ser revisados com `?mock=sem-cardapios`
e `?mock=erro`.

```bash
npm install
npm run dev
```

A aplicação é executada em http://localhost:4175. O host carrega o arquivo
`remoteEntry.js` em http://localhost:4175/remoteEntry.js.
