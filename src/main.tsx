import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import * as RouterFile from './router'
import './styles.css'

// Uzimamo router iz fajla
const router = RouterFile.router || RouterFile.default || (RouterFile.getRouter && RouterFile.getRouter())

// Za Electron postavljamo memory history da uvek učita početnu rutu "/"
const memoryHistory = createMemoryHistory({
  initialEntries: ['/'],
})

// Dodeljujemo history router-u
router.update({
  history: memoryHistory,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
