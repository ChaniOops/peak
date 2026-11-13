import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './AppShell'
import { HomeScreen } from '../screens/home/HomeScreen'
import { TrackScreen } from '../screens/track/TrackScreen'
import { PlayScreen } from '../screens/play/PlayScreen'
import { CompeteScreen } from '../screens/compete/CompeteScreen'
import { YouScreen } from '../screens/you/YouScreen'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'track', element: <TrackScreen /> },
      { path: 'play', element: <PlayScreen /> },
      { path: 'compete', element: <CompeteScreen /> },
      { path: 'you', element: <YouScreen /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
