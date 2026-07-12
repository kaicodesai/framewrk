import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Pipeline from './pages/Pipeline'
import ProspectDetail from './pages/ProspectDetail'
import Outreach from './pages/Outreach'
import Handovers from './pages/Handovers'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Pipeline />} />
        <Route path="prospects/:id" element={<ProspectDetail />} />
        <Route path="outreach" element={<Outreach />} />
        <Route path="handovers" element={<Handovers />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
