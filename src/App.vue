<template>
  <a-layout class="layout-container">
    <a-layout-sider theme="light" width="200" class="left-sider">
      <div class="toolbar">
        <div class="toolbar-title">工具</div>
        <a-button block class="tool-btn" :type="currentTool === 'select' ? 'primary' : 'default'" @click="selectTool('select')">Select</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'line' ? 'primary' : 'default'" @click="selectTool('line')">Line</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'circle' ? 'primary' : 'default'" @click="selectTool('circle')">Circle</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'rect' ? 'primary' : 'default'" @click="selectTool('rect')">Rect</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'triangle' ? 'primary' : 'default'" @click="selectTool('triangle')">Triangle</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'polygon' ? 'primary' : 'default'" @click="selectTool('polygon')">Polygon</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'text' ? 'primary' : 'default'" @click="selectTool('text')">Text</a-button>
        <a-button block class="tool-btn" :type="currentTool === 'image' ? 'primary' : 'default'" @click="selectTool('image')">Image</a-button>
      </div>
    </a-layout-sider>
    <a-layout-content class="content-area">
       <div id="map-container"></div>
    </a-layout-content>
    <a-layout-sider theme="light" width="300" class="right-sider">
      <div class="properties-panel">
        <div class="panel-title">属性</div>
        <div class="panel-content">
          <!-- Properties panel placeholder -->
          <p style="text-align: center; color: #999; margin-top: 20px;">Select an element to view properties</p>
        </div>
      </div>
    </a-layout-sider>
  </a-layout>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { BladeFire } from '../blade-fire/index.js'

const currentTool = ref('')
let activeToolCleanup = null

const selectTool = (tool) => {
  // If clicking the same tool, do nothing or toggle? 
  // For now, let's assume re-selecting resets the tool.
  
  // Cleanup previous tool
  if (activeToolCleanup) {
    activeToolCleanup()
    activeToolCleanup = null
  }
  
  currentTool.value = tool
  if (BladeFire[tool]) {
    const cleanup = BladeFire[tool]()
    if (typeof cleanup === 'function') {
      activeToolCleanup = cleanup
    }
  }
}

onMounted(() => {
  BladeFire.init({ container: 'map-container', grid: true, zoom: true })
})
</script>

<style scoped>
.layout-container {
  width: 100vw;
  height: 100vh;
  display: flex;
}

.left-sider {
  border-right: 1px solid #f0f0f0;
  z-index: 10;
}

.right-sider {
  border-left: 1px solid #f0f0f0;
  z-index: 10;
}

.content-area {
  position: relative;
  overflow: hidden;
  flex: 1;
}

#map-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.toolbar {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-title, .panel-title {
  font-weight: bold;
  margin-bottom: 10px;
  font-size: 16px;
  color: #333;
}

.properties-panel {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
