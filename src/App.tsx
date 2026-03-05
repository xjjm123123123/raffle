import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Select, Button, Card, Tag, Space, Loading, toast, Empty } from '@universe-design/react';
import PlayFilled from '@universe-design/icons-react/PlayFilled';
import PauseFilled from '@universe-design/icons-react/PauseFilled';
import DownloadOutlined from '@universe-design/icons-react/DownloadOutlined';
import RefreshOutlined from '@universe-design/icons-react/RefreshOutlined';
import GroupFilled from '@universe-design/icons-react/GroupFilled';
import GiftBagFilled from '@universe-design/icons-react/GiftBagFilled';
import DeleteOutlined from '@universe-design/icons-react/DeleteOutlined';
import confetti from 'canvas-confetti';
import '@universe-design/react/es/styles/light.cssvar.less';
import './index.css';

const { Content } = Layout;

const API_BASE = 'http://localhost:3004/api';

// 演示数据 (当 API 不可用时使用)
const MOCK_ACTIVITIES = [
  { id: 'mock1', name: '年会一等奖（演示）' },
  { id: 'mock2', name: '季度优秀员工（演示）' }
];

const MOCK_PARTICIPANTS = Array.from({ length: 50 }, (_, i) => ({
  id: `mock_p_${i}`,
  name: `幸运儿${i + 1}`,
  isWhitelist: i === 8 // 第9个人是白名单
}));

// 中奖音效 (保留外部文件，因为只需播放一次)
const AUDIO_WIN = 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3';

const DEFAULT_CONFIG = {
  appId: 'cli_a922afd6e5b89bc8',
  appSecret: 'yc0Vf7bE9kA8AmlTn0h6nchyssucONp2',
  appToken: 'ZY0RbMz6na5PwMsTf2NcKSzsnTd',
  tableId: 'tbl7SgCO4iXhcijQ',
  nameField: '姓名',
  activityField: '活动',
  wonField: '是否中奖',
  timeField: '时间',
  whitelistField: '白名单'
};

interface Activity {
  id: string;
  name: string;
}

interface Participant {
  id: string;
  name: string;
  isWhitelist?: boolean;
}

interface Winner {
  id: string;
  name: string;
  time: string;
  activityName: string;
}

export default function App() {
  const [config] = useState(DEFAULT_CONFIG);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivityName, setCurrentActivityName] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [drawCount, setDrawCount] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // 新增处理状态，防止连点
  const [currentDisplay, setCurrentDisplay] = useState<string>('');
  const [currentWinnerId, setCurrentWinnerId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  const drawIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const participantsRef = useRef(participants); // 使用 Ref 解决闭包陷阱

  // 同步 participants 到 Ref
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);
  
  // Web Audio Context for Rolling Sound
  const audioContextRef = useRef<AudioContext | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 初始化 Web Audio Context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContext();

    // 初始化中奖音效
    winAudioRef.current = new Audio(AUDIO_WIN);
    winAudioRef.current.volume = 0.8;

    return () => {
      audioContextRef.current?.close();
      if (winAudioRef.current) {
        winAudioRef.current.pause();
        winAudioRef.current = null;
      }
    };
  }, []);

  // 生成短促的机械点击声
  const playClickSound = useCallback(() => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    
    // 创建振荡器
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // 设置音色：三角波更柔和，不像方波那么刺耳
    osc.type = 'triangle'; 
    
    // 频率：使用音高下滑 (Pitch Drop) 模拟物理打击感
    // 从 400Hz 快速滑落到 100Hz，产生类似 "Tick" 的声音
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);
    
    // 包络：保持短促
    gain.gain.setValueAtTime(0.1, ctx.currentTime); // 稍微提高一点音量，因为三角波能量较低
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }, []);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId,
          appSecret: config.appSecret,
          appToken: config.appToken,
          tableId: config.tableId,
          activityField: config.activityField
        })
      });
      const data = await res.json();
      if (data.success) {
        setActivities(data.activities);
        if (data.activities.length > 0 && !currentActivityName) {
          setCurrentActivityName(data.activities[0].name);
        }
      } else {
        toast.error(data.message || '加载活动失败');
      }
    } catch (e) {
      console.warn('API不可用，启用演示模式');
      setActivities(MOCK_ACTIVITIES);
      if (MOCK_ACTIVITIES.length > 0 && !currentActivityName) {
        setCurrentActivityName(MOCK_ACTIVITIES[0].name);
      }
    }
    setLoading(false);
  }, [config, currentActivityName]);

  const loadParticipants = useCallback(async () => {
    if (!currentActivityName) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId,
          appSecret: config.appSecret,
          appToken: config.appToken,
          tableId: config.tableId,
          activityName: currentActivityName,
          nameField: config.nameField,
          activityField: config.activityField,
          wonField: config.wonField,
          whitelistField: config.whitelistField
        })
      });
      const data = await res.json();
      if (data.success) {
        setParticipants(data.participants);
      } else {
        toast.error(data.message || '加载参与者失败');
      }
    } catch (e) {
      console.warn('API不可用，启用演示参与者');
      // 过滤掉已经在演示中奖列表中的人
      setParticipants(MOCK_PARTICIPANTS.filter(p => !winners.find(w => w.id === p.id)));
    }
    setLoading(false);
  }, [config, currentActivityName, winners]); // winners 变化时不需要重新加载，但如果 API 失败，我们需要依赖它过滤

  const loadWinners = useCallback(async () => {
    if (!currentActivityName) return;
    try {
      const res = await fetch(`${API_BASE}/winners/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId,
          appSecret: config.appSecret,
          appToken: config.appToken,
          tableId: config.tableId,
          activityName: currentActivityName,
          activityField: config.activityField,
          nameField: config.nameField,
          timeField: config.timeField,
          wonField: config.wonField
        })
      });
      const data = await res.json();
      if (data.success) {
        setWinners(data.winners);
      }
    } catch (e) {
      console.warn('API不可用，中奖记录为空');
      // 不做任何操作，保持空或本地状态
    }
  }, [config, currentActivityName]);

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    if (currentActivityName) {
      loadParticipants();
      loadWinners();
    }
  }, [currentActivityName, loadParticipants, loadWinners]);

  const handleStart = () => {
    if (participants.length === 0 || isProcessing) return;
    setIsDrawing(true);
    
    // 恢复 AudioContext (解决浏览器自动挂起策略)
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    // 立即随机选中一个作为初始状态
    const initialIndex = Math.floor(Math.random() * participants.length);
    const initialSelected = participants[initialIndex];
    setCurrentDisplay(initialSelected.name);
    setCurrentWinnerId(initialSelected.id);
    
    // 使用 participantsRef.current 确保 interval 读取的是最新数据
    drawIntervalRef.current = setInterval(() => {
      const currentList = participantsRef.current;
      if (currentList.length === 0) return;

      const randomIndex = Math.floor(Math.random() * currentList.length);
      const selected = currentList[randomIndex];
      setCurrentDisplay(selected.name);
      setCurrentWinnerId(selected.id);
      
      playClickSound();
    }, 30);
  };

  const handleStop = async () => {
    if (!isDrawing || isProcessing) return;
    setIsProcessing(true); // 锁定状态，防止重复点击
    setIsDrawing(false);
    
    if (drawIntervalRef.current) {
      clearInterval(drawIntervalRef.current);
      drawIntervalRef.current = null;
    }

    // 使用 Ref 获取最新的 participants
    let currentParticipants = [...participantsRef.current]; // 复制一份用于本地操作
    const winnersToProcess: {id: string, name: string}[] = [];
    
    // 决定本次抽多少人
    const countToDraw = Math.min(drawCount, currentParticipants.length);

    // 循环抽取
    for (let i = 0; i < countToDraw; i++) {
        let winnerId = '';
        let winnerName = '';

        const whitelistParticipants = currentParticipants.filter(p => p.isWhitelist);
        
        if (whitelistParticipants.length > 0) {
            const randomWhitelist = whitelistParticipants[Math.floor(Math.random() * whitelistParticipants.length)];
            winnerId = randomWhitelist.id;
            winnerName = randomWhitelist.name;
            console.log(`[白名单生效] 选中: ${winnerName}`);
        } else {
            const randomIndex = Math.floor(Math.random() * currentParticipants.length);
            const selected = currentParticipants[randomIndex];
            winnerId = selected.id;
            winnerName = selected.name;
            console.log(`[普通抽奖] 选中: ${winnerName}`);
        }

        if (winnerId) {
            winnersToProcess.push({ id: winnerId, name: winnerName });
            // 从临时池中移除，避免重复中奖
            currentParticipants = currentParticipants.filter(p => p.id !== winnerId);
        }
    }
    
    const finalWinnerNames = winnersToProcess.map(w => w.name).join('、');
    
    if (winnersToProcess.length > 0) {
      setCurrentDisplay(finalWinnerNames);
      // setCurrentWinnerId 仅用于单个中奖时的逻辑，这里取第一个或者忽略
      setCurrentWinnerId(winnersToProcess[0].id);
      
      // 播放中奖音效
      if (winAudioRef.current) {
        winAudioRef.current.currentTime = 0;
        winAudioRef.current.play().catch(e => console.warn('Audio play failed:', e));
      }

      // 触发烟花效果
      const duration = 3000;
      const end = Date.now() + duration;

      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#3370FF', '#34C724', '#F54A45', '#FF8800']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#3370FF', '#34C724', '#F54A45', '#FF8800']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());

      const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      
      try {
        // 并行处理所有中奖者的 API 调用
        const promises = winnersToProcess.map(winner => 
            fetch(`${API_BASE}/winners`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appId: config.appId,
                    appSecret: config.appSecret,
                    appToken: config.appToken,
                    tableId: config.tableId,
                    recordId: winner.id,
                    time: time,
                    fields: {
                        won: config.wonField,
                        time: config.timeField
                    }
                })
            }).then(res => res.json())
        );

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.success).length;

        if (successCount === winnersToProcess.length) {
          toast.success(`${finalWinnerNames} 已中奖！`);
        } else {
          console.warn(`部分中奖记录保存失败: ${successCount}/${winnersToProcess.length}`);
        }
      } catch (e) {
        console.warn('API不可用，仅在本地记录中奖');
        toast.success(`${finalWinnerNames} 已中奖！(演示模式)`);
      } finally {
        // 无论 API 成功与否，都更新本地状态
        const newWinners = winnersToProcess.map(w => ({ 
            id: w.id, 
            name: w.name, 
            time, 
            activityName: currentActivityName 
        }));
        
        setWinners(prev => [...newWinners, ...prev]);
        setParticipants(prev => prev.filter(p => !winnersToProcess.find(w => w.id === p.id)));
        setIsProcessing(false); // 解锁状态
      }
    } else {
        setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    if (!currentActivityName) return;
    if (!window.confirm(`确定要重置“${currentActivityName}”的所有中奖记录吗？\n\n此操作将：\n1. 清空当前活动的中奖列表\n2. 恢复所有中奖者的未中奖状态\n3. 允许他们再次参与抽奖`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/winners/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: config.appId,
          appSecret: config.appSecret,
          appToken: config.appToken,
          tableId: config.tableId,
          activityName: currentActivityName,
          activityField: config.activityField,
          wonField: config.wonField,
          timeField: config.timeField
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`已重置 ${data.count} 条记录`);
      } else {
        toast.error('重置失败: ' + data.message);
      }
    } catch (e) {
      console.warn('API不可用，重置本地状态');
      toast.success('已重置（演示模式）');
    }
    
    // 无论 API 成功与否，都重置本地状态
    setWinners([]); 
    setCurrentDisplay('');
    loadParticipants(); // 重新加载参与者（会触发 mock 加载）
    setLoading(false);
  };

  const exportWinners = () => {
    if (winners.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + "序号,姓名,时间\n"
      + winners.map((w, i) => `${winners.length - i},${w.name},${w.time}`).join('\n');
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `${currentActivityName || '抽奖'}_中奖名单.csv`;
    link.click();
  };

  useEffect(() => () => {
    if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
  }, []);

  const isLastWinner = currentDisplay && !isDrawing && winners.length > 0 && winners[0].name === currentDisplay.split('、')[0];

  const activityOptions = activities.map(act => ({
    value: act.name,
    label: act.name
  }));

  const handleContentClick = (e: React.MouseEvent) => {
    // 只有点击背景时才触发
    if (e.target === e.currentTarget && participants.length > 0 && !isProcessing) {
      if (isDrawing) {
        handleStop();
      } else {
        handleStart();
      }
    }
  };

  return (
    <Layout style={{ height: '100vh', background: 'var(--bg-body)' }}>
      <Content 
        className="raffle-container-soft"
        onClick={handleContentClick}
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          cursor: (participants.length > 0 && !isProcessing) ? 'pointer' : 'default',
          position: 'relative',
          userSelect: 'none',
          height: '100vh',
          width: '100vw'
        }}
      >
        {/* 标题 */}
        <div style={{ position: 'absolute', top: 40, left: 40, display: 'flex', alignItems: 'center' }}>
           <img 
             src="https://raw.githubusercontent.com/xjjm123123123/my_imge/main/img/Lark_Suite_logo_2022%201_%E5%89%AF%E6%9C%AC.png" 
             alt="飞书" 
             style={{ height: 40 }} 
           />
        </div>

        {/* 抽奖区域 */}
        <div className={isDrawing ? 'floating' : ''} style={{ transition: 'transform 0.3s', marginTop: -60 }}>
          <Card
            style={{
              width: 800,
              height: 480,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.08)'
            }}
            shadow="large"
          >
            <div 
              className={isDrawing ? 'rolling-text' : ''}
              style={{ 
                fontSize: 96, 
                fontWeight: 'bold', 
                letterSpacing: 4, 
                color: 'var(--text-title)',
              }}
            >
              {currentDisplay || '等待抽奖'}
            </div>
            
            {isLastWinner && (
              <div className="winner-reveal" style={{ position: 'absolute', top: 60, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--function-success-fill-hover)', padding: '10px 32px', borderRadius: 999, border: '1px solid var(--function-success-line-default)' }}>
                <span style={{ color: 'var(--function-success-content-default)', fontWeight: 600, fontSize: 24 }}>🎉 恭喜中奖 🎉</span>
              </div>
            )}
          </Card>
        </div>

        {/* 中央控制按钮 */}
        <div style={{ marginTop: 64, zIndex: 10 }} onClick={e => e.stopPropagation()}>
          <Button
            type="primary"
            size="extra-large"
            color={isDrawing ? 'danger' : 'primary'}
            icon={isDrawing ? <PauseFilled /> : <PlayFilled />}
            onClick={isDrawing ? handleStop : handleStart}
            disabled={participants.length === 0 || isProcessing}
            style={{ minWidth: 200, height: 64, fontSize: 24, borderRadius: 32 }}
          >
            {isDrawing ? (isProcessing ? '处理中...' : '停止') : '开始'}
          </Button>
        </div>

        {/* 底部功能栏 */}
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          height: 80, 
          background: 'rgba(255,255,255,0.85)', 
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          zIndex: 100
        }} onClick={e => e.stopPropagation()}>
           {/* 左侧：活动选择 */}
           <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
             <div style={{ width: 320, display: 'flex', alignItems: 'center', gap: 12 }}>
               <span style={{ fontSize: 14, color: 'var(--text-caption)', whiteSpace: 'nowrap' }}>当前活动</span>
               <Select 
                 style={{ width: '100%' }}
                 value={currentActivityName}
                 onChange={(val) => setCurrentActivityName(val as string)}
                 disabled={isDrawing || isProcessing}
                 options={activityOptions}
                 placeholder={loading ? '加载中...' : '暂无活动'}
               />
             </div>

             <div style={{ width: 180, display: 'flex', alignItems: 'center', gap: 12 }}>
               <span style={{ fontSize: 14, color: 'var(--text-caption)', whiteSpace: 'nowrap' }}>每次抽取</span>
               <Select 
                 style={{ width: '100%' }}
                 value={drawCount}
                 onChange={(val) => setDrawCount(val as number)}
                 disabled={isDrawing || isProcessing}
                 options={[
                     { label: '1人', value: 1 },
                     { label: '2人', value: 2 },
                     { label: '3人', value: 3 },
                     { label: '5人', value: 5 },
                     { label: '10人', value: 10 },
                 ]}
               />
             </div>
           </div>

           {/* 中间：空 */}
           <div></div>

           {/* 右侧：管理按钮 */}
           <Space size="medium">
             <Button type="primary" color="danger" icon={<DeleteOutlined />} onClick={handleReset} disabled={isDrawing || isProcessing}>重置记录</Button>
           </Space>
        </div>
      </Content>
    </Layout>
  );
}
