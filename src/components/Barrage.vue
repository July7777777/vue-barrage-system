<template>
  <div
    class="barrage-container"
    ref="containerRef"
  >
    <div
      v-for="track in tracks"
      :key="track"
      class="barrage-track"
    ></div>

    <div
      v-for="i in items"
      :key="i.id"
      :id="`${i.id}`"
      :class="`bullet-${i.state} ${getColorful(i.color) ? 'colorful' : ''}`"
      class="barrage-item"
      :style="`color: ${getColor(i.color)};top:${i.track !== undefined ? i.track * TRACK_HEIGHT : 0}px`"
      @animationend="onAnimationEnd(i.id)"
    >
      {{ i.text }}
    </div>
    <div class="barrage-item barrage-top">测试顶部</div>
    <div class="barrage-item barrage-bottom">测试底部</div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';

  // === 类型定义 ===
  type BarrageType = 'scroll' | 'top' | 'bottom';
  type BarrageState = 'waiting' | 'running' | 'done';
  interface BarrageItem {
    id: number;
    text: string;
    color?: string;
    fontSize?: number;
    type: BarrageType;
    duration?: number;
    timestamp: number;
    track: number | undefined;
    state?: BarrageState;
  }

  // === 响应式数据 ===
  const items = ref<BarrageItem[]>([]);
  const waitingQueue = ref<BarrageItem[]>([]); // 等待队列
  const containerRef = ref<HTMLElement | null>(null);
  let idCounter = 0; // 用于生成唯一ID
  let checkQueueTimer: number | undefined; // 检查队列的定时器
  let trackStates: boolean[] = []; // 轨道状态数组，true表示空闲，false表示占用

  // === 配置常量 ===
  const MAX_PER_SECOND = 8; // 每秒最多显示弹幕数
  const CONTAINER_HEIGHT = 200; // 容器高度
  const ANIM_MIN = 8; // 最小动画时长
  const ANIM_MAX = 12; // 最大动画时长
  // 上边四个属性未使用
  const MAX_BARRAGES = 300; // 最大显示数量
  const TRACK_HEIGHT = 32; // 轨道高度
  const CHECK_INTERVAL = 200; // 检查队列间隔时间(ms)
  const ANIMATION_DURATION = 5000; // 动画bullet-running的时长（毫秒）
  const ColorRegex = /^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgb|hsl)a?\s*$$\s*(?:\d{1,3}%?\s*,\s*){2}\d{1,3}%?(?:\s*,\s*(?:0?\.\d+|1|0))?\s*$$|(?:aliceblue|antiquewhite|...|yellowgreen))$/i;
  const colorArr = ['#ffffff', '#fe0302', '#ff7204', '#ffaa02', '#ffd302', '#ffff00', '#a0ee00', '#00cd00', '#019899', '#4266be', '#89d5ff', '#cc0273', '#222222', '#9b9b9b',];
  const ChineseColor = {
    红: '#ff0000',
    橙: '#ff8000',
    黄: '#ffff00',
    绿: '#00ff00',
    青: '#00ffff',
    蓝: '#0000ff',
    紫: '#ff00ff',
    靛: '#8000ff',
    黑: '#222222',
    灰: '#9b9b9b',
    白: '#ffffff',
  };
  // === 计算轨道数 ===
  const containerRefHeight = computed(() => containerRef.value?.clientHeight || TRACK_HEIGHT);
  const containerRefWidth = computed(() => containerRef.value?.clientWidth || 0);
  const trackCount = computed(() => Math.floor(containerRefHeight.value / TRACK_HEIGHT));
  const tracks = computed(() => Array.from({ length: trackCount.value }, () => 1));

  // 初始化轨道状态
  const initTrackStates = () => {
    trackStates = new Array(trackCount.value).fill(true); // 初始所有轨道都空闲
  };

  // 监听轨道数量变化，重新初始化轨道状态
  watch(trackCount, () => {
    initTrackStates();
  });

  // === 获取可用轨道（防重叠）===
  const getAvailableTrack = (): number[] => {
    // 使用reduce方法构建只包含数字的数组
    return trackStates.reduce((available: number[], isFree: boolean, index: number) => {
      if (isFree) {
        available.push(index);
      }
      return available;
    }, []);
  };

  // 计算弹幕释放轨道的延迟时间
  const calculateReleaseDelay = (id: number): number => {
    const w1 = containerRefWidth.value; // 轨道容器宽度
    const w2 = document.getElementById(`${id}`)?.getBoundingClientRect().width || 0; // 获取弹幕元素宽度
    const delay = (w2 / (w1 + w2)) * ANIMATION_DURATION; // 计算弹幕完全进入屏幕时间
    return delay;
  };

  // 释放轨道
  const releaseTrack = (trackIndex: number) => {
    if (trackIndex >= 0 && trackIndex < trackStates.length) {
      trackStates[trackIndex] = true;
    }
  };

  // 占用轨道
  const occupyTrack = (trackIndex: number) => {
    if (trackIndex >= 0 && trackIndex < trackStates.length) {
      trackStates[trackIndex] = false;
    }
  };

  // 添加弹幕到等待队列
  const addBarrage = (text: string, options: Partial<BarrageItem> = {}) => {
    const now = Date.now();
    const { color = '#ffffff', fontSize = 16, type = 'scroll', duration } = options;
    const newItem: BarrageItem = {
      id: idCounter++,
      text,
      color,
      fontSize,
      type,
      duration,
      timestamp: now,
      state: 'waiting',
      track: undefined,
    };

    // 对于固定位置的弹幕(top/bottom)，直接添加到显示列表
    if (type !== 'scroll') {
      items.value.push(newItem);
      // 固定位置弹幕3秒后自动移除
      setTimeout(() => {
        const index = items.value.findIndex(item => item.id === newItem.id);
        if (index !== -1) {
          items.value.splice(index, 1);
        }
      }, 3000);
    } else {
      // 滚动弹幕加入等待队列
      waitingQueue.value.push(newItem);
    }
  };

  // 从等待队列发送弹幕
  const sendFromQueue = () => {
    // 检查是否达到最大显示数量
    if (items.value.length >= MAX_BARRAGES) {
      return;
    }

    // 检查是否有等待的弹幕
    if (waitingQueue.value.length === 0) {
      return;
    }
    let trackIndex: number | undefined;
    // 尝试获取可用轨道
    const AvailableTrack = getAvailableTrack();
    if (AvailableTrack.length === 0) {
      return; // 没有可用轨道，稍后再试
    } else {
      // 选择第一个可用轨道
      // 随机选择一个可用轨道
      trackIndex = AvailableTrack[Math.floor(Math.random() * AvailableTrack.length)];
    }

    // 占用轨道
    occupyTrack(trackIndex as number);

    // 从队列取出第一个弹幕
    const barrage = waitingQueue.value.shift()!;
    barrage.track = trackIndex;
    barrage.state = 'running';

    //添加到显示列表
    items.value.push(barrage);

    // 等待DOM更新后计算元素宽度并设置轨道释放时间
    nextTick(() => {
      const delay = calculateReleaseDelay(barrage.id);
      // 弹幕完全进入屏幕后释放轨道
      setTimeout(() => {
        releaseTrack(trackIndex as number);
      }, delay);
    });
  };

  // === 动画结束清理 ===
  const onAnimationEnd = (id: number) => {
    const index = items.value.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = items.value[index];
      if (item?.type === 'scroll') {
        // 确保轨道被释放
        if (item.track !== undefined) {
          releaseTrack(item.track);
        }
        items.value.splice(index, 1);
      }
    }
  };

  // === 样式计算 ===
  const getColorful = (color: string = '#fff'): boolean => {
    const colorfulKeywords = ['colorful', '彩', '99'];
    return colorfulKeywords.includes(color);
  };
  const getColor = (color: string = '#fff') => {
    if (ColorRegex.test(color)) {
      return color;
    }
    if (0 <= Number(color) && Number(color) <= 14) {
      return colorArr[Number(color)];
    }
    if (ChineseColor.hasOwnProperty(color)) {
      return ChineseColor[color as keyof typeof ChineseColor];
    }
    return '#fff';
  };

  // === 模拟实时弹幕 ===
  let interval: number | undefined;

  onMounted(() => {
    // 初始化轨道状态
    initTrackStates();

    // 启动检查队列定时器
    checkQueueTimer = window.setInterval(sendFromQueue, CHECK_INTERVAL);

    // 模拟实时弹幕数据
    const messages = ['欢迎来到直播间', '666', 'Vue 3 太强了', '加油！', '打call', '主播好棒'];
    const colors = ['#f60', '#0f0', '#0ff', '#f0f', '#ff0', '#fff', '99', '红', '橙', '黄', '绿', '青', '蓝', '靛', '紫'];

    // 定时发送模拟弹幕
    const sendRandomBarrage = () => {
      const text = messages[Math.floor(Math.random() * messages.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      addBarrage(text as string, { color, type: 'scroll' });
    };

    // 随机间隔发送弹幕
    interval = window.setInterval(sendRandomBarrage, Math.random() * 3000 + 1000);

    // 显示欢迎语
    addBarrage('🎉 欢迎使用高性能弹幕系统！', { color: '#ff0', type: 'top', fontSize: 20 });
  });

  onUnmounted(() => {
    // 清理定时器
    if (interval !== undefined) {
      clearInterval(interval);
    }
    if (checkQueueTimer !== undefined) {
      clearInterval(checkQueueTimer);
    }
  });

  // 暴露添加弹幕方法供父组件调用
  defineExpose({ addBarrage });
</script>

<style scoped>
  .unUse {
    /* 预览 */
    background: linear-gradient(90deg,
        /* 汉字对应颜色 */
        #ff0000,
        /* 红 */
        #ff8000,
        /* 橙 */
        #ffff00,
        /* 黄 */
        #00ff00,
        /* 绿 */
        #00ffff,
        /* 青 */
        #0000ff,
        /* 蓝 */
        #8000ff,
        /* 靛 */
        #ff00ff,
        /* 紫 */

        /* B站弹幕颜色顺序  0是白  99是彩色 */
        #ffffff,
        #fe0302,
        #ff7204,
        #ffaa02,
        #ffd302,
        #ffff00,
        #a0ee00,
        #00cd00,
        #019899,
        #4266be,
        #89d5ff,
        #cc0273,
        #222222,
        #9b9b9b,
      );
  }

  .barrage-track {
    width: 100%;
    height: 32px;
  }

  .barrage-track:nth-child(even) {
    background-color: rgba(151, 151, 151, 0.1);
  }

  .barrage-track:nth-child(odd) {
    background-color: rgba(32, 32, 32, 0.05);
  }

  .barrage-container {
    position: relative;
    width: 100%;
    /* 根据需要更改 */
    height: 200px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 12px;
    margin: 20px 0;
    user-select: none;
    border: 1px solid #333;
  }

  .barrage-item {
    top: 0;
    position: absolute;
    white-space: nowrap;
    padding: 4px 12px;
    border-radius: 20px;
    /* text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9); */
    text-shadow: 1px 0 1px #000000, 0 1px 1px #000000, 0 -1px 1px #000000, -1px 0 1px #000000;
    pointer-events: none;
    z-index: 1;
  }

  .colorful {
    /* font-size: 24px; */
    font-weight: bold;
    color: rgb(255, 255, 255);
    -webkit-text-fill-color: rgb(255, 255, 255);
    -webkit-text-stroke: 3px transparent;
    background-clip: text;
    text-shadow: none !important;
    background-image: linear-gradient(to right, #ff69b4, #00bfff);
    background-size: cover;
  }

  .barrage-top {
    top: 0px;
    left: 50%;
    transform: translateX(-50%);
  }

  .barrage-bottom {
    top: 50%;
    left: 50%;
    transform: translateX(-50%);
  }

  .bullet-waiting {
    left: 100%;
  }

  .bullet-done {
    left: 0;
    transform: translateX(-80%);
  }

  .bullet-running {
    animation: running 5s linear forwards;
  }

  @keyframes running {
    0% {
      left: 100%;
      transform: translate3d(0, 0, 0);
      opacity: 0;
      /* 开始时完全透明 */
    }

    10% {
      opacity: 1;
      /* 10%进度时完全显示 */
    }

    90% {
      opacity: 1;
      /* 90%进度时保持完全显示 */
    }

    100% {
      left: 0;
      transform: translate3d(-80%, 0, 0);
      opacity: 0;
      /* 结束时完全透明 */
    }
  }
</style>