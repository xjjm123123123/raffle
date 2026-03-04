/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trophy, Users, Download, Trash2, Play, Square, ChevronDown } from 'lucide-react';

type Activity = { id: string; name: string };
type Winner = { id: string; activityId: string; name: string; time: string };

export default function App() {
  const [activities] = useState<Activity[]>([
    { id: '1', name: '2026 年会特等奖' },
    { id: '2', name: '2026 年会一等奖' },
    { id: '3', name: '2026 年会二等奖' },
    { id: '4', name: '阳光普照奖' },
  ]);
  const [currentActivityId, setCurrentActivityId] = useState<string>('1');
  const [participantsText, setParticipantsText] = useState<string>('张三\n李四\n王五\n赵六\n钱七\n孙八\n周九\n吴十\n郑十一\n王十二');
  const [winners, setWinners] = useState<Winner[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDisplay, setCurrentDisplay] = useState<string>('');
  
  const drawIntervalRef = useRef<number | null>(null);

  const participantsList = useMemo(() => {
    return participantsText.split('\n').map(s => s.trim()).filter(Boolean);
  }, [participantsText]);

  const currentActivityWinners = useMemo(() => {
    return winners.filter(w => w.activityId === currentActivityId).reverse();
  }, [winners, currentActivityId]);

  const handleStart = () => {
    if (participantsList.length === 0) return;
    setIsDrawing(true);
    
    if (participantsList.length === 1) {
      setCurrentDisplay(participantsList[0]);
    }

    drawIntervalRef.current = window.setInterval(() => {
      setCurrentDisplay(prev => {
        if (participantsList.length <= 1) return participantsList[0] || '';
        let nextName;
        do {
          const randomIndex = Math.floor(Math.random() * participantsList.length);
          nextName = participantsList[randomIndex];
        } while (nextName === prev);
        return nextName;
      });
    }, 50);
  };

  const handleStop = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (drawIntervalRef.current !== null) {
      clearInterval(drawIntervalRef.current);
      drawIntervalRef.current = null;
    }

    // Capture the final displayed name as the winner
    setCurrentDisplay(finalName => {
      if (finalName) {
        const newWinner: Winner = {
          id: Math.random().toString(36).substring(2, 9),
          activityId: currentActivityId,
          name: finalName,
          time: new Date().toLocaleTimeString('zh-CN', { hour12: false })
        };
        setWinners(prev => [...prev, newWinner]);
        
        // Remove winner from participants list
        setParticipantsText(prevText => {
          const list = prevText.split('\n').map(s => s.trim()).filter(Boolean);
          const newList = list.filter(name => name !== finalName);
          return newList.join('\n');
        });
      }
      return finalName;
    });
  };

  const exportWinners = () => {
    if (currentActivityWinners.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + "序号,姓名,时间\n"
      + currentActivityWinners.map((w, i) => `${currentActivityWinners.length - i},${w.name},${w.time}`).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const actName = activities.find(a => a.id === currentActivityId)?.name || '抽奖';
    link.setAttribute("download", `${actName}_中奖名单.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearWinners = () => {
    if (window.confirm('确定要清空当前活动的中奖记录吗？')) {
      setWinners(prev => prev.filter(w => w.activityId !== currentActivityId));
    }
  };

  useEffect(() => {
    return () => {
      if (drawIntervalRef.current !== null) {
        clearInterval(drawIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="h-screen w-full flex bg-feishu-bg text-feishu-text-main font-sans overflow-hidden">
      {/* Left Sidebar: Config */}
      <div className="w-80 bg-white border-r border-feishu-border flex flex-col h-full shadow-[1px_0_4px_rgba(0,0,0,0.02)] z-10">
        <div className="p-5 border-b border-feishu-border">
          <h1 className="text-lg font-semibold text-feishu-text-main flex items-center gap-2">
            <Trophy className="w-5 h-5 text-feishu-blue" />
            抽奖系统
          </h1>
        </div>
        
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-6">
          {/* Activity Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-feishu-text-main">活动选择</label>
            <div className="relative">
              <select 
                className="w-full appearance-none bg-white border border-feishu-border rounded-md px-3 py-2 text-sm text-feishu-text-main focus:outline-none focus:border-feishu-blue focus:ring-1 focus:ring-feishu-blue transition-colors cursor-pointer"
                value={currentActivityId}
                onChange={(e) => setCurrentActivityId(e.target.value)}
                disabled={isDrawing}
              >
                {activities.map(act => (
                  <option key={act.id} value={act.id}>{act.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-feishu-text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Participants */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-feishu-text-main flex items-center gap-1.5">
                <Users className="w-4 h-4 text-feishu-text-secondary" />
                参与名单
              </label>
              <span className="text-xs text-feishu-text-secondary bg-feishu-bg px-2 py-0.5 rounded-full border border-feishu-border">
                共 {participantsList.length} 人
              </span>
            </div>
            <textarea 
              className="w-full flex-1 min-h-[200px] resize-none border border-feishu-border rounded-md p-3 text-sm text-feishu-text-main focus:outline-none focus:border-feishu-blue focus:ring-1 focus:ring-feishu-blue transition-colors leading-relaxed"
              placeholder="请输入参与者名单，每行一个名字..."
              value={participantsText}
              onChange={(e) => setParticipantsText(e.target.value)}
              disabled={isDrawing}
            />
          </div>
        </div>
      </div>

      {/* Center: Draw Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="w-[640px] h-[400px] bg-white rounded-2xl border border-feishu-border shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center relative overflow-hidden transition-all">
          <div className="text-[64px] font-bold text-feishu-text-main tracking-wider select-none">
            {currentDisplay || "等待抽奖"}
          </div>
          
          {currentDisplay && !isDrawing && winners.length > 0 && winners[winners.length - 1].name === currentDisplay && (
            <div className="absolute top-10 text-feishu-green font-medium text-lg animate-fade-in flex items-center gap-2 bg-green-50 px-4 py-1.5 rounded-full border border-green-100">
              🎉 恭喜中奖 🎉
            </div>
          )}
        </div>

        <div className="mt-12">
          <button 
            className={`flex items-center gap-2 px-10 py-4 rounded-md text-lg font-medium transition-all duration-200 ${
              isDrawing 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_4px_12px_rgba(239,68,68,0.2)] active:scale-95' 
                : 'bg-feishu-blue hover:bg-feishu-blue-hover text-white shadow-[0_4px_12px_rgba(51,112,255,0.2)] active:scale-95'
            } ${participantsList.length === 0 ? 'opacity-50 cursor-not-allowed shadow-none hover:bg-feishu-blue' : ''}`}
            onClick={isDrawing ? handleStop : handleStart}
            disabled={participantsList.length === 0}
          >
            {isDrawing ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                停止滚动
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                开始抽奖
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Sidebar: Winners */}
      <div className="w-80 bg-white border-l border-feishu-border flex flex-col h-full shadow-[-1px_0_4px_rgba(0,0,0,0.02)] z-10">
        <div className="p-5 border-b border-feishu-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-feishu-text-main">中奖记录</h2>
          <div className="flex gap-1.5">
            <button 
              onClick={exportWinners}
              className="p-1.5 text-feishu-text-secondary hover:text-feishu-blue hover:bg-blue-50 rounded-md transition-colors"
              title="导出名单"
            >
              <Download className="w-4 h-4" />
            </button>
            <button 
              onClick={clearWinners}
              className="p-1.5 text-feishu-text-secondary hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
              title="清空记录"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {currentActivityWinners.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-feishu-text-secondary text-sm">
              暂无中奖记录
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {currentActivityWinners.map((winner, idx) => (
                <div key={winner.id} className="flex items-center justify-between p-3 bg-feishu-bg rounded-md border border-transparent hover:border-feishu-border transition-colors animate-fade-in">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-feishu-text-secondary w-5 text-center bg-white rounded-sm py-0.5 border border-feishu-border">
                      {currentActivityWinners.length - idx}
                    </span>
                    <span className="text-sm font-medium text-feishu-text-main">
                      {winner.name}
                    </span>
                  </div>
                  <span className="text-xs text-feishu-text-secondary font-mono">
                    {winner.time}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
