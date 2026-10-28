// Printable worksheet: a separate page (print.html) that reuses the app's data and sentence view.
// Nothing in the main app depends on this folder, so it can be dropped without touching anything else.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initTeacherMode } from '../ui/progress.ts'
import { Worksheet } from './Worksheet.tsx'

initTeacherMode(location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Worksheet />
  </StrictMode>,
)
