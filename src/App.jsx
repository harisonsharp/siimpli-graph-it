import React from 'react';
import GraphApp from './components/GraphApp.jsx';
import { ConfigProvider, ErrorProvider } from '@siimpli/graph-it-core';
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
