import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { TaskTowerProvider } from './context/TaskTowerContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <TaskTowerProvider>
        <App />
      </TaskTowerProvider>
    </HashRouter>
  </StrictMode>,
)
