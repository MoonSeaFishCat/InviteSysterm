import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HeroUIProvider } from '@heroui/react'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <HeroUIProvider>
        <App />
        <Toaster 
          position="top-center" 
          toastOptions={{
            style: {
              background: 'hsl(var(--heroui-content1))',
              color: 'hsl(var(--heroui-foreground))',
              border: '1px solid hsl(var(--heroui-divider))',
            },
          }}
        />
      </HeroUIProvider>
    </BrowserRouter>
  </StrictMode>,
)
