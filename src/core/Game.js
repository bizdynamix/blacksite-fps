import Input from './Input.js';

export default class Game {
  constructor() {
    this.input = new Input();
    this.running = false;
  }

  async initialize() {
    this.input.initialize();
    console.log('BLACKSITE game scaffold initialized');
  }

  start() {
    this.running = true;
    requestAnimationFrame(this.update.bind(this));
  }

  update() {
    if (!this.running) return;
    this.input.update();
    requestAnimationFrame(this.update.bind(this));
  }
}
