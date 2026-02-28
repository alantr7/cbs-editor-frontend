import './main.css';
import EditorPage from "./routes/EditorPage.tsx";
import { Routes, Route } from 'react-router';

function App() {
  return <Routes>
    <Route path="/edit/:id" element={<EditorPage />}></Route>
  </Routes>
}

export default App
