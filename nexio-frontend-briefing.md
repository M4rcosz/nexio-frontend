# Briefing de Frontend — Nexio

> **Como usar este documento**: este é um contrato de realidade entre você (próxima sessão Claude) e o estado atual do backend. Endpoints marcados ✅ existem e podem ser chamados. Endpoints marcados `[stub]` ainda **não existem** — você deve mockar com dados realistas seguindo o schema descrito nas seções 7 e 8. **Não invente endpoints novos** sem perguntar.

---

## 1. Visão de produto

**Nexio** é uma plataforma de comércio unificado multi-unidade. O backend é um monolito modular em NestJS, ainda em construção, e atende cinco canais de venda diferentes:

- **APP** — aplicativo mobile do cliente final
- **WEB** — site do cliente final (este frontend)
- **TOTEM** — totem de auto-atendimento dentro da loja
- **COUNTER** — operação de balcão (atendente registra pedidos)
- **PICKUP** — retirada no balcão

Cada canal serve um perfil diferente. Este frontend é o canal **WEB**, voltado ao **cliente final** (`Role.CUSTOMER`). O fluxo desejado é:

> escolher unidade → ver cardápio da unidade → montar carrinho → fazer checkout → pagar → ver pontos de loyalty / acompanhar pedido

**Disclaimer importante**: o backend é um projeto de portfólio de um dev júnior, em evolução por fases. O schema do banco já cobre todo o domínio futuro (pedidos, pagamentos, inventário, promoções, loyalty), mas só uma fração do código foi escrito. Este documento é honesto sobre o que existe vs. o que está apenas modelado.

---

## 2. Stack do backend

| Camada | Tecnologia | Observação |
|---|---|---|
| Runtime | Node.js 24 | LTS |
| Framework | NestJS 11 | |
| Linguagem | TypeScript 5.7 | `strict` parcial |
| ORM | Prisma 7 | adapter `@prisma/adapter-pg` |
| Banco | PostgreSQL 17 | docker-compose local |
| Decimais | `big.js` 7 | uso direto, sem VO `Money` ainda |
| Auth | `@nestjs/jwt` (manual, sem Passport) | `argon2` instalado mas **ainda não usado** |
| Validação | `class-validator` | pipe **não é global** |
| Pacotes | npm | `package-lock.json` é a fonte de verdade |

**Não há OpenAPI/Swagger.** Você precisa tipar todas as respostas manualmente no frontend.

---

## 3. Convenções de API

- **Base URL local**: `http://localhost:3000/api`
- **Prefixo global**: `/api` (definido em `src/main.ts`)
- **CORS**: aberto sem allowlist (TODO no backend para produção)
- **Validação**: o `ValidationPipe` existe mas **não está registrado globalmente** → o backend pode aceitar payloads malformados em alguns endpoints. Valide no cliente também.
- **Erros**: **não há `ExceptionFilter` global** → exceções de domínio (ex: `ProductsFetchException`, `UsersFetchException`) vazam como **HTTP 500 sem corpo padronizado**. Trate 4xx/5xx defensivamente. Não confie em formato consistente de erro.

### Paginação (cursor opaco)

Todos os endpoints de listagem usam o mesmo envelope:

```ts
type Paginated<T> = {
  data: T[]
  meta: {
    limit: number          // 1..100, default 20
    nextCursor: string | null
    hasMore: boolean
  }
}
```

Query params padrão:

| Param | Tipo | Observação |
|---|---|---|
| `limit` | number | 1..100, default 20 |
| `cursor` | string \| undefined | use `meta.nextCursor` da página anterior |
| `search` | string \| undefined | filtro por nome/descrição |
| `categoryId` | string \| undefined | filtro por categoria |

---

## 4. Autenticação (estado REAL hoje)

### O que existe

- **Endpoint**: `POST /api/auth/login`
- **Body**: `{ username: string, password: string }` (mínimo 8 chars no password)
- **Resposta**: `{ access_token: string }` (JWT)
- **Header em rotas protegidas**: `Authorization: Bearer <access_token>`
- **JWT payload**: `{ sub: userId, username, role }`
- **Expiração**: **60 segundos hardcoded** (vai mudar — não é design, é PoC)
- **Guard global**: toda rota é protegida por padrão; rotas marcadas com `@Public()` no backend são abertas (hoje, só `/api/auth/login`).

### O que NÃO existe

| Funcionalidade | Status |
|---|---|
| Refresh token | ❌ |
| Cadastro/registro de usuário | ❌ |
| Reset de senha | ❌ |
| Hash real da senha (argon2/bcrypt) | ❌ — hoje compara string raw, é PoC |
| `JWT_EXPIRES_IN` configurável | ❌ — hardcoded 60s |
| Logout server-side (revogação) | ❌ — JWT é stateless |

### Implicações para o frontend

1. **Trate login como podendo retornar 500** (sem filtro de exceção).
2. **JWT expira em 60s** — durante o desenvolvimento, ou você re-loga a cada chamada, ou cria um helper que injeta um token fresco. Não tente implementar refresh agora porque o endpoint não existe.
3. **Cadastro precisa de mock** — sem backend de signup, crie um stub que aceita o formulário e finge persistir.
4. **Não confie no servidor para validar email/senha** — o backend hoje é frouxo.

### Recomendação de armazenamento (Next.js App Router)

- **Não use `localStorage`** para o JWT (XSS).
- Faça o login via **Route Handler** em `app/api/auth/login/route.ts` que faz proxy para `POST /api/auth/login` no backend e seta o token em **cookie httpOnly, Secure, SameSite=Lax**.
- Server Components leem o cookie via `cookies()` do `next/headers`.
- Client Components nunca tocam o token diretamente — chamam Route Handlers internas que reinjetam o `Authorization: Bearer ...` no fetch para o backend.
- Crie um wrapper `serverFetch(path, init)` server-side que lê o cookie, monta o header e chama o backend.

---

## 5. Endpoints que EXISTEM hoje ✅

Inventário fechado. Não existe mais nada além disso.

### 5.1 `POST /api/auth/login` ✅

| Item | Valor |
|---|---|
| Auth | público (`@Public()`) |
| Body | `{ username: string, password: string }` |
| Resposta 2xx | `{ access_token: string }` |
| Erros | 401 (credenciais inválidas), potencialmente 500 (sem filtro) |

### 5.2 `GET /api/products` ✅

Lista todos os produtos ativos, paginado.

| Item | Valor |
|---|---|
| Auth | requer Bearer token |
| Query | `limit?`, `cursor?`, `search?`, `categoryId?` |
| Resposta 2xx | `Paginated<ProductResponseDto>` |

### 5.3 `GET /api/products/:productId` ✅

Detalhes de um produto.

| Item | Valor |
|---|---|
| Auth | requer Bearer token |
| Params | `productId: string` |
| Resposta 2xx | `ProductResponseDto` (objeto único, sem envelope) |
| Erros | 404 se não existe |

### 5.4 `GET /api/products/by-business-unit/:businessUnitId` ✅

Cardápio de uma unidade específica. **Este é o endpoint chave para a tela de cardápio do cliente** — o `price` retornado já é o preço efetivo (custom da unidade ou base do produto).

| Item | Valor |
|---|---|
| Auth | requer Bearer token |
| Params | `businessUnitId: string` |
| Query | `limit?`, `cursor?`, `search?`, `categoryId?` |
| Resposta 2xx | `Paginated<ProductResponseDto>` |

### `ProductResponseDto`

```ts
type ProductResponseDto = {
  id: string
  name: string
  description: string | null
  price: number          // ⚠ ver seção 10 (Money)
  isActive: boolean
  categoryId: string
  createdAt: string      // ISO 8601
  updatedAt: string      // ISO 8601
}
```

---

## 6. Endpoints que o frontend vai precisar mas NÃO EXISTEM `[stub]`

**Esta é a seção mais importante deste briefing.** Crie mocks em `lib/api/mocks/` para cada um, com dados realistas seguindo o schema da seção 7.

### Auth e identidade

- `POST /api/auth/register` `[stub]` — cadastrar `CUSTOMER`. Body sugerido: `{ username, email, password, name, phone? }`. Resposta sugerida: `{ access_token }` (login automático).
- `POST /api/auth/refresh` `[stub]` — renovar JWT.
- `POST /api/auth/logout` `[stub]` — limpar cookie no Route Handler local; backend stateless por enquanto.
- `GET /api/users/me` `[stub]` — perfil do usuário logado. Resposta: `User` (ver seção 7).

### Unidades e cardápio

- `GET /api/business-units` `[stub]` — lista de unidades disponíveis ao cliente. Resposta: `Paginated<BusinessUnit>`.
- `GET /api/business-units/:id` `[stub]` — detalhes da unidade.
- `GET /api/categories` `[stub]` — categorias para filtrar o cardápio. Resposta: `Paginated<Category>`.

### Pedidos

- `POST /api/orders` `[stub]` — criar pedido a partir do carrinho. Body sugerido: `{ businessUnitId, orderChannel: 'WEB', items: Array<{ productId, quantity, notes? }>, notes? }`. Resposta: `Order`.
- `GET /api/orders/:id` `[stub]` — acompanhar status (polling — WebSocket é target state, não existe).
- `GET /api/orders/me` `[stub]` — histórico do cliente. Resposta: `Paginated<Order>`.
- `POST /api/orders/:id/cancel` `[stub]` — cancelar (se `orderStatus` permitir).

### Pagamentos

- `POST /api/orders/:id/payments` `[stub]` — iniciar pagamento. Body: `{ method: PaymentMethod }`. Resposta: `Payment` (com possível `extTransactionId` para PIX/cartão).
- `GET /api/orders/:id/payments` `[stub]` — status do pagamento.

### Loyalty

- `GET /api/loyalty/me` `[stub]` — saldo de pontos do cliente. Resposta: `LoyaltyAccount` + transações recentes.
- `POST /api/loyalty/me/consent` `[stub]` — registrar consentimento LGPD.

**Regra para os mocks**: cada um deve viver em `lib/api/mocks/<recurso>.ts`, exportar uma função com a mesma assinatura do client real (`async function listOrders(): Promise<Paginated<Order>>`), e o caller decide entre real/mock via flag `process.env.NEXT_PUBLIC_USE_MOCKS === 'true'` ou similar. **Marque cada arquivo com um comentário** `// TODO: backend not implemented yet — using mock`.

---

## 7. Schema de dados relevante (entidades)

Resumo enxuto. O `prisma/schema.prisma` é a fonte de verdade — peça para ler se precisar de algum campo específico.

### `User`
```ts
type User = {
  id: string
  username: string
  email: string | null   // opcional no schema atual
  name: string
  phone: string | null
  role: Role
  businessUnitId: string | null   // null para CUSTOMER (cliente não pertence a unidade)
  isActive: boolean
  createdAt: string
  updatedAt: string
}
```

### `BusinessUnit`
```ts
type BusinessUnit = {
  id: string
  name: string
  cnpj: string
  address: string
  city: string
  phone: string
  isActive: boolean
}
```

### `Category`
```ts
type Category = {
  id: string
  name: string
  description: string | null
}
```
Sem multi-tenancy — categorias são globais.

### `Product`
```ts
type Product = {
  id: string
  categoryId: string
  name: string
  description: string | null
  basePrice: string       // Decimal(12,2) — chega como número no JSON, mas mantenha como string no domínio se for somar
  imageUrl: string | null
  isActive: boolean
}
```

### `BusinessUnitMenuItem`
Liga `Product` a `BusinessUnit` com preço customizado.
```ts
type BusinessUnitMenuItem = {
  businessUnitId: string
  productId: string
  customPrice: string | null
  isAvailable: boolean
}
```
**Você raramente vai precisar dessa entidade no frontend** — o endpoint `GET /api/products/by-business-unit/:id` já retorna o preço efetivo (`customPrice ?? product.basePrice`) no campo `price` do `ProductResponseDto`.

### `Order` (não existe endpoint ainda — só schema)
```ts
type Order = {
  id: string
  businessUnitId: string
  customerId: string
  attendantId: string | null     // null para WEB/APP, presente em COUNTER
  orderChannel: OrderChannel
  orderStatus: OrderStatus
  totalAmount: string            // Decimal
  pointsEarned: number
  pointsRedeemed: number
  notes: string | null
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}
```

### `OrderItem`
```ts
type OrderItem = {
  productId: string
  quantity: number
  unitPrice: string      // Decimal — congelado no momento do pedido
  subtotal: string       // Decimal
  notes: string | null
}
```

### `Payment` (1:1 com Order)
```ts
type Payment = {
  orderId: string
  amount: string
  method: PaymentMethod
  status: PaymentStatus
  extTransactionId: string | null   // ID do gateway externo (PIX, cartão)
}
```

### `LoyaltyAccount`
```ts
type LoyaltyAccount = {
  customerId: string
  totalPoints: number
  consentGiven: boolean
  consentDate: string | null
}
```
**Regra LGPD**: `consentGiven` precisa ser `true` para acumular pontos. Coloque um checkbox claro no cadastro ou na primeira tela de loyalty: *"Aceito participar do programa de fidelidade e que meus dados de consumo sejam usados para gerar pontos."*

### `Promotion` e `OrderPromotion`
Existem no schema mas não são prioridade no MVP do cliente final. Ignore por enquanto, só saiba que o desconto vem aplicado no `totalAmount` do `Order`.

> **Atualização:** a área **admin** deste frontend já gerencia promoções
> (`app/[locale]/admin/promotions`, client `lib/api/promotions.ts`). O escopo
> "ignore" acima vale apenas para a experiência **CUSTOMER/WEB**.

### `Inventory`
Backstage — o cliente final nunca vê. Ignore.

> **Atualização:** o **admin** deste frontend agora expõe inventário
> (`app/[locale]/admin/inventory`, client `lib/api/inventory.ts`). "Ignore"
> permanece verdadeiro só para o CUSTOMER.

---

## 8. Enums (uniões de string no frontend)

```ts
export type Role =
  | 'ADMIN' | 'MANAGER' | 'ATTENDANT' | 'KITCHEN' | 'CUSTOMER'

export type OrderChannel =
  | 'APP' | 'WEB' | 'TOTEM' | 'COUNTER' | 'PICKUP'

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'

export type PaymentMethod =
  | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'CASH' | 'VOUCHER'

export type PaymentStatus =
  | 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REFUSED' | 'CANCELLED'

export type DiscountType =
  | 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_ITEM'

export type InventoryTransactionType =
  | 'IN' | 'OUT' | 'ADJUSTMENT' | 'RESERVE'

export type LoyaltyTransactionType =
  | 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUSTMENT'
```

### Para este frontend (CUSTOMER/WEB)

- **`orderChannel`**: sempre `'WEB'` em todo `POST /api/orders`.
- **`paymentMethod` no MVP**: priorize `'PIX'` e `'CREDIT_CARD'`. `CASH` e `VOUCHER` não fazem sentido para WEB.
- **`orderStatus` para timeline visual**: `PENDING → CONFIRMED → PREPARING → READY → DELIVERED` (ou `CANCELLED` em qualquer ponto antes de `DELIVERED`).

### Mapeamento PT-BR sugerido (UI labels)

| Enum | Label PT-BR |
|---|---|
| `OrderStatus.PENDING` | "Aguardando confirmação" |
| `OrderStatus.CONFIRMED` | "Confirmado" |
| `OrderStatus.PREPARING` | "Em preparo" |
| `OrderStatus.READY` | "Pronto para entrega" |
| `OrderStatus.DELIVERED` | "Entregue" |
| `OrderStatus.CANCELLED` | "Cancelado" |
| `PaymentStatus.PENDING` | "Aguardando pagamento" |
| `PaymentStatus.PROCESSING` | "Processando" |
| `PaymentStatus.APPROVED` | "Pago" |
| `PaymentStatus.REFUSED` | "Recusado" |
| `PaymentStatus.CANCELLED` | "Cancelado" |
| `PaymentMethod.PIX` | "PIX" |
| `PaymentMethod.CREDIT_CARD` | "Cartão de crédito" |

---

## 9. Multi-tenancy — regra crítica

`businessUnitId` é o eixo de tenancy do sistema inteiro. **Atenção a duas regras opostas dependendo do papel do usuário:**

1. **Para usuários internos (`ATTENDANT`, `MANAGER`, `KITCHEN`)**: o `businessUnitId` vem do JWT do usuário. O backend (quando esses endpoints existirem) **não vai aceitar `businessUnitId` no body** — vai injetar do contexto. Nunca mande no payload.
2. **Para `CUSTOMER` (este frontend)**: o cliente **não pertence a uma unidade fixa** — escolhe a cada pedido. Então o `businessUnitId` é selecionado pelo usuário (tela de seleção de unidade) e enviado **explicitamente no body** de `POST /api/orders`.

**Regra de UX**: persistir a última unidade escolhida em cookie/localStorage para sugerir como default no próximo acesso, mas sempre permitir trocar.

---

## 10. Money handling

| Camada | Formato |
|---|---|
| Banco (PostgreSQL) | `Decimal(12,2)` |
| Backend (NestJS) | `big.js` raw, ainda sem `Money` VO |
| Wire format (JSON) | `number` (precisão suficiente para reais brasileiros) |
| Frontend | **`big.js` ou `decimal.js`** para somar carrinho |

### Regras

- **Nunca** use `+`, `-`, `*` ou `===` em valores de dinheiro em JS. Use `.plus()`, `.eq()`, `.times()`.
- Renderize com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Inputs de quantidade são `number` (int) — multiplicação de quantidade × preço usa `Big(price).times(quantity)`.
- Persista o valor exibido no carrinho como string formatada apenas na hora de mostrar; mantenha `Big` no estado.

### Helper sugerido

```ts
import Big from 'big.js'

export function asMoney(v: string | number): Big {
  return new Big(v)
}

const fmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatBRL(v: Big | string | number): string {
  return fmt.format(Number(v.toString()))
}
```

---

## 11. Recomendações para Next.js (App Router)

### Estrutura sugerida

```
app/
├── (public)/
│   ├── page.tsx                  # home — escolher unidade
│   ├── unidades/
│   │   └── [id]/
│   │       ├── page.tsx          # cardápio da unidade (RSC)
│   │       └── produtos/[productId]/page.tsx   # detalhe (RSC)
│   ├── login/page.tsx
│   └── cadastro/page.tsx
├── (auth)/
│   ├── carrinho/page.tsx         # client component (state)
│   ├── checkout/page.tsx
│   ├── pagamento/[orderId]/page.tsx
│   ├── pedidos/page.tsx          # histórico
│   ├── pedidos/[id]/page.tsx     # acompanhamento (polling)
│   └── loyalty/page.tsx
├── api/
│   └── auth/
│       ├── login/route.ts        # proxy + seta cookie httpOnly
│       ├── logout/route.ts       # limpa cookie
│       └── refresh/route.ts      # [stub] até backend entregar
└── layout.tsx
lib/
├── api/
│   ├── client.ts                 # serverFetch + clientFetch
│   ├── types.ts                  # tipos da seção 7-8
│   ├── products.ts               # ✅ real
│   ├── business-units.ts         # [stub]
│   ├── orders.ts                 # [stub]
│   ├── payments.ts               # [stub]
│   ├── loyalty.ts                # [stub]
│   └── mocks/
│       ├── business-units.ts
│       ├── orders.ts
│       ├── payments.ts
│       └── loyalty.ts
├── money.ts                      # helper Big + formatBRL
└── cart/                         # state do carrinho (Zustand sugerido)
```

### Padrões

- **Server Components** para leitura pública (cardápio): `fetch` nativo do Next com `next: { revalidate: 60, tags: [...] }`.
- **Client Components** para carrinho, formulários, pagamento.
- **Server Actions** ou **Route Handlers** para mutations — nunca chame o backend diretamente do client com o token.
- **Tipagem manual** em `lib/api/types.ts` (não há OpenAPI/Swagger). Sugestão forte: validar respostas com **Zod** em runtime — o backend hoje pode mandar 500 sem corpo, e em alguns endpoints o `ValidationPipe` não roda.
- **`ApiError` wrapper** centralizado:
  ```ts
  export class ApiError extends Error {
    constructor(public status: number, public body: unknown, message: string) {
      super(message)
    }
  }
  ```
- **i18n**: o produto é PT-BR. Configure `next-intl` ou similar desde o início se houver chance de internacionalização; caso contrário, use só strings PT-BR direto.
- **Imagens**: `imageUrl` do `Product` é nullable. Use `next/image` com fallback.
- **Loading states**: `loading.tsx` por rota.
- **Error boundaries**: `error.tsx` por rota — especialmente importante porque o backend manda 500 sem detalhes.

---

## 12. Variáveis de ambiente do frontend (sugestão)

```env
# Cliente (visível no browser)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_USE_MOCKS=true       # alterne para 'false' quando o backend entregar os endpoints

# Servidor (nunca expor)
BACKEND_INTERNAL_URL=http://localhost:3000/api
SESSION_COOKIE_NAME=nexio_session
SESSION_COOKIE_SECURE=false      # true em produção
```

**Backend espera apenas `JWT_SECRET_KEY`** no `.env` dele — não há configuração de allowlist de origins ainda. CORS está aberto.

---

## 13. Roadmap mínimo de telas (MVP cliente final)

Ordem sugerida de implementação. As marcações ✅ / `[stub]` indicam se o endpoint backing existe.

| # | Tela | Endpoint principal | Status |
|---|---|---|---|
| 1 | Home — escolher unidade | `GET /api/business-units` | `[stub]` (mock até backend entregar) |
| 2 | Cardápio da unidade | `GET /api/products/by-business-unit/:id` | ✅ |
| 3 | Detalhe do produto | `GET /api/products/:id` | ✅ |
| 4 | Carrinho | (client-side state) | n/a |
| 5 | Login | `POST /api/auth/login` | ✅ (com ressalvas: 60s, sem hash) |
| 6 | Cadastro | `POST /api/auth/register` | `[stub]` |
| 7 | Checkout | `POST /api/orders` | `[stub]` |
| 8 | Pagamento (PIX/cartão) | `POST /api/orders/:id/payments` | `[stub]` |
| 9 | Acompanhamento do pedido | `GET /api/orders/:id` (polling) | `[stub]` |
| 10 | Histórico | `GET /api/orders/me` | `[stub]` |
| 11 | Loyalty (saldo + consentimento) | `GET /api/loyalty/me` | `[stub]` |

Comece pelas telas com endpoint real (2, 3, 5) para validar a infra de fetch + auth + cookie + tipagem antes de gastar tempo nos mocks.

---

## 14. Como começar (instruções para a próxima sessão)

> Este documento é um contrato de realidade. O backend tem hoje **4 endpoints reais** (seção 5). Tudo o resto na seção 6 está marcado `[stub]` e deve ser mockado em `lib/api/mocks/` com dados realistas conforme o schema das seções 7-8. Nunca invente endpoints — se sentir falta de algum, pergunte ao usuário antes de assumir que existe.
>
> **Prioridade 0** (antes de qualquer tela): subir o projeto Next.js, criar `lib/api/client.ts` com `serverFetch` que injeta cookie, criar `app/api/auth/login/route.ts` que faz proxy + seta cookie httpOnly, e validar o fluxo `login → cookie → /api/products`.
>
> **JWT expira em 60s.** Durante o desenvolvimento, crie um helper que detecta 401 e faz re-login automaticamente com credenciais de seed (`prisma/seed.ts` cria usuários). Não tente implementar refresh — o endpoint não existe.
>
> **Money**: nunca `+`. Sempre `Big`. Renderize com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
>
> **Multi-tenancy**: cliente CUSTOMER escolhe unidade a cada pedido. `businessUnitId` vai no body de `POST /api/orders`. Persista a última escolha em cookie para UX.
>
> **PT-BR** é o idioma do produto. Use as labels da seção 8 para enums.
>
> **Sem OpenAPI**: tipe manualmente, valide respostas com Zod.

---

## Apêndice A — Credenciais de seed (desenvolvimento local)

O backend tem `prisma/seed.ts` que cria 2 unidades, 3 usuários (com roles variadas) e 5 menu items. Pergunte ao usuário pelas credenciais exatas — elas mudam entre runs do seed e não devem ser hardcoded aqui. Comando para subir o seed:

```bash
npm run db:seed
```

## Apêndice B — Comandos úteis do backend

```bash
npm run dev                # docker compose up + nest start --watch
npm run start:dev          # nest watch (assume DB já em pé)
docker compose up -d --wait
npm run db:generate        # após mudar schema
npm run db:migrate         # criar/aplicar migration (dev)
npm run db:seed
npx prisma studio          # GUI do banco
```

Você (frontend) NÃO precisa rodar nenhum desses — quem cuida do backend é o usuário. Você só precisa que `http://localhost:3000/api` esteja respondendo.

## Apêndice C — O que está fora deste briefing

- **Channels APP/TOTEM/COUNTER/PICKUP**: ignore. Este frontend é só WEB.
- **Roles ADMIN/MANAGER/ATTENDANT/KITCHEN**: ignore. Este frontend é só CUSTOMER.
- **Inventário**: backstage — cliente final não vê.
- **Promoções**: existe no schema, fora do MVP. Trate `totalAmount` do `Order` como já tendo aplicado qualquer desconto.

> **Atualização:** além da experiência CUSTOMER/WEB, este repositório também
> hospeda uma **área admin** (`/admin`) com Users, Inventory e Promotions,
> escopada por role (ADMIN/MANAGER). As regras "ignore" acima descrevem o
> escopo **CUSTOMER**, não o repositório inteiro.
- **Eventos de domínio, Outbox, WebSocket**: target state do backend. Use polling em `GET /api/orders/:id` para acompanhar status (intervalo sugerido: 5s).
- **Observabilidade, tracing**: nada no backend ainda.