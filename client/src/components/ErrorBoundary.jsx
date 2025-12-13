import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 text-white p-4">
                    <div className="bg-red-900/50 p-6 rounded-lg max-w-2xl w-full border border-red-500">
                        <h2 className="text-xl font-bold mb-4 text-red-400">组件渲染出错</h2>
                        <pre className="bg-black/50 p-4 rounded overflow-auto text-sm font-mono">
                            {this.state.error?.toString()}
                        </pre>
                        <button
                            className="mt-4 px-4 py-2 bg-red-600 rounded hover:bg-red-700"
                            onClick={() => this.props.onClose ? this.props.onClose() : window.location.reload()}
                        >
                            关闭
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
