declare interface CustomAuthParam {
  key: string;
  value: string;
  type: string;
}

declare interface WebSocketConfig {
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

declare class DanmakuWebSocket {
  constructor(config: WebSocketConfig);
  destroy(): void;
}

// 声明为全局变量
declare global {
  interface Window {
    DanmakuWebSocket: typeof DanmakuWebSocket;
  }
}

// 也可以作为模块使用
declare module './danmaku-websocket.min.js' {
  const DanmakuWebSocket: typeof DanmakuWebSocket;
  export default DanmakuWebSocket;
}