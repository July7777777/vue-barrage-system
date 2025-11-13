<template>
  <div class="barrage-container" ref="containerRef">
    <!-- 弹幕项 -->
    <div v-for="(item, index) in items" :key="index" class="barrage-item" :class="[`type-${item.type}`]" :style="getItemStyle(item)" @animationend="onAnimationEnd(index)" @webkitAnimationEnd="onAnimationEnd(index)">
      {{ item.text }}
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
    id?: number; // 添加ID以避免清理错误
  }

  // === 响应式数据 ===
  const items = ref<BarrageItem[]>([]);
  const containerRef = ref<HTMLElement | null>(null);
  const observer = ref<IntersectionObserver | null>(null);
  let idCounter = 0; // 用于生成唯一ID

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
  const getAvailableTrack = (): number => {
    const occupied: number[] = [];
    items.value
      .filter(i => i.type === 'scroll' && i.top !== undefined)
      .forEach(i => {
        const trackIndex = Math.floor((i.top as number) / TRACK_HEIGHT);
        occupied.push(trackIndex);
      });

    // 尝试找到空闲轨道
    for (let i = 0; i < trackCount.value; i++) {
      if (!occupied.includes(i)) return i * TRACK_HEIGHT + TRACK_HEIGHT / 2;
    }
    // 如果没有空闲轨道，随机选择一个
    return Math.floor(Math.random() * trackCount.value) * TRACK_HEIGHT + TRACK_HEIGHT / 2;
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
      id: idCounter++,
      text,
      color,
      fontSize,
      type,
      duration,
      timestamp: now,
    };

    if (type === 'scroll') {
      const top = getAvailableTrack();
      newItem.top = top;
    }

    // FIFO 清理
    if (items.value.length >= MAX_BARRAGES) {
      const oldestScrollItemIndex = items.value.findIndex(i => i.type === 'scroll');
      if (oldestScrollItemIndex !== -1) {
        items.value.splice(oldestScrollItemIndex, 1);
      } else {
        items.value.shift();
      }
    }

    items.value.push(newItem);

    // 自动清理滚动弹幕 - 增加清理时间
    if (type === 'scroll') {
      const cleanDuration = (duration || ANIM_MIN + Math.random() * (ANIM_MAX - ANIM_MIN)) + 3; // 增加3秒缓冲区
      setTimeout(() => {
        const index = items.value.findIndex(i => i.id === newItem.id);
        if (index !== -1) items.value.splice(index, 1);
      }, cleanDuration * 1000);
    }
  };

  // === 动画结束清理 ===
  const onAnimationEnd = (index: number) => {
    // 确保索引有效
    if (index >= 0 && index < items.value.length) {
      const item = items.value[index];
      if (item?.type === 'scroll') {
        items.value.splice(index, 1);
      }
    }
  };

  // === 可见性优化 ===
  let interval: number | undefined;

  onMounted(() => {
    // 模拟实时弹幕
    const messages = ['欢迎', '666', 'Vue太强了', '打call', '前端加油'];
    const colors = ['#f60', '#0f0', '#0ff', '#f0f', '#ff0'];

    const send = () => {
      const text = messages[Math.floor(Math.random() * messages.length)];
      const color = colors[Math.floor(Math.random() * colors.length)] || '#fff';
      addBarrage(text as string, { color, type: 'scroll' });
    };

    interval = window.setInterval(send, Math.random() * 3000 + 1500);

    // 欢迎语
    addBarrage('欢迎欢迎！', { color: 'yellow', type: 'top', fontSize: 18 });
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
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      };
    } else if (item.type === 'top') {
      return { ...base, top: '12px', left: '50%', transform: 'translateX(-50%)' };
    } else if (item.type === 'bottom') {
      return { ...base, bottom: '12px', left: '50%', transform: 'translateX(-50%)' };
    }
    return base;
  };

  defineExpose({ addBarrage });
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
    user-select: none;
    border: 1px solid #333;
  }

  .barrage-item {
    position: absolute;
    white-space: nowrap;
    padding: 4px 12px;
    border-radius: 20px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
    pointer-events: none;
  }

  .type-scroll {
    animation: barrageMove linear forwards;
    /* 重要：确保滚动弹幕有正确的初始位置 */
    left: 100%;
    transform: translateY(-50%);
  }

  .type-top,
  .type-bottom {
    left: 50%;
    z-index: 10;
    font-weight: bold;
  }

  @keyframes barrageMove {
    0% {
      /* 保持与初始位置一致 */
      transform: translateX(0) translateY(-50%);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateX(calc(-100% - 100vw)) translateY(-50%);
      opacity: 0;
    }
  }
</style>
