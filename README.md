# TS Module Commercial

Aplicação independente que expõe `CommercialPage.vue` por Module Federation.
Nesta primeira versão, o módulo contém a experiência de Clientes e usa mocks
locais persistidos no navegador apenas para demonstração.

```bash
npm install
npm run dev
```

A aplicação é executada em http://localhost:4175. O host carrega o arquivo
`remoteEntry.js` em http://localhost:4175/remoteEntry.js.
