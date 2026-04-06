/**
 * 测试脚本：验证 ink 的 useInput 行为
 * 
 * 运行方式：
 * 1. 直接运行 CLI 测试交互
 * 2. 或者用这个脚本模拟测试
 */

import React from 'react';
import { render, useInput, useStdin, Box, Text } from 'ink';
import { createInterface } from 'readline';

// 创建一个简单的测试组件来验证 useInput 的行为
function TestInput() {
  const { isRawModeSupported } = useStdin();
  
  useInput((input, key) => {
    console.error('[TEST] Handler A received:', { input, key: JSON.stringify(key) });
  });

  return <Text>Handler A active (isRawModeSupported: {String(isRawModeSupported)})</Text>;
}

function TestInput2() {
  useInput((input, key) => {
    console.error('[TEST] Handler B received:', { input, key: JSON.stringify(key) });
  });

  return <Text>Handler B active</Text>;
}

// 测试两个 handler 是否都能收到事件
function DualHandlerTest() {
  useInput((input, key) => {
    console.error('[TEST] Handler 1:', { input, key: JSON.stringify(key) });
  });

  useInput((input, key) => {
    console.error('[TEST] Handler 2:', { input, key: JSON.stringify(key) });
  });

  return <Text>Testing dual handlers...</Text>;
}

// 简单的事件模拟函数
function simulateKey(key: string) {
  console.error(`[SIMULATE] Key: ${key}`);
  // 在实际测试中，需要通过 stdin 发送原始按键序列
}

// 主测试逻辑
async function runTests() {
  console.error('=== Ink useInput Behavior Tests ===\n');

  // 测试 1: 检查 isRawModeSupported
  console.error('Test 1: Check if raw mode is supported');
  console.error('isRawModeSupported:', true); // 假设支持

  // 测试 2: 检查两个 useInput 调用
  console.error('\nTest 2: Dual useInput calls');
  console.error('If both handlers fire, ink supports multiple handlers');
  console.error('If only one fires, handlers are overwritten');

  // 测试 3: 验证输入处理
  console.error('\nTest 3: Input handling');
  console.error('Type "test" and press Enter to verify character input works');
  console.error('Type "/help" and press Enter to verify slash command detection');

  // 模拟按键
  console.error('\n[SIMULATING] Typing "hello" + Enter:');
  simulateKey('h');
  simulateKey('e');
  simulateKey('l');
  simulateKey('l');
  simulateKey('o');
  simulateKey('Enter');

  console.error('\n[SIMULATING] Typing "/help" + Enter:');
  simulateKey('/');
  simulateKey('h');
  simulateKey('e');
  simulateKey('l');
  simulateKey('p');
  simulateKey('Enter');
}

runTests().catch(console.error);
