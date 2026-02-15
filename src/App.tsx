import { ProjectProvider } from './store/projectStore';
import { Header } from './components/Header';
import { Palette } from './components/Palette';
import { LayoutEditor } from './components/LayoutEditor';
import { PropertyPanel } from './components/PropertyPanel';
import { CodePreview } from './components/CodePreview';
import './App.css';

function App() {
  return (
    <ProjectProvider>
      <div className="app">
        <Header />
        <main className="app-main">
          <Palette />
          <div className="center-panel">
            <LayoutEditor />
            <PropertyPanel />
          </div>
          <CodePreview />
        </main>
      </div>
    </ProjectProvider>
  );
}

export default App;
