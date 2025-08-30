import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, Download, Upload, Settings } from 'lucide-react';
import ErrorPage_EVA from './ErrorPage_EVA';

interface ErrorPageProps {
    error?: Error;
    onResetOptions: (options: { resetApi: boolean; resetPrompts: boolean; resetUser: boolean; resetOther: boolean; resetDatabase: boolean }) => void;
    onReset: () => void;
    onBackup: () => void;
    onRestore: () => void;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ error, onResetOptions, onReset, onBackup, onRestore }) => {
    const [resetApi, setResetApi] = useState(false);
    const [resetPrompts, setResetPrompts] = useState(false);
    const [resetUser, setResetUser] = useState(false);
    const [resetOther, setResetOther] = useState(false);
    const [resetDatabase, setResetDatabase] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const [isEVA, setIsEVA] = useState(false);

    // Konami code state
    const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
    const [konamiIndex, setKonamiIndex] = useState(0);

    // Hidden button state
    const [, setClickCount] = useState(0);
    const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
    const hiddenButtonRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        onResetOptions({ resetApi, resetPrompts, resetUser, resetOther, resetDatabase });
    }, [resetApi, resetPrompts, resetUser, resetOther, resetDatabase, onResetOptions]);

    // Konami code handler
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === konamiSequence[konamiIndex]) {
                const nextIndex = konamiIndex + 1;
                if (nextIndex === konamiSequence.length) {
                    setIsEVA(true);
                    setKonamiIndex(0);
                } else {
                    setKonamiIndex(nextIndex);
                }
            } else {
                setKonamiIndex(0);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [konamiIndex]);

    // Hidden button handlers
    const handleHiddenClick = () => {
        setClickCount(prev => {
            const newCount = prev + 1;
            if (newCount === 7) {
                setTimeout(() => setIsEVA(true), 0);
                return 0;
            }
            return newCount;
        });
        setTimeout(() => setClickCount(0), 2500);
    };

    const handleMouseDown = () => {
        const timer = setTimeout(() => {
            setIsEVA(true);
        }, 1200);
        setLongPressTimer(timer);
    };

    const handleMouseUp = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    const CheckboxItem: React.FC<{ checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; children: React.ReactNode; icon: React.ReactNode }> = ({ checked, onChange, children, icon }) => (
        <label className="group flex items-center space-x-3 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-200 cursor-pointer">
            <div className="relative">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    className="w-5 h-5 rounded border-2 border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 focus:ring-offset-2 transition-colors"
                />
            </div>
            <div className="flex items-center space-x-3 flex-1">
                <div className="text-blue-600 group-hover:text-blue-700 transition-colors">
                    {icon}
                </div>
                <span className="text-gray-700 font-medium group-hover:text-gray-800 transition-colors">
                    {children}
                </span>
            </div>
        </label>
    );

    if (isEVA) {
        return <ErrorPage_EVA onResetOptions={onResetOptions} onReset={onReset} onBackup={onBackup} onRestore={onRestore} bgmSrc='/Serat - Breaking Rules.opus' />;
    } else {
        return (
            <div className="h-dvh bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
                {/* Background decoration */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl"></div>
                </div>

                <div className="relative max-w-lg w-full">
                    {/* Main card */}
                    <div className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-3xl border border-white/20 overflow-hidden relative">
                        {/* Hidden button */}
                        <div
                            ref={hiddenButtonRef}
                            onClick={handleHiddenClick}
                            onMouseDown={handleMouseDown}
                            onMouseUp={handleMouseUp}
                            className="absolute top-0 right-0 w-4 h-4 cursor-pointer z-10"
                            style={{ backgroundColor: 'transparent' }}
                        ></div>

                        {/* Header */}
                        <div className="relative px-8 pt-8 pb-6 bg-gradient-to-r from-red-500/5 to-orange-500/5">
                            <div className="flex items-center space-x-4">
                                <div className="p-3 bg-red-500/10 rounded-2xl">
                                    <AlertTriangle className="w-8 h-8 text-red-500" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-800 mb-1">
                                        오류가 발생했습니다
                                    </h1>
                                    <p className="text-gray-600 text-sm">
                                        복구 옵션을 선택해주세요
                                    </p>
                                </div>
                            </div>

                            {/* Hidden NERV button - now invisible */}
                            <button
                                type="button"
                                aria-label="Activate NERV Protocol"
                                title="NERV PROTOCOL"
                                onClick={() => setIsEVA(true)}
                                className="hidden"
                            >
                                NERV
                            </button>
                        </div>

                        <div className="px-8 py-6">
                            <p className="text-gray-600 mb-6 leading-relaxed">
                                애플리케이션에서 예기치 않은 오류가 발생했습니다.
                                아래에서 초기화할 설정을 선택하고 복구를 진행하세요.
                            </p>

                            {/* Error details */}
                            {error && (
                                <div className="mb-6">
                                    <button
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                                    >
                                        <span>오류 세부 정보</span>
                                        <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                            ▼
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                            <pre className="text-xs text-gray-700 overflow-auto max-h-32">
                                                {error.message}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Reset options */}
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                    <Settings className="w-5 h-5 mr-2 text-blue-500" />
                                    초기화 옵션
                                </h3>
                                <div className="space-y-3">
                                    <CheckboxItem
                                        checked={resetApi}
                                        onChange={(e) => setResetApi(e.target.checked)}
                                        icon={<div className="w-4 h-4 bg-green-500 rounded"></div>}
                                    >
                                        API 설정 초기화
                                    </CheckboxItem>

                                    <CheckboxItem
                                        checked={resetPrompts}
                                        onChange={(e) => setResetPrompts(e.target.checked)}
                                        icon={<div className="w-4 h-4 bg-blue-500 rounded"></div>}
                                    >
                                        프롬프트 초기화
                                    </CheckboxItem>

                                    <CheckboxItem
                                        checked={resetUser}
                                        onChange={(e) => setResetUser(e.target.checked)}
                                        icon={<div className="w-4 h-4 bg-purple-500 rounded"></div>}
                                    >
                                        사용자 정보 초기화
                                    </CheckboxItem>

                                    <CheckboxItem
                                        checked={resetOther}
                                        onChange={(e) => setResetOther(e.target.checked)}
                                        icon={<div className="w-4 h-4 bg-orange-500 rounded"></div>}
                                    >
                                        기타 설정 초기화
                                    </CheckboxItem>

                                    <CheckboxItem
                                        checked={resetDatabase}
                                        onChange={(e) => setResetDatabase(e.target.checked)}
                                        icon={<div className="w-4 h-4 bg-red-500 rounded"></div>}
                                    >
                                        저장된 데이터베이스 초기화
                                    </CheckboxItem>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={onBackup}
                                        className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>백업</span>
                                    </button>

                                    <button
                                        onClick={onRestore}
                                        className="flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>복구</span>
                                    </button>
                                </div>

                                <button
                                    onClick={onReset}
                                    className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    <span>선택 초기화 및 새로고침</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
};

export default ErrorPage;