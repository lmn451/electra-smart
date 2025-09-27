import { h, render } from 'preact'
import App from './App'

render(<App />, document.getElementById('app'))

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(console.error)
}
