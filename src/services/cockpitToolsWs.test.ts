import { CockpitToolsWsClient } from './cockpitToolsWs';

class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    readyState = FakeWebSocket.CONNECTING;
    onopen: (() => void) | null = null;
    onclose: ((event: { code: number }) => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    close = jest.fn(() => {
        this.readyState = FakeWebSocket.CLOSED;
    });
    send = jest.fn();

    constructor(_url: string) {
        FakeWebSocket.instances.push(this);
    }
}

describe('CockpitToolsWsClient connection watchdog', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        FakeWebSocket.instances = [];
        Object.assign(globalThis, { WebSocket: FakeWebSocket });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('retries when the first socket remains CONNECTING forever', () => {
        const client = new CockpitToolsWsClient();
        client.connect();

        expect(FakeWebSocket.instances).toHaveLength(1);
        jest.advanceTimersByTime(5_000);
        expect(FakeWebSocket.instances[0].close).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(10_000);
        expect(FakeWebSocket.instances).toHaveLength(2);
        client.disconnect();
    });

    it('does not create parallel sockets while connecting', () => {
        const client = new CockpitToolsWsClient();
        client.connect();
        client.connect();

        expect(FakeWebSocket.instances).toHaveLength(1);
        client.disconnect();
    });

    it('clears the watchdog after opening', () => {
        const client = new CockpitToolsWsClient();
        client.connect();
        const socket = FakeWebSocket.instances[0];
        socket.readyState = FakeWebSocket.OPEN;
        socket.onopen?.();

        jest.advanceTimersByTime(20_000);
        expect(socket.close).not.toHaveBeenCalled();
        expect(FakeWebSocket.instances).toHaveLength(1);
        client.disconnect();
    });
});
