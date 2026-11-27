// Lesson: The TypeScript you need, part 2: async and await.
// A tiny program with no browser in it. Run it with:  node learn/typescript/async-await.ts

// A promise is a value that is not ready yet. This function returns one that
// becomes 'Checkout wallet' after half a second, like a page that loads slowly.
function loadHeading(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve('Checkout wallet'), 500);
  });
}

// Without await you get the promise itself, not the text.
function withoutAwait(): void {
  const heading = loadHeading();
  console.log('without await:', heading);
}

// await pauses this function until the promise is ready, then gives you the value.
// A function that uses await must be marked async.
async function withAwait(): Promise<void> {
  const heading = await loadHeading();
  console.log('with await:   ', heading);
}

withoutAwait();
withAwait();
