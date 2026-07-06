import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { TaskTowerProvider } from './context/TaskTowerContext.jsx'
import { supabase } from './lib/supabase.js'

async function bootstrap() {
  // Let Supabase consume email-confirmation tokens before HashRouter reads and
  // rewrites the URL fragment.
  if (supabase) {
    try {
      await supabase.auth.getSession()
    } catch (error) {
      console.warn('The authentication return link could not be restored.', error)
    }
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <HashRouter>
        <TaskTowerProvider>
          <App />
        </TaskTowerProvider>
      </HashRouter>
    </StrictMode>,
  )
}

bootstrap()
