import React, { Profiler, type ProfilerOnRenderCallback } from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App";
import { perfMonitor } from "./perf/perfMonitor";

const onAppRootRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
) => {
  perfMonitor.recordReactRender(id, actualDuration, baseDuration);
  perfMonitor.incrementCounter(`react.render.${id}.${phase}`);
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Profiler id="AppRoot" onRender={onAppRootRender}>
      <App />
    </Profiler>
    <Analytics />
    <SpeedInsights />
  </React.StrictMode>,
);
