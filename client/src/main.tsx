import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { BoardPage } from './routes/BoardPage'
import { NewBoardRedirect } from './routes/NewBoardRedirect'
import './index.css'

const rootEl = document.getElementById('root')
if (rootEl === null) throw new Error('#root missing from index.html')

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NewBoardRedirect />} />
        <Route path="/board/:boardId" element={<BoardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
