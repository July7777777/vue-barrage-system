declare module 'danmaku-websocket.min.js' {
  interface CustomAuthParam {
    key: string;
    value: string;
    type: string;
  }

  interface WebSocketConfig {
    url: string;
    urlList: string[];
    customAuthParam: CustomAuthParam[];
    rid: string;
    protover: number;
    uid: number;
    onReceivedMessage?: (res: any) => void;
    onHeartBeatReply?: (data: any) => void;
    onError?: (data: any) => void;
    onListConnectError?: () => void;
  }

  class DanmakuWebSocket {
    constructor(config: WebSocketConfig);
    destroy(): void;
  }

  export default DanmakuWebSocket;
}