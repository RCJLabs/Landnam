import './style.css';
import { App } from './app/App';

const app = new App();
app.start();

// Dev/debug handle for Playwright smoke tests and console poking.
declare global {
  interface Window {
    __wr?: App;
  }
}
window.__wr = app;
