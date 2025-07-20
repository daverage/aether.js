# Aether.js

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)![Version: 1.0.0](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)![Dependencies: 0](https://img.shields.io/badge/dependencies-0-lightgrey.svg)![Size: ~5KB Gzipped](https://img.shields.io/badge/size-~5KB%20gzipped-orange.svg)

**Aether.js is a featherlight, zero-dependency JavaScript library for the modern web. It provides just enough structure and utility to handle common, often tedious, client-side tasks without the overhead of a large framework.**

Think of it as the minimalist's toolkit for building fast, efficient, and maintainable websites and single-page applications.

## Philosophy

In a world of heavyweight frameworks, Aether.js is intentionally small. It's built on a simple premise: leverage modern browser APIs and provide clean, intuitive solutions for the 80% of tasks you do every day. No virtual DOM, no complex build tools required, no fluff. Just a single file that gives you superpowers.

## Core Features

*   **Reactive State Management:** A simple, powerful store for managing application state without the boilerplate.
*   **DOM Utilities:** Asynchronously wait for elements to exist and handle events with efficient delegation.
*   **Animation Helpers:** Promise-based wrappers around the Web Animations API for smooth transitions.
*   **Web Component Factory:** A declarative helper to simplify the creation of standard Web Components.
*   **SPA Routing:** A lightweight, history-based router for building single-page applications.
*   **Essential Utilities:** Built-in `debounce` and `throttle` functions so you don't have to write them again.

## Getting Started

Getting started is as simple as it gets. Download `aether.js` and include it in your HTML file.

```html
<script src="path/to/aether.js"></script>
```

That's it! The `aether` object is now available globally.

---

## API Documentation

### DOM & Observation

#### `aether.waitFor(selector)`

Asynchronously waits for an element to appear in the DOM. Essential for dynamic content.

*   **`selector`** (string): The CSS selector of the element.
*   **Returns:** `Promise<Element>` that resolves with the element when it exists.

```javascript
aether.waitFor('#dynamic-content').then(element => {
  console.log('It exists!', element);
  element.textContent = 'Content loaded.';
});
```

#### `aether.on(parent, eventType, childSelector, callback)`

Efficiently delegates events by attaching a single listener to a parent element.

*   **`parent`** (Element|string): The parent element or its selector.
*   **`eventType`** (string): The event type (e.g., `'click'`).
*   **`childSelector`** (string): The selector for the target child elements.
*   **`callback`** (Function): The function to execute, receiving `event` and `target` as arguments.

```javascript
// Handles clicks on any .delete-btn inside the #user-list container
aether.on('#user-list', 'click', '.delete-btn', (event, target) => {
  const userId = target.dataset.userId;
  console.log('Deleting user:', userId);
  target.closest('li').remove();
});
```

### State Management

#### `aether.createStore(initialState)`

Creates a simple, singleton reactive state store.

*   **`initialState`** (object): The initial state of your application.
*   **Returns:** A store object with `getState`, `setState`, and `subscribe` methods.

```javascript
const store = aether.createStore({
  user: { name: 'Guest', loggedIn: false },
  counter: 0
});
```

#### `store.setState(newState)`

Merges a new state object into the current state and notifies all subscribers and bindings.

```javascript
store.setState({ user: { name: 'Alice', loggedIn: true } });
```

#### `store.subscribe(callback)`

Registers a function to be called whenever the state changes.

*   **Returns:** An `unsubscribe` function.

```javascript
const unsubscribe = store.subscribe((newState, changedKey) => {
  console.log('State changed! Key:', changedKey);
  console.log('New counter value:', newState.counter);
});

store.setState({ counter: 1 }); // The callback will fire.
unsubscribe(); // Stop listening to changes.
```

#### `aether.bind(elementOrSelector, stateKey)`

Creates a one-way data binding from a state key to an element's `textContent` or `value`.

```html
<p>Welcome, <span id="username"></span>!</p>
``````javascript
// The text inside #username will automatically update when 'user.name' changes.
aether.bind('#username', 'user.name');

store.setState({ user: { name: 'Bob' } }); // #username now shows "Bob"
```

### Animation

#### `aether.fadeIn(element, options)` / `aether.fadeOut(element, options)`

Convenience functions for common fade animations.

*   **`element`** (Element): The element to animate.
*   **`options`** (object): Animation options (e.g., `{ duration: 500 }`).
*   **Returns:** `Promise` that resolves when the animation finishes.

```javascript
const modal = document.querySelector('#my-modal');
aether.fadeIn(modal).then(() => {
  console.log('Modal is visible.');
});
```

### Web Components

#### `aether.define(name, config)`

A declarative helper to define a standard, framework-agnostic Web Component.

*   **`name`** (string): The component's tag name (e.g., `'user-card'`).
*   **`config`** (object): Configuration with `props`, `template`, `styles`, and `connected` (a lifecycle callback).

```javascript
aether.define('user-card', {
  props: { name: '', bio: '' },
  styles: `h3 { color: steelblue; }`,
  template: `<h3></h3><p></p>`,
  connected(element) {
    // 'this' refers to the custom element instance
    element.shadowRoot.querySelector('h3').textContent = element.getAttribute('name');
    element.shadowRoot.querySelector('p').textContent = element.getAttribute('bio');
  }
});
``````html
<user-card name="Charlie" bio="Loves lightweight libraries."></user-card>
```

### SPA Routing

#### `aether.router()`

Creates a simple and powerful client-side router.

*   **Returns:** A router instance.

```javascript
const router = aether.router();
const app = document.getElementById('app');

// Add routes, including dynamic parameters
router.add('/', () => app.innerHTML = '<h1>Home</h1>');
router.add('/users/:id', (params) => {
  app.innerHTML = `<h1>User Profile: ${params.id}</h1>`;
});

// Set a 404 handler
router.setNotFound(() => app.innerHTML = '<h2>404 - Page Not Found</h2>');

// Initialize the router to listen to clicks and popstate events
router.init();
```

To make links work with the router, add the `data-aether-link` attribute:
```html
<a href="/users/123" data-aether-link>View User 123</a>
```

### Utilities

#### `aether.debounce(func, wait)`

Creates a debounced function that delays execution. Perfect for search inputs or window resizing.

```javascript
const handleSearch = (event) => {
  console.log('Searching for:', event.target.value);
};

// The search will only be logged 300ms after the user stops typing.
document.querySelector('#search').addEventListener('input', aether.debounce(handleSearch, 300));
```

#### `aether.throttle(func, limit)`

Creates a throttled function that limits execution to once per time interval. Ideal for scroll events.

```javascript
const handleScroll = () => {
  console.log('User is scrolling!');
};

// The scroll event will be logged at most once every 100ms.
window.addEventListener('scroll', aether.throttle(handleScroll, 100));
```

---

## Contributing

Aether.js is proudly minimalist, but contributions are welcome! If you have an idea for a feature that aligns with the core philosophy (lightweight, zero-dependency, high-impact), please open an issue to discuss it.

## License

Aether.js is open-source software licensed under the [MIT License](LICENSE).
