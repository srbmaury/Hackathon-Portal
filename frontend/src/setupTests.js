import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage BEFORE any imports that use it
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => {
            store[key] = value.toString();
        },
        removeItem: (key) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

// Mock i18n module to prevent localStorage access during module load
// This needs to be done before any imports that use i18n
vi.mock('../i18n/i18n.js', () => ({
    default: {
        changeLanguage: vi.fn(),
        language: 'en',
    },
}));

// Mock react-i18next
vi.mock('react-i18next', async () => {
    const actual = await vi.importActual('react-i18next');
    return {
        ...actual,
        useTranslation: () => ({
            t: (key, params) => {
                if (params) {
                    let result = key;
                    Object.keys(params).forEach((paramKey) => {
                        result = result.replace(`{{${paramKey}}}`, params[paramKey]);
                    });
                    return result;
                }
                return key;
            },
            i18n: {
                changeLanguage: vi.fn(),
                language: 'en',
            },
        }),
        I18nextProvider: ({ children }) => children,
    };
});

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    const React = await import('react');
    return {
        ...actual,
        useNavigate: () => vi.fn(),
        useParams: () => ({}),
        useLocation: () => ({ pathname: '/' }),
        Navigate: ({ to }) => React.createElement('div', { 'data-testid': 'navigate' }, to),
    };
});

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
    default: vi.fn(() => ({
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
    })),
}));

// Mock socket service
const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    connected: true,
    once: vi.fn(),
};

vi.mock('./services/socket.js', () => ({
    initializeSocket: vi.fn(() => mockSocket),
    disconnectSocket: vi.fn(),
    getSocket: vi.fn(() => mockSocket),
}));
