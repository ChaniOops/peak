import { RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { router } from './app/routes'

export function App() {
  // every framer-motion animation honours the OS reduced-motion setting
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  )
}
