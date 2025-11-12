<template>
  <div class="barrage-container" ref="containerRef" @mouseenter="pause" @mouseleave="resume">
    <!-- 弹幕项 -->
    <div v-for="(item, index) in items" :key="index" class="barrage-item" :class="[`type-${item.type}`]" :style="getItemStyle(item)" @animationend="onAnimationEnd(index)" @webkitAnimationEnd="onAnimationEnd(index)">
      {{ item.text }}
    </div>

    <!-- 控制按钮 -->
    <div class="controls">
      <button @click="togglePause">{{ isPaused ? '继续' : '暂停' }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed } from 'vue';

  // === 类型定义 ===
  type BarrageType = 'scroll' | 'top' | 'bottom';
  interface BarrageItem {
    text: string;
    color?: string;
    fontSize?: number;
    type: BarrageType;
    duration?: number;
    timestamp: number;
    top?: number;
  }

  // === 响应式数据 ===
  const items = ref<BarrageItem[]>([]);
  const containerRef = ref<HTMLElement | null>(null);
  const isPaused = ref(false);
  const observer = ref<IntersectionObserver | null>(null);

  // === 配置 ===
  const MAX_BARRAGES = 30; // 最大显示数量
  const MAX_PER_SECOND = 8; // 每秒最多显示
  const BARRAGE_HEIGHT = 30;
  const CONTAINER_HEIGHT = 200;
  const ANIM_MIN = 8;
  const ANIM_MAX = 12;
  const TRACK_HEIGHT = 30;

  // === 计算轨道数 ===
  const trackCount = computed(() => Math.floor(CONTAINER_HEIGHT / TRACK_HEIGHT));

  // === 获取可用轨道（防重叠）===
  const getAvailableTrack = (): number | null => {
    const occupied: number[] = [];
    items.value
      .filter(i => i.type === 'scroll' && i.top !== undefined)
      .forEach(i => {
        const trackIndex = Math.floor((i.top as number) / TRACK_HEIGHT);
        occupied.push(trackIndex);
      });

    for (let i = 0; i < trackCount.value; i++) {
      if (!occupied.includes(i)) return i * TRACK_HEIGHT + TRACK_HEIGHT / 2;
    }
    return null;
  };

  // === 节流控制 ===
  let lastClearTime = Date.now();
  let burstCount = 0;

  const addBarrage = (text: string, options: Partial<BarrageItem> = {}) => {
    const now = Date.now();
    if (now - lastClearTime > 1000) {
      burstCount = 0;
      lastClearTime = now;
    }
    if (burstCount >= MAX_PER_SECOND) return;
    burstCount++;

    const { color = '#fff', fontSize = 16, type = 'scroll', duration } = options;

    const newItem: BarrageItem = {
      text,
      color,
      fontSize,
      type,
      duration,
      timestamp: now,
    };

    if (type === 'scroll') {
      const top = getAvailableTrack();
      if (top === null) return;
      newItem.top = top;
    }

    // FIFO 清理
    if (items.value.length >= MAX_BARRAGES) {
      items.value.shift();
    }

    items.value.push(newItem);

    // 自动清理滚动弹幕
    if (type === 'scroll' && duration) {
      setTimeout(() => {
        const index = items.value.indexOf(newItem);
        if (index !== -1) items.value.splice(index, 1);
      }, (duration + 2) * 1000);
    }
  };

  // === 动画结束清理 ===
  const onAnimationEnd = (index: number) => {
    const item = items.value[index];
    if (item?.type === 'scroll') {
      items.value.splice(index, 1);
    }
  };

  // === 暂停/继续 ===
  const pause = () => {
    isPaused.value = true;
  };
  const resume = () => {
    isPaused.value = false;
  };
  const togglePause = () => {
    isPaused.value = !isPaused.value;
  };

  // === 可见性优化 ===
  let interval: number | undefined;

  onMounted(() => {
    observer.value = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        resume();
      } else {
        pause();
      }
    });

    if (containerRef.value) {
      observer.value.observe(containerRef.value);
    }

    // 模拟实时弹幕
    const messages = ['欢迎', '666', 'Vue太强了', '打call', '前端加油'];
    const colors = ['#f60', '#0f0', '#0ff', '#f0f', '#ff0'];

    const send = () => {
      const text = messages[Math.floor(Math.random() * messages.length)];
      // 确保color始终是字符串类型
      const color = colors[Math.floor(Math.random() * colors.length)] || '#fff';
      // 显式传递类型为string的color参数
      addBarrage(text as string, { color: color as string, type: 'scroll' });
    };

    interval = window.setInterval(send, Math.random() * 3000 + 1500);

    // 欢迎语
    addBarrage('欢迎来到直播间！', { color: 'yellow', type: 'top', fontSize: 18 });
  });

  onUnmounted(() => {
    if (interval !== undefined) {
      clearInterval(interval);
    }
    observer.value?.disconnect();
  });

  // === 样式计算 ===
  const getItemStyle = (item: BarrageItem) => {
    const base = {
      color: item.color || '#fff',
      fontSize: (item.fontSize || 16) + 'px',
    };

    if (item.type === 'scroll' && item.top !== undefined) {
      const duration = item.duration || ANIM_MIN + Math.random() * (ANIM_MAX - ANIM_MIN);
      return {
        ...base,
        top: item.top + 'px',
        animationDuration: duration + 's',
        animationPlayState: isPaused.value ? 'paused' : 'running',
        willChange: 'transform' as const,
        backfaceVisibility: 'hidden' as const,
      };
    } else if (item.type === 'top') {
      return { ...base, top: '12px', transform: 'translateX(-50%)' };
    } else if (item.type === 'bottom') {
      return { ...base, bottom: '12px', transform: 'translateX(-50%)' };
    }
    return base;
  };

  defineExpose({ addBarrage, pause, resume, togglePause });
</script>

<style scoped>
  .barrage-container {
    position: relative;
    width: 100%;
    height: 200px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 12px;
    margin: 20px 0;
    cursor: pointer;
    user-select: none;
    border: 1px solid #333;
  }

  .barrage-item {
    position: absolute;
    left: 100%;
    transform: translateY(-50%);
    white-space: nowrap;
    padding: 4px 12px;
    border-radius: 20px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
    pointer-events: none;
  }

  .type-scroll {
    animation: barrageMove linear forwards;
  }

  .type-top,
  .type-bottom {
    left: 50%;
    z-index: 10;
    font-weight: bold;
  }

  @keyframes barrageMove {
    0% {
      transform: translateX(100vw) translateY(-50%);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateX(-100%) translateY(-50%);
      opacity: 0;
    }
  }

  .controls {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 20;
  }

  button {
    padding: 6px 12px;
    background: #111;
    color: #fff;
    border: 1px solid #666;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }

  button:hover {
    background: #333;
  }
</style>
