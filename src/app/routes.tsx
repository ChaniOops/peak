import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthGate } from './AuthGate'
import { AppShell } from './AppShell'
import { HomeScreen } from '../screens/home/HomeScreen'
import { TrackScreen } from '../screens/track/TrackScreen'
import { PlayScreen } from '../screens/play/PlayScreen'
import { ScanScreen } from '../screens/play/ScanScreen'
import { CompeteScreen } from '../screens/compete/CompeteScreen'

// Heavier, less-visited screens load on demand (Recharts, qrcode).
/* eslint-disable react-refresh/only-export-components -- route table, not a hot-reloaded component module */
const YouScreen = lazy(() => import('../screens/you/YouScreen').then((m) => ({ default: m.YouScreen })))
const OrganiserEventScreen = lazy(() =>
  import('../screens/organiser/OrganiserEventScreen').then((m) => ({ default: m.OrganiserEventScreen })),
)
const later = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>

export const router = createBrowserRouter([
  {
    element: <AuthGate />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomeScreen /> },
          { path: 'track', element: <TrackScreen /> },
          { path: 'play', element: <PlayScreen /> },
          { path: 'play/scan', element: <ScanScreen /> },
          { path: 'compete', element: <CompeteScreen /> },
          { path: 'you', element: later(<YouScreen />) },
        ],
      },
      // Hidden organiser demo route — intentionally not in the tab bar.
      { path: 'organiser/event/:eventId', element: later(<OrganiserEventScreen />) },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
