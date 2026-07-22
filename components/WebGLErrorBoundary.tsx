"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onError?: (message: string) => void;
};

type State = {
  error: string | null;
};

/**
 * Catches WebGL / R3F runtime errors so mobile doesn't stay a silent blank screen.
 */
export default class WebGLErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error: error.message || "WebGL render error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[WebGLErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error.message);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "#000",
            color: "rgba(255,255,255,0.75)",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 13,
            letterSpacing: "0.04em",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          <div>
            <div style={{ color: "#ff6b6b", marginBottom: 8 }}>
              WebGL failed to start
            </div>
            <div style={{ opacity: 0.7, maxWidth: 280 }}>{this.state.error}</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
