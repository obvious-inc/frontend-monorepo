import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info);
    console.error(error, info.componentStack);
  }

  render() {
    const { fallback, children } = this.props;

    if (this.state.hasError) {
      return typeof fallback === "function" ? fallback() : fallback;
    }

    return children;
  }
}
