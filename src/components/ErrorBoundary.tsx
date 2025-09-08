import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorPage from './ErrorPage';
import { store } from '../app/store';
import { persistor, resetAll } from '../app/store';
import { settingsActions } from '../entities/setting/slice';
import { initialApiConfigs, initialImageApiConfigs } from '../entities/setting/slice';
import type { ApiProvider, ImageApiProvider } from '../entities/setting/types';
import { backupStateToFile, restoreStateFromFile } from '../utils/backup';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    resetOptions: {
        resetApi: boolean;
        resetPrompts: boolean;
        resetUser: boolean;
        resetOther: boolean;
        resetDatabase: boolean;
    };
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            resetOptions: { resetApi: false, resetPrompts: false, resetUser: false, resetOther: false, resetDatabase: false }
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, resetOptions: { resetApi: false, resetPrompts: false, resetUser: false, resetOther: false, resetDatabase: false } };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleResetOptions = (options: { resetApi: boolean; resetPrompts: boolean; resetUser: boolean; resetOther: boolean; resetDatabase: boolean }) => {
        this.setState({ resetOptions: options });
    };

    handleReset = async () => {
        const { resetOptions } = this.state;
        if (resetOptions.resetDatabase) {
            persistor.pause();
            await persistor.flush();
            await persistor.purge();
            store.dispatch(resetAll());
        }
        if (resetOptions.resetApi) {
            const providers: ApiProvider[] = ['gemini', 'vertexai', 'claude', 'openai', 'grok', 'openrouter', 'customOpenAI'];
            providers.forEach(provider => {
                store.dispatch(settingsActions.setApiConfig({ provider, config: initialApiConfigs[provider] }));
            });
            const imageProviders: ImageApiProvider[] = ['gemini', 'novelai'];
            imageProviders.forEach(provider => {
                store.dispatch(settingsActions.setImageApiConfig({ provider, config: initialImageApiConfigs[provider] }));
            });
            store.dispatch(settingsActions.setApiProvider('gemini'));
            store.dispatch(settingsActions.setImageApiProvider('gemini'));
        }
        if (resetOptions.resetPrompts) {
            store.dispatch(settingsActions.resetPrompts());
        }
        if (resetOptions.resetUser) {
            const currentState = store.getState().settings;
            store.dispatch(settingsActions.setSettings({ ...currentState, userName: '', userDescription: '' }));
        }
        if (resetOptions.resetOther) {
            const currentState = store.getState().settings;
            store.dispatch(settingsActions.setSettings({
                ...currentState,
                fontScale: 1.0,
                proactiveChatEnabled: true,
                randomFirstMessageEnabled: false,
                randomCharacterCount: 1,
                randomMessageFrequencyMin: 10,
                randomMessageFrequencyMax: 60,
                useStructuredOutput: true,
                speedup: 2,
                personas: [],
                selectedPersonaId: null
            }));
        }
        this.setState({ hasError: false, error: undefined });
    };

    handleBackup = () => {
        backupStateToFile();
    };

    handleRestore = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;
            try {
                await restoreStateFromFile(file);
                alert("백업 파일이 성공적으로 불러와졌습니다.");
                window.location.reload();
            } catch (err) {
                console.error(err);
                alert("백업 파일 불러오기 실패");
            }
        };
        input.click();
    };

    render() {
        if (this.state.hasError) {
            return <ErrorPage error={this.state.error} onResetOptions={this.handleResetOptions} onReset={this.handleReset} onBackup={this.handleBackup} onRestore={this.handleRestore} />;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
