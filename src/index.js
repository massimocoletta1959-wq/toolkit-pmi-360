import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ControlloVersione from './components/ControlloVersione'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
    <ControlloVersione />
  </React.StrictMode>
)
