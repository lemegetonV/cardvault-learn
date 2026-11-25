// Every component of CardVault, described for learners. Used by the service map,
// the API explorer and lessons. Facts follow ARCHITECTURE.md at the pinned commit.

export const components = [
  {
    id: 'browser', name: 'Browser', kind: 'plain', port: null,
    job: 'The customer’s browser. It only ever talks to the web app, plus one embedded page from the wallet operator: the terms the customer agrees to before a card joins the wallet.',
    talksTo: ['web (every page and API call)', 'wallet-operator-mock (the terms page, inside an iframe)'],
    lessons: ['the-system-map'],
  },
  {
    id: 'web', name: 'web', kind: 'bank', port: 3000,
    job: 'The Next.js web app the customer uses. Its server side is a backend-for-frontend (BFF): it keeps the login in secure cookies and forwards each API call to the service that owns it. It holds no business rules of its own.',
    owns: 'No database. Session cookies only.',
    talksTo: ['auth-service, card-service, profile-service, enrollment-service, wallet-txn-service'],
    lessons: ['the-system-map'],
  },
  {
    id: 'auth', name: 'auth-service', kind: 'bank', port: 8001, spec: 'auth', docs: 'auth',
    job: 'Logs customers in and hands out tokens. Every other service checks those tokens on its own, using the public keys that auth-service publishes.',
    owns: 'auth database: users, refresh tokens, login failure counters, the signing key.',
    serves: ['POST /v1/auth/login', 'POST /v1/auth/refresh', 'POST /v1/auth/logout', 'GET /.well-known/jwks.json'],
    lessons: ['the-system-map'],
  },
  {
    id: 'card', name: 'card-service', kind: 'bank', port: 8002, spec: 'card', docs: 'card',
    job: 'The card master. It keeps each card, its status and its balance, and decides whether a purchase is approved. It is the only place that ever holds a full card number.',
    owns: 'card database: cards, authorizations, holds, clearing records, a local copy of wallet tokens.',
    serves: ['GET /v1/cards', 'POST /v1/cards/{card_id}/report-lost', 'POST /internal/v1/authorizations', 'POST /internal/v1/clearing'],
    sends: ['card.lifecycle', 'auth.decided', 'txn.cleared'],
    receives: ['enrollment.changed'],
    lessons: ['the-system-map', 'payments-in-plain-words'],
  },
  {
    id: 'profile', name: 'profile-service', kind: 'bank', port: 8005, spec: 'profile', docs: 'profile',
    job: 'Keeps each customer’s email and phone number and whether each one is verified. A wallet card needs both verified.',
    owns: 'profile database: contacts and verification codes.',
    serves: ['GET /v1/profile', 'PATCH /v1/profile', 'POST /v1/profile/verify/send', 'POST /v1/profile/verify'],
    sends: ['contact.updated'],
    lessons: ['the-system-map'],
  },
  {
    id: 'enrollment', name: 'enrollment-service', kind: 'bank', port: 8003, spec: 'enrollment', docs: 'enrollment',
    job: 'The wallet’s system of record. It decides which cards may join the wallet, asks the wallet operator to add, suspend or remove them, and records what the operator confirms.',
    owns: 'enrollment database: enrolments and their history, the customer’s wallet choices, local copies of cards and contacts, reconciliation runs.',
    serves: ['GET /v1/wallet', 'POST /v1/wallet/cards/{card_id}', 'POST /v1/callbacks/operator', 'POST /internal/v1/reconciliation/runs'],
    sends: ['enrollment.changed'],
    receives: ['card.lifecycle', 'contact.updated'],
    talksTo: ['wallet-operator-mock (signed requests both ways)'],
    lessons: ['the-system-map'],
  },
  {
    id: 'wallet-txn', name: 'wallet-txn-service', kind: 'bank', port: 8004, spec: 'wallet_txn', docs: 'wallet-txn',
    job: 'Keeps the customer-facing list of wallet purchases, the CSV export and disputes. It holds no money: balances live in card-service. It builds its records from card-service’s events.',
    owns: 'wallet_txn database: one row per purchase, disputes and their receipts.',
    serves: ['GET /v1/wallet/transactions', 'GET /v1/wallet/transactions/export', 'POST /v1/wallet/transactions/{txn_id}/disputes'],
    receives: ['auth.decided', 'txn.cleared'],
    lessons: ['the-system-map'],
  },
  {
    id: 'operator', name: 'wallet-operator-mock', kind: 'mock', port: 8101, spec: 'wallet_operator', docs: 'wallet-operator-mock',
    job: 'Plays the external company that runs the wallet. It accepts the bank’s signed requests, answers later with signed callbacks, and publishes a daily file of what it holds. Tests can make it slow, wrong or silent on purpose.',
    owns: 'State in memory only.',
    serves: ['POST /v1/enrollments', 'POST /v1/enrollments/{operator_ref}/suspend', 'GET /v1/files/enrollments/{file_date}', 'GET /embed/terms'],
    talksTo: ['enrollment-service (callbacks)', 'network-mock (asks for a wallet token)'],
    lessons: ['the-system-map'],
  },
  {
    id: 'network', name: 'network-mock', kind: 'mock', port: 8102, spec: 'network', docs: 'network-mock',
    job: 'Plays the card network and the merchants. Tests use it to make purchases and to settle, reverse or refund them. It passes each one to card-service for a decision.',
    owns: 'State in memory only.',
    serves: ['POST /v1/test/purchases', 'POST /v1/test/purchases/{trace_id}/settle', 'POST /v1/tokens'],
    talksTo: ['card-service (authorizations and clearing)'],
    lessons: ['the-system-map', 'payments-in-plain-words'],
  },
];

export const byId = Object.fromEntries(components.map((c) => [c.id, c]));

export const topics = [
  { name: 'card.lifecycle', key: 'card_id', from: 'card-service', to: ['enrollment-service'],
    why: 'Tells the wallet that a card was activated, used, reported lost, reissued or closed, so enrollment-service can react (for example, suspend a lost card in the wallet).' },
  { name: 'contact.updated', key: 'customer_id', from: 'profile-service', to: ['enrollment-service'],
    why: 'Tells the wallet that an email or phone number changed or was verified, because eligibility depends on verified contact details.' },
  { name: 'enrollment.changed', key: 'card_id', from: 'enrollment-service', to: ['card-service'],
    why: 'Tells card-service which wallet token belongs to which card and whether it is active, so card-service can approve wallet purchases without calling enrollment-service.' },
  { name: 'auth.decided', key: 'card_id', from: 'card-service', to: ['wallet-txn-service'],
    why: 'Announces every authorization decision, approved or declined. wallet-txn-service turns wallet purchases into transaction records.' },
  { name: 'txn.cleared', key: 'card_id', from: 'card-service', to: ['wallet-txn-service'],
    why: 'Announces every settle, reverse and refund, so the transaction record shows the right amounts and status.' },
];

export const dlqs = [
  { name: 'enrollment.dlq', owner: 'enrollment-service', why: 'Where enrollment-service parks an event it cannot read after 3 tries.' },
  { name: 'wallet.txn.dlq', owner: 'wallet-txn-service', why: 'Where wallet-txn-service parks an event it cannot read after 3 tries.' },
];
