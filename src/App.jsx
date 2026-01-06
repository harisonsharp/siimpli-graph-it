import React from 'react';
import GraphApp from './components/GraphApp.jsx';
import { ConfigProvider } from './contexts/ConfigContext.jsx';
import { ErrorProvider } from './contexts/ErrorContext.jsx';
import "./App.css";

function App() {
  return (
    <ErrorProvider>
      <ConfigProvider>
        <GraphApp />
      </ConfigProvider>
    </ErrorProvider>
  );
}

export default App;
