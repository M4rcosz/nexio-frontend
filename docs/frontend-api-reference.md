# API — Nexio

Referência de todos os endpoints HTTP do backend, pensada para orientar o desenvolvimento do front-end.

> Fonte: controllers e DTOs em `src/modules/**/infrastructure/http/`. Se divergir do código, o código vence — atualize este arquivo.

---

## Convenções gerais

### Base URL

Todas as rotas têm o prefixo global `/api`.

```
http://localhost:3000/api
```

Em ambiente não-produção há Swagger UI em `GET /api/docs`.

### Autenticação

- Autenticação por **JWT Bearer**. Envie `Authorization: Bearer <access_token>` em toda rota que não seja marcada como pública.
- O guard é **deny-by-default**: qualquer rota sem `@Public()` exige token válido.
- Token obtido em `POST /api/auth/login` (e renovado em `POST /api/auth/refresh`).

Payload do access token (informativo — o front não precisa decodificar, mas ajuda a entender o escopo):

```jsonc
{
  "sub": "<userId>",
  "username": "maria.souza",
  "role": "CUSTOMER",           // ADMIN | MANAGER | ATTENDANT | KITCHEN | CUSTOMER
  "businessUnitIds": ["<uuid>"],// unidades às quais o staff está vinculado ([] = sem vínculo)
  "iat": 0,
  "exp": 0
}
```

### Papéis (roles)

`ADMIN`, `MANAGER`, `ATTENDANT`, `KITCHEN`, `CUSTOMER`.

- `ADMIN` costuma ignorar o escopo de unidade (acesso total).
- `MANAGER`/`ATTENDANT`/`KITCHEN` são **staff**, restritos às unidades do claim `businessUnitIds`.
- `CUSTOMER` é o cliente final (sem vínculo de unidade).

### Escopo por unidade (`businessUnitId`)

Rotas de gestão por unidade validam o `:businessUnitId` da rota (ou do corpo) contra o claim do token.
Para staff **não-admin** cuja unidade não bate com o parâmetro, a resposta é **404** (a existência do recurso não é revelada). `ADMIN` faz bypass.

### Formato de erro

Todos os erros seguem este envelope:

```json
{
  "statusCode": 404,
  "message": "Order not found",
  "error": "Not Found",
  "timestamp": "2026-07-01T10:30:00.000Z",
  "path": "/api/orders/550e8400-e29b-41d4-a716-446655440000"
}
```

Erros de validação de DTO (`class-validator`) chegam com `statusCode: 400` e `message` podendo ser string única ou concatenação das falhas.

### Validação de entrada

- A `ValidationPipe` global usa **whitelist + forbidNonWhitelisted**: campos desconhecidos no corpo → **400**.
- **Conversão implícita está desligada.** Em query strings, números/booleans/datas já são convertidos pelos DTOs (`@Type`), mas envie exatamente o esperado.
- **Dinheiro é sempre string decimal** (ex.: `"12.50"`), nunca número. Nunca faça aritmética de moeda no cliente com `float`; trate como string / centavos.

### Paginação (cursor-based)

Listas retornam este envelope:

```json
{
  "data": [ /* ...itens... */ ],
  "meta": {
    "limit": 20,
    "nextCursor": "550e8400-e29b-41d4-a716-446655440000",
    "hasMore": true
  }
}
```

Query params comuns em rotas de lista:

| Param    | Tipo   | Default | Notas                                                        |
| -------- | ------ | ------- | ------------------------------------------------------------ |
| `limit`  | number | `20`    | Clampado em `[1, 100]`.                                       |
| `cursor` | string | —       | `id` do último item da página anterior; resultados vêm após. |

Para a próxima página, mande `cursor = meta.nextCursor`. Fim quando `hasMore === false` / `nextCursor === null`.

---

## Índice

- [Auth](#auth) — `/api/auth`
- [Users](#users) — `/api/users`
- [Business Units](#business-units) — `/api/business-units`
- [Products](#products) — `/api/products`
- [Menu](#menu) — `/api/business-units/:businessUnitId/menu`
- [Inventory](#inventory) — `/api/inventory`
- [Orders](#orders) — `/api/orders`
- [Payments](#payments) — `/api/payments`
- [Loyalty](#loyalty) — `/api/loyalty`
- [Promotions](#promotions) — `/api/promotions`
- [Audit Logs](#audit-logs) — `/api/audit-logs`

---

## Auth

`/api/auth` — todas públicas. Rate limit estrito: 5 req/min por rota.

### POST /api/auth/login

Público. Retorna par de tokens.

Request:

```json
{
  "username": "maria.souza",
  "password": "senha123"
}
```

Login é **leniente** (contas legadas devem autenticar): `username` é aparado e aceita até 256 caracteres, sem validação de padrão/reservados; `password` valida apenas comprimento (8–128), **sem** exigência de complexidade. As regras estritas de username/senha valem só nos caminhos de criação (register/admin-create/troca de senha).

Response `200`:

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<opaque>"
}
```

Erros: `401` credenciais inválidas / usuário inativo.

### POST /api/auth/refresh

Público. Troca um refresh token (rotacionado) por um novo par.

Request:

```json
{ "refresh_token": "<opaque>" }
```

Response `200`: mesmo shape do login. Erros: `401` token inválido/expirado/reutilizado.

### POST /api/auth/logout

Público. Revoga o refresh token informado.

Request:

```json
{ "refresh_token": "<opaque>" }
```

Response `204` (sem corpo).

---

## Users

`/api/users`

### POST /api/users/register

**Público.** Auto-cadastro de cliente. Papel forçado para `CUSTOMER` (não aceita `role`). Rate limit 5/min.

Request:

```jsonc
{
  "name": "Maria Souza",          // obrigatório, ≤120
  "username": "maria.souza",      // obrigatório, 3–50, /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/, não reservado
  "password": "Senha@1234",       // obrigatório, 10–128, ≥3 de 4 classes (min/mai/dígito/símbolo)
  "email": "maria@example.com",   // obrigatório, e-mail válido, ≤254
  "phone": "+5581999999999"       // opcional, ≤20
}
```

Response `201`: [UserResponse](#userresponse). Erros: `409` username/email/phone já em uso.

### POST /api/users

**ADMIN, MANAGER.** Cria usuário staff/admin. A política decide quais papéis cada um pode criar.

Request:

```jsonc
{
  "name": "João Atendente",         // obrigatório, ≤120
  "username": "joao.atendente",     // 3–50, /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/, não reservado
  "password": "Joao@Atend2024",     // 10–128, ≥3 de 4 classes (min/mai/dígito/símbolo)
  "role": "ATTENDANT",              // ADMIN|MANAGER|ATTENDANT|KITCHEN|CUSTOMER
  "email": "joao@example.com",      // obrigatório, ≤254
  "phone": "+5581988888888",        // opcional, ≤20
  "businessUnitIds": ["<uuid>"]     // opcional; uuids únicos; omitir/[] = usuário sem vínculo
}
```

Response `201`: [UserResponse](#userresponse). Erros: `403` papel não permitido; `409` conflito de unicidade.

### GET /api/users

**ADMIN, MANAGER** (MANAGER limitado às próprias unidades). Lista paginada.

Query: `limit`, `cursor`, e filtros opcionais `businessUnitId` (uuid), `username` (substring, ≤50), `email` (substring, ≤120).

Response `200`: paginado de [UserResponse](#userresponse). Erros: `404` MANAGER pediu unidade fora do escopo.

### GET /api/users/me

**Autenticado** (qualquer role). Perfil do usuário chamador. Serve para tela de perfil / header.

Response `200`: [UserResponse](#userresponse). Erros: `401` token ausente/expirado; `404` a conta não existe mais no backend (removida) — o front deve tratar como sessão inválida e forçar logout **apenas** com sinal explícito de conta removida no corpo (`code`/`error`); um `404` genérico não desloga.

### PATCH /api/users/me

**CUSTOMER.** Atualiza nome e/ou telefone do próprio usuário. Pelo menos um dos campos é obrigatório. Rate limit 10/min.

Request (ao menos um):

```json
{ "name": "Maria S.", "phone": "+5581999999999" }
```

Response `200`: [UserResponse](#userresponse). Erros: `409` phone já em uso; `404` usuário não encontrado.

### PATCH /api/users/me/password

**Autenticado.** Troca a própria senha. Rate limit 5/min. Revoga todas as sessões.

Request:

```jsonc
{
  "currentPassword": "OldPass!2024",      // ≤128
  "newPassword": "N3w-Str0ng-Pass!"       // 10–128, ≥3 classes de caractere (min/mai/dígito/símbolo)
}
```

Response `204`. Erros: `401` senha atual incorreta; `422` nova igual à atual; `404` usuário não encontrado.

### PATCH /api/users/:id/deactivate

**ADMIN, MANAGER.** Define `isActive=false`.

Response `200`: [UserResponse](#userresponse). Erros: `403` (papel/próprio usuário); `404`.

### PATCH /api/users/:id/reactivate

**ADMIN, MANAGER.** Define `isActive=true`.

Response `200`: [UserResponse](#userresponse). Erros: `403`; `404`; `409` estado mudou durante a operação (retentar).

### PUT /api/users/:id/business-units

**ADMIN.** Substitui o conjunto de unidades do staff (replace total; conjunto não pode ser vazio — para zerar, desative o usuário).

Request:

```json
{ "businessUnitIds": ["<uuid>", "<uuid>"] }
```

Response `200`: [UserResponse](#userresponse). Erros: `403` (não-admin/alvo sem vínculo); `404`; `422` alguma unidade não existe.

### UserResponse

```jsonc
{
  "id": "<uuid>",
  "username": "maria.souza",
  "name": "Maria Souza",
  "email": "maria@example.com",   // ou null
  "phone": "+5581999999999",      // ou null
  "role": "CUSTOMER",
  "businessUnitIds": ["<uuid>"],  // [] se sem vínculo
  "isActive": true
}
```

---

## Business Units

`/api/business-units`

> Ordem de rota importa: `internal` é resolvido antes de `:id`.

### GET /api/business-units

**Público.** Lista unidades **ativas** (paginado). View pública (sem cnpj/isActive/timestamps).

Query: `limit`, `cursor`, `search` (string), `city` (string). (`isActive` é ignorado aqui — sempre só ativas.)

Response `200`: paginado de [PublicBusinessUnit](#publicbusinessunit).

### GET /api/business-units/:id

**Público.** Uma unidade ativa por ID. Response `200`: [PublicBusinessUnit](#publicbusinessunit). Erro `404`.

### GET /api/business-units/internal

**ADMIN, MANAGER.** Lista com detalhe completo (paginado).

Query: `limit`, `cursor`, `search`, `city`, `isActive` (`true`/`false`).

Response `200`: paginado de [BusinessUnit](#businessunit).

### GET /api/business-units/internal/:id

**ADMIN, MANAGER.** Uma unidade por ID, detalhe completo (inclui inativas). Response `200`: [BusinessUnit](#businessunit). Erro `404`.

### POST /api/business-units

**ADMIN.** Cria unidade.

Request:

```jsonc
{
  "name": "Nexio Pelourinho",          // ≤120
  "cnpj": "12345678000190",             // 14 dígitos, sem máscara
  "address": "Largo do Pelourinho, 10", // ≤255
  "city": "Salvador",                   // ≤120
  "phone": "7132223344"                 // ≤20
}
```

Response `201`: [BusinessUnit](#businessunit). Erro `409` cnpj ou phone duplicado.

### PATCH /api/business-units/:id/activate

**ADMIN.** `isActive=true`. Response `200`: [BusinessUnit](#businessunit). Erro `404`.

### PATCH /api/business-units/:id/deactivate

**ADMIN.** `isActive=false`. Response `200`: [BusinessUnit](#businessunit). Erro `404`.

### PublicBusinessUnit

```json
{
  "id": "<uuid>",
  "name": "Nexio Pelourinho",
  "address": "Largo do Pelourinho, 10",
  "city": "Salvador",
  "phone": "7132223344"
}
```

### BusinessUnit

```jsonc
{
  "id": "<uuid>",
  "name": "Nexio Pelourinho",
  "cnpj": "12345678000190",
  "address": "Largo do Pelourinho, 10",
  "city": "Salvador",
  "phone": "7132223344",
  "isActive": true,
  "createdAt": "2026-05-18T10:30:00.000Z",
  "updatedAt": "2026-05-18T10:30:00.000Z"
}
```

---

## Products

`/api/products` — catálogo global de produtos (o preço por unidade vem no Menu).

### GET /api/products

**Público.** Lista produtos **ativos** (paginado).

Query: `limit`, `cursor`, `categoryId` (uuid), `search` (string).

Response `200`: paginado de [Product](#product).

### GET /api/products/by-business-unit/:businessUnitId

**Público.** Produtos ativos de uma unidade (paginado). Mesmos query params acima. Response `200`: paginado de [Product](#product).

### GET /api/products/:productId

**Público.** Um produto por ID. Response `200`: [Product](#product). Erro `404`.

### POST /api/products

**ADMIN.** Cria produto.

Request:

```jsonc
{
  "name": "Acarajé",                                 // ≤100
  "description": "Bolinho de feijão-fradinho...",    // opcional, ≤255
  "price": "12.50",                                  // decimal positivo, ≤2 casas
  "categoryId": "<uuid>",
  "imageUrl": "https://example.com/acaraje.jpg"      // URL válida, ≤2000
}
```

Response `201`: [Product](#product). Erros: `409` nome duplicado; `404` categoria inexistente.

### PATCH /api/products/:productId

**ADMIN** (MANAGER não pode criar nem editar produtos do catálogo → `403`). Atualização parcial do catálogo: todos os campos são opcionais, mas **ao menos um** deve ser enviado. `isActive`, `id` e timestamps não são editáveis aqui (use `activate`/`deactivate`); campo desconhecido → `400`.

Request (ao menos um):

```jsonc
{
  "name": "Acarajé especial",                        // ≤100, único
  "description": "…",                                 // ≤255, não pode ser limpo com null
  "price": "13.50",                                   // decimal positivo, ≤2 casas
  "categoryId": "<uuid>",
  "imageUrl": "https://example.com/acaraje-2.jpg"     // URL http(s) válida, ≤2000
}
```

Response `200`: [Product](#product). Erros: `400` validação (body vazio, campo desconhecido, valor inválido); `403` role ≠ ADMIN; `404` produto ou `categoryId` inexistente; `409` nome duplicado.

### PATCH /api/products/:productId/activate

**ADMIN.** `isActive=true`. Response `200`: [Product](#product). Erro `404`.

### PATCH /api/products/:productId/deactivate

**ADMIN.** `isActive=false`. Response `200`: [Product](#product). Erro `404`.

### Product

```jsonc
{
  "id": "<uuid>",
  "name": "Acarajé",
  "description": "…",              // ou null
  "price": "18.50",                // string decimal (BRL)
  "isActive": true,
  "categoryId": "<uuid>",
  "createdAt": "2026-05-18T10:30:00.000Z",
  "updatedAt": "2026-05-18T10:30:00.000Z",
  "imageUrl": "https://example.com/acaraje.jpg"
}
```

---

## Menu

`/api/business-units/:businessUnitId/menu` — itens de cardápio por unidade (produto + preço efetivo na unidade).

### GET /api/business-units/:businessUnitId/menu

**Público.** Cardápio **disponível** da unidade (paginado). View pública.

Query: `limit`, `cursor`.

Response `200`: paginado de [PublicMenuItem](#publicmenuitem).

### GET /api/business-units/:businessUnitId/menu/manage

**ADMIN, MANAGER** (unit-scoped). Cardápio completo para gestão, incluindo itens indisponíveis.

Query: `limit`, `cursor`.

Response `200`: paginado de [MenuItem](#menuitem).

### GET /api/business-units/:businessUnitId/menu/:menuItemId

**Público.** Um item disponível. Response `200`: [PublicMenuItem](#publicmenuitem). Erro `404` (inexistente ou indisponível).

### POST /api/business-units/:businessUnitId/menu

**ADMIN, MANAGER** (unit-scoped). Adiciona produto ao cardápio da unidade.

Request:

```jsonc
{
  "productId": "<uuid>",
  "customPrice": "18.50",   // decimal positivo, ≤2 casas (obrigatório)
  "isAvailable": true       // opcional, default true
}
```

Response `201`: [MenuItem](#menuitem). Erros: `409` produto já no cardápio; `404` unidade/produto inexistente.

### PATCH /api/business-units/:businessUnitId/menu/:menuItemId

**ADMIN, MANAGER** (unit-scoped). Atualiza preço e/ou disponibilidade (ao menos um campo).

Request (ao menos um):

```json
{ "customPrice": "19.90", "isAvailable": false }
```

Response `200`: [MenuItem](#menuitem). Erro `404`.

### PATCH /api/business-units/:businessUnitId/menu/:menuItemId/deactivate

**ADMIN, MANAGER** (unit-scoped). `isAvailable=false`. Response `200`: [MenuItem](#menuitem). Erro `404`.

### PATCH /api/business-units/:businessUnitId/menu/:menuItemId/activate

**ADMIN, MANAGER** (unit-scoped). `isAvailable=true`. Response `200`: [MenuItem](#menuitem). Erro `404`.

### PublicMenuItem

```jsonc
{
  "menuItemId": "<uuid>",
  "productId": "<uuid>",
  "name": "Moqueca de peixe",
  "description": "…",                 // ou null
  "imageUrl": "https://…",
  "price": "18.50"                    // preço efetivo na unidade (string decimal)
}
```

### MenuItem

```jsonc
{
  "id": "<uuid>",
  "businessUnitId": "<uuid>",
  "productId": "<uuid>",
  "customPrice": "18.50",
  "isAvailable": true,
  "createdAt": "2026-05-18T10:30:00.000Z",
  "updatedAt": "2026-05-18T10:30:00.000Z"
}
```

---

## Inventory

`/api/inventory` — estoque por unidade. Todas as rotas são **unit-scoped**; `:businessUnitId` é validado contra o claim. Fluxo: inicialize a linha de estoque uma vez (`/items`), depois ajuste sempre (`/adjust`).

### GET /api/inventory/:businessUnitId

**MANAGER, ADMIN.** Saldos de estoque da unidade (paginado).

Query: `limit`, `cursor`.

Response `200`: paginado de [Inventory](#inventory-item).

### POST /api/inventory/:businessUnitId/items

**MANAGER, ADMIN.** Cria a primeira linha de estoque de um produto na unidade (saldo de abertura). `businessUnitId` vem só da URL.

Request:

```jsonc
{
  "productId": "<uuid>",
  "quantity": 0,                      // inteiro ≥0, ≤2147483647 (abertura, pode ser 0)
  "minQuantity": 5,                   // inteiro ≥0, ≤2147483647 (limiar de alerta)
  "reason": "Opening stock count"     // obrigatório, ≤150
}
```

Response `201`: [Inventory](#inventory-item). Erros: `404` produto/unidade inexistente (ou manager fora do escopo); `409` já existe linha de estoque para este produto na unidade (use `/adjust`).

### POST /api/inventory/:businessUnitId/adjust

**MANAGER, ADMIN.** Movimento manual IN/OUT em uma linha existente.

Request:

```jsonc
{
  "productId": "<uuid>",
  "type": "IN",                       // IN (repõe) | OUT (remove)
  "quantity": 10,                     // inteiro ≥1, ≤2147483647
  "reason": "Weekly restock delivery" // ≤150
}
```

Response `201`: [Inventory](#inventory-item). Erros: `404` produto sem linha de estoque na unidade (use `/items`); `422` OUT deixaria saldo negativo **ou** IN excederia o máximo (2147483647) — a rota infere qual pelo `type` enviado.

### Inventory (item)

```jsonc
{
  "id": "<uuid>",
  "businessUnitId": "<uuid>",
  "productId": "<uuid>",
  "quantity": 42,
  "minQuantity": 5,                 // limiar para alerta de reposição
  "updatedAt": "2026-05-18T10:30:00.000Z"
}
```

---

## Orders

`/api/orders`

### POST /api/orders

**Autenticado.** Cria pedido para o canal informado.

Header opcional de idempotência:

- `Idempotency-Key: <string ≤255>` — reenvio com a mesma chave e mesmo corpo retorna o mesmo pedido; mesma chave com corpo diferente é rejeitada. Chave ausente/vazia/grande demais desliga a idempotência.

Regras de canal (`orderChannel`) — ver também `customerName` abaixo:

- `APP`, `WEB`: cliente = usuário autenticado (do JWT); `customerId`/`customerName` no corpo são rejeitados.
- `TOTEM`: sem atendente, sem `customerId`; `customerName` é **obrigatório** (breaking change: TOTEM não aceita mais pedido anônimo).
- `COUNTER`, `PICKUP`: exigem atendente (ADMIN/MANAGER/ATTENDANT); o atendente informa **um dos dois**, nunca os dois — `customerId` (cliente cadastrado) ou `customerName` (cliente avulso).
- Em qualquer canal, enviar `customerId` e `customerName` juntos → `422`.

`customerName`: até 60 caracteres; o backend remove caracteres de formatação Unicode (zero-width space, BOM) e espaços nas pontas, exigindo ao menos uma letra/dígito — nomes só com espaços/símbolos contam como ausentes.

Request:

```jsonc
{
  "businessUnitId": "<uuid>",
  "customerId": "<uuid>",     // opcional; só usado em COUNTER/PICKUP
  "customerName": "Maria",    // opcional; ver regras de canal acima (obrigatório em TOTEM; nunca junto com customerId)
  "pointsRedeemed": 0,        // opcional, inteiro ≥0 (resgate de pontos de fidelidade)
  "notes": "sem cebola",      // opcional, ≤150
  "orderChannel": "APP",      // APP|WEB|TOTEM|COUNTER|PICKUP
  "orderItems": [             // não vazio
    {
      "productId": "<uuid>",
      "quantity": 2,          // inteiro ≥1
      "unitPrice": "12.50",   // decimal string, ≤2 casas
      "notes": "bem passado"  // opcional, ≤150
    }
  ]
}
```

Response `201`: [Order](#order). O `totalAmount` é calculado no servidor (aplica promoção e resgate de pontos).

### GET /api/orders/me

**CUSTOMER.** Lista os próprios pedidos (paginado por cursor), ordenados por `createdAt` desc no servidor. Escopo sempre pelo `customerId` do token — não aceita `customerId` por query.

Query: `limit` (1..100, default 20), `cursor`, `orderChannel` (enum), `orderStatus` (enum).

Response `200`: paginado de [Order](#order). Erros: `401` token ausente/expirado; `403` chamador não é CUSTOMER (staff usa `GET /api/orders`).

### GET /api/orders

**Staff** (ADMIN, MANAGER, ATTENDANT, KITCHEN). Lista paginada com filtros.

Query: `limit`, `cursor`, `businessUnitId` (uuid), `orderChannel` (enum), `orderStatus` (enum), `attendantId` (uuid), `customerId` (uuid), `createdAtFrom`/`createdAtTo` (date-time), `minTotal`/`maxTotal` (decimal string), `sortBy` (`createdAt`|`totalAmount`, default `createdAt`), `sortDir` (`asc`|`desc`, default `desc`). Staff vê apenas unidades do seu escopo.

O cursor é opaco e atrelado ao `sortBy`/`sortDir` vigente na página anterior — trocar a ordenação sem descartar o cursor retorna `422`.

Response `200`: paginado de [Order](#order).

### GET /api/orders/:id

**Autenticado.** Um pedido por ID. Cliente só enxerga os próprios pedidos.

Response `200`: [Order](#order). Erro `404` (inexistente ou não visível ao solicitante).

### PATCH /api/orders/:id/status

**Staff.** Muda o status (máquina de estados; transições inválidas → `422`).

Transições válidas:

```
PENDING   → CONFIRMED | CANCELLED
CONFIRMED → PREPARING | CANCELLED
PREPARING → READY | CANCELLED
READY     → DELIVERED
DELIVERED → (terminal)
CANCELLED → (terminal)
```

Request:

```json
{ "orderStatus": "CONFIRMED" }
```

Response `200`: [Order](#order). Erros: `404`; `422` transição não permitida.

### POST /api/orders/:id/cancel

**Autenticado.** Cancela e roda compensações (restock, refund, reversão de pontos).
Staff da unidade pode cancelar enquanto `PENDING`/`CONFIRMED`; cliente só o próprio pedido enquanto `PENDING`.

Response `200`: [Order](#order). Erros: `404`; `422` fora da janela de cancelamento.

### Order

```jsonc
{
  "id": "<uuid>",
  "businessUnitId": "<uuid>",
  "customerId": "<uuid>",       // ou null
  "customerName": "Maria",      // ou null; nome para chamar o pedido — se houver customerId, é o nome atual do cliente (resolvido ao vivo); senão, o nome avulso digitado
  "attendantId": "<uuid>",      // ou null
  "pointsRedeemed": 0,
  "pointsEarned": 0,
  "totalAmount": "25.00",       // string decimal (autoritativo, do servidor)
  "notes": "…",                 // ou null
  "orderChannel": "APP",
  "orderStatus": "PENDING",
  "createdAt": "2026-05-18T10:30:00.000Z",
  "updatedAt": "2026-05-18T10:30:00.000Z",
  "updatedById": "<uuid>",      // ou null
  "orderItems": [
    {
      "id": "<uuid>",
      "productId": "<uuid>",
      "quantity": 2,
      "unitPrice": "12.50",     // string decimal
      "subtotal": "25.00",      // string decimal
      "notes": "…"              // ou null
    }
  ]
}
```

---

## Payments

### POST /api/payments

**Autenticado.** Cria pagamento para um pedido e aciona o gateway.

Request:

```jsonc
{
  "orderId": "<uuid>",
  "method": "PIX"     // CREDIT_CARD|DEBIT_CARD|PIX|CASH|VOUCHER
}
```

Response `201`: [Payment](#payment). Erros: `404` pedido inexistente; `422` pedido não aguardando pagamento ou já pago.

### POST /api/payments/webhook

**Público** (autenticado por assinatura HMAC do gateway, não por JWT). O front normalmente **não** chama isto — é callback do gateway. Sempre responde `200`.

Header: assinatura HMAC (verificada pelo `PaymentWebhookGuard`).

Request:

```jsonc
{
  "extTransactionId": "<id do gateway>",
  "status": "APPROVED",   // APPROVED | REFUSED
  "amount": "25.00"       // deve bater com o valor cobrado
}
```

Response `200`:

```json
{ "received": true }
```

Erro: `401` assinatura ausente/inválida.

### GET /api/orders/:orderId/payment

**Autenticado.** Pagamento de um pedido. Cliente só vê o próprio.

Response `200`: [Payment](#payment). Erro `404` (sem pagamento ou não visível).

### Payment

```jsonc
{
  "id": "<uuid>",
  "orderId": "<uuid>",
  "amount": "25.00",              // string decimal
  "method": "PIX",
  "status": "PENDING",            // PENDING|PROCESSING|APPROVED|REFUSED|CANCELLED|REFUNDED
  "extTransactionId": "…",        // ou null
  "createdAt": "2026-05-18T10:30:00.000Z",
  "updatedAt": "2026-05-18T10:30:00.000Z"
}
```

---

## Loyalty

`/api/loyalty` — programa de fidelidade do cliente. Todas exigem papel **CUSTOMER**.

Regra: 1 ponto a cada R$10 na aprovação do pagamento; resgate 1pt = R$0,10 de desconto no pedido (via `pointsRedeemed` na criação do pedido). Pontos só acumulam após consentimento LGPD.

### GET /api/loyalty/me

**CUSTOMER.** Conta de fidelidade do cliente autenticado.

Response `200`: [LoyaltyAccount](#loyaltyaccount). Erro `404` (conta ainda não existe — é criada no primeiro pedido).

### POST /api/loyalty/me/consent

**CUSTOMER.** Concede consentimento LGPD (upsert idempotente — cria a conta se não existir). Response `200`: [LoyaltyAccount](#loyaltyaccount).

### DELETE /api/loyalty/me/consent

**CUSTOMER.** Revoga o consentimento LGPD. Response `200`: [LoyaltyAccount](#loyaltyaccount). Erro `404` (sem conta).

### LoyaltyAccount

```jsonc
{
  "id": "<uuid>",
  "customerId": "<uuid>",
  "totalPoints": 42,
  "consentGiven": true,
  "consentDate": "2026-05-18T10:30:00.000Z",     // ou null
  "consentRevokedAt": null,                       // instante da revogação; null enquanto ativo
  "createdAt": "2026-05-18T10:30:00.000Z"
}
```

---

## Promotions

`/api/promotions` — gestão de promoções por unidade. Todas exigem **ADMIN, MANAGER** e são unit-scoped (MANAGER só na própria unidade; ADMIN bypass). Uma promoção por pedido; aplicada antes da fidelidade.

### POST /api/promotions

Cria promoção. `businessUnitId` vai no corpo mas é validado contra o escopo do ator.

Request:

```jsonc
{
  "businessUnitId": "<uuid>",
  "name": "Almoço executivo",          // ≤100
  "discountType": "PERCENTAGE",        // PERCENTAGE | FIXED_AMOUNT (FREE_ITEM não suportado → erro)
  "discountValue": "10.00",            // PERCENTAGE: percentual (10.00 = 10%); FIXED_AMOUNT: BRL. Positivo, ≤2 casas
  "minOrderValue": "30.00",            // subtotal mínimo; "0" = sem mínimo. ≤2 casas
  "startDate": "2026-06-01T00:00:00.000Z",
  "endDate": "2026-06-30T23:59:59.000Z",
  "isActive": true                     // opcional, default true
}
```

Response `201`: [Promotion](#promotion). Erro `404` unidade fora do escopo.

### GET /api/promotions/by-business-unit/:businessUnitId

Lista promoções da unidade (paginado). Query: `limit`, `cursor`. Response `200`: paginado de [Promotion](#promotion).

### GET /api/promotions/:promotionId

Uma promoção por ID. Response `200`: [Promotion](#promotion). Erro `404`.

### PATCH /api/promotions/:promotionId

Atualiza promoção (todos os campos opcionais; `businessUnitId` é imutável). Mesmos formatos do create.

```jsonc
{
  "name": "…",
  "discountType": "FIXED_AMOUNT",
  "discountValue": "5.00",
  "minOrderValue": "20.00",
  "startDate": "2026-06-01T00:00:00.000Z",
  "endDate": "2026-06-30T23:59:59.000Z",
  "isActive": false
}
```

Response `200`: [Promotion](#promotion). Erro `404`.

### PATCH /api/promotions/:promotionId/activate

`isActive=true`. Response `200`: [Promotion](#promotion). Erro `404`.

### PATCH /api/promotions/:promotionId/deactivate

`isActive=false`. Response `200`: [Promotion](#promotion). Erro `404`.

### Promotion

```jsonc
{
  "id": "<uuid>",
  "businessUnitId": "<uuid>",
  "name": "Almoço executivo",
  "discountType": "PERCENTAGE",
  "discountValue": "10.00",       // string decimal
  "minOrderValue": "30.00",       // string decimal
  "startDate": "2026-06-01T00:00:00.000Z",
  "endDate": "2026-06-30T23:59:59.000Z",
  "isActive": true,
  "createdAt": "2026-05-18T10:30:00.000Z",
  "updatedAt": "2026-05-18T10:30:00.000Z"
}
```

---

## Audit Logs

`/api/audit-logs`

### GET /api/audit-logs

**ADMIN.** Lista logs de auditoria (paginado).

Query: `limit`, `cursor` (uuid), `from` (date-time), `to` (date-time), `userId` (uuid), `action` (string), `entity` (string), `entityId` (string).

Response `200`: paginado de [AuditLog](#auditlog).

### AuditLog

```jsonc
{
  "id": "<uuid>",
  "userId": "<uuid>",             // ou null (eventos de sistema)
  "action": "LOGIN_SUCCESS",
  "entity": "User",
  "entityId": "<uuid>",           // ou null
  "metadata": { },                // objeto sanitizado (chaves sensíveis redigidas) ou null
  "createdAt": "2026-05-18T10:30:00.000Z"
}
```

---

## Enums de referência

| Enum                 | Valores                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `UserRole`           | `ADMIN`, `MANAGER`, `ATTENDANT`, `KITCHEN`, `CUSTOMER`                   |
| `OrderChannel`       | `APP`, `WEB`, `TOTEM`, `COUNTER`, `PICKUP`                               |
| `OrderStatus`        | `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `DELIVERED`, `CANCELLED`   |
| `PaymentMethod`      | `CREDIT_CARD`, `DEBIT_CARD`, `PIX`, `CASH`, `VOUCHER`                    |
| `PaymentStatus`      | `PENDING`, `PROCESSING`, `APPROVED`, `REFUSED`, `CANCELLED`, `REFUNDED`  |
| `DiscountType`       | `PERCENTAGE`, `FIXED_AMOUNT` (`FREE_ITEM` existe mas não é suportado)    |
| Inventory `type`     | `IN`, `OUT` (aceitos na API; `ADJUSTMENT`/`RESERVE` são internos)        |

---

## Fluxo típico (cliente APP)

1. `POST /api/auth/login` → guarda `access_token` + `refresh_token`.
2. `GET /api/business-units` → escolhe a unidade.
3. `GET /api/business-units/:id/menu` → monta o carrinho a partir dos itens disponíveis (`price`, `menuItemId`/`productId`).
4. `POST /api/orders` (com `Idempotency-Key`) → recebe o `Order` com `totalAmount`.
5. `POST /api/payments` → cria o pagamento; acompanhe o `status`.
6. `GET /api/orders/:orderId/payment` e `GET /api/orders/:id` → polling do estado até `DELIVERED`.
7. `GET /api/loyalty/me` → pontos acumulados.

Quando o `access_token` expirar (`401`), chame `POST /api/auth/refresh` e refaça a requisição.
