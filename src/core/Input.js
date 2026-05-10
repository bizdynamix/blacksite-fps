export default class Input {
  constructor() {
    this.keys = {};
  }

  initialize() {
    window.addEventListener('keydown', event => {
      this.keys[event.code] = true;
    });
    window.addEventListener('keyup', event => {
      this.keys[event.code] = false;
    });
  }

  update() {
    // Placeholder for input polling and state management.
  }
}
