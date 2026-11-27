// Lesson: The TypeScript you need, part 1.
// The pieces of TypeScript the tests use, in one small program with no browser.
// Run it with:  node learn/typescript/basics.ts

// Values and types. const makes a name that cannot be given a new value;
// let makes one that can. ": string" says what kind of value it holds.
const username: string = 'alice';
const limitInCents: number = 500000; // $5,000.00: money is kept in cents
const inWallet: boolean = true;
let attempts = 0; // TypeScript works out the type (number) by itself
attempts = attempts + 1;

// A template string, in backticks, fills in ${...} parts.
console.log(`${username} has signed in ${attempts} time(s)`);

// An array: values in order, counted from 0.
const lastFours: string[] = ['4417', '2045', '7380', '5521'];
console.log('first card:', lastFours[0], '| cards:', lastFours.length);

// An object: values under names. An interface describes the shape an object must have.
interface Card {
  last4: string;
  product: string;
  available: number;
}
const card: Card = { last4: '4417', product: 'CREDIT', available: 500000 };
console.log('product:', card.product);

// A function with typed inputs and a typed result.
function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
console.log('available:', dollars(card.available));

// The same function written as an arrow function: inputs, =>, then the body.
const dollarsArrow = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
console.log('limit:', dollarsArrow(limitInCents));

// if decides; for...of repeats once for each item.
for (const last4 of lastFours) {
  if (last4 === '4417') {
    console.log(last4, 'is the main credit card');
  }
}

// === compares values. Use it, not ==, which can give surprising answers.
console.log('in the wallet?', inWallet === true);
