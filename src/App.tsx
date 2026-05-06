import './main.css';
import EditorPage from "./routes/EditorPage.tsx";
import { Routes, Route } from 'react-router';
import ErrorPage from './routes/ErrorPage.tsx';

function App() {
  return <Routes>
    <Route path="/edit/:id" element={<EditorPage />}></Route>
    <Route path="/error" element={<ErrorPage />}></Route>
    <Route path="/*" element={<ErrorPage />}></Route>
  </Routes>
}

export default App
