import { invoke } from '@tauri-apps/api/core';
import React, { useState, useEffect } from 'react';
import GraphApp from './components/GraphApp.jsx';
import { ConfigProvider, ErrorProvider } from '@harisonsharp/graph-it-core';
import "./App.css";

function App() {
    const [launchPayload, setLaunchPayload] = useState(null);

    useEffect(() => {
        invoke("get_launch_payload")
            .then(raw => {
                if (raw) {
                    try { setLaunchPayload(JSON.parse(raw)); } catch {}
                }
            })
            .catch(() => {});
    }, []);

    return (
        <ErrorProvider>
            <ConfigProvider>
                <GraphApp launchPayload={launchPayload} />
            </ConfigProvider>
        </ErrorProvider>
    );
}

export default App;
