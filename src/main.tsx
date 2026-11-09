import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App.tsx'
import { initTeacherMode } from './ui/progress.ts'
import { TeacherGate } from './ui/TeacherGate.tsx'

initTeacherMode(location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TeacherGate>
      <App />
    </TeacherGate>
  </StrictMode>,
)
