import React, { useState, useEffect } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { useUsage } from '../contexts/UsageContext';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/Card';
import { Task, TaskStatus, TaskPriority } from '../types';
import { Calendar, Filter, CheckCircle, Circle, RefreshCw, AlertTriangle, ShieldAlert, Clock, Crown, ChevronLeft, ChevronRight, List, Grid, Cloud, Bot, Trash2, X, LayoutDashboard } from 'lucide-react';
import AIAvatar from '../components/AIAvatar';
import { format, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Tasks = () => {
  const { tasks, updateTask, syncGoogleCalendar, syncStatus, refreshTasks, deleteTasks, clearTasks, reorderTasks } = useTasks();
  const { isPro } = useUsage();
  const { user } = useAuth();
  const theme = user?.aiSettings?.theme || 'dark';
  
  // Helper to determine if custom color is light
  const isCustomLight = () => {
      if (theme !== 'custom' || !user?.aiSettings?.customThemeColor) return false;
      const hex = user.aiSettings.customThemeColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return brightness > 155;
  };

  const isLightTheme = theme === 'nature' || theme === 'ocean' || theme === 'sunset' || theme === 'ladies' || theme === 'white' || isCustomLight();
  const isCustomTheme = theme === 'custom';
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'week' | 'month' | 'board'>('list');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Filters state
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'All'>('All');

  // Real-time clock effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayName = format(selectedDate, 'EEEE');

  const filteredTasks = React.useMemo(() => tasks.filter(task => {
      const dateMatch = task.date ? (task.date === selectedDateStr) : (task.day === selectedDayName);
      if (!dateMatch) return false;
      if (statusFilter !== 'All' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && task.priority !== priorityFilter) return false;
      return true;
  }), [tasks, selectedDateStr, selectedDayName, statusFilter, priorityFilter]);

  const toggleStatus = (id: string, currentStatus: TaskStatus) => {
      const newStatus = currentStatus === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED;
      updateTask(id, { status: newStatus });
  }

  const onDragEnd = (result: DropResult) => {
      const { source, destination, draggableId } = result;

      if (!destination) return;

      if (source.droppableId === destination.droppableId && source.index === destination.index) {
          return;
      }

      const taskToMove = tasks.find(t => t.id === draggableId);
      if (!taskToMove) return;

      if (source.droppableId === destination.droppableId) {
          const listToReorder = source.droppableId === 'list-view' 
              ? filteredTasks 
              : filteredTasks.filter(t => t.status === source.droppableId);
              
          const reorderedFiltered = Array.from(listToReorder);
          const [removed] = reorderedFiltered.splice(source.index, 1);
          reorderedFiltered.splice(destination.index, 0, removed);

          const newTasks = Array.from(tasks);
          const oldIndexInMain = newTasks.findIndex(t => t.id === draggableId);
          newTasks.splice(oldIndexInMain, 1);

          const taskAfter = reorderedFiltered[destination.index + 1];
          if (taskAfter) {
              const insertIndex = newTasks.findIndex(t => t.id === taskAfter.id);
              newTasks.splice(insertIndex, 0, taskToMove);
          } else {
              const lastTask = reorderedFiltered[destination.index - 1];
              if (lastTask) {
                  const insertIndex = newTasks.findIndex(t => t.id === lastTask.id);
                  newTasks.splice(insertIndex + 1, 0, taskToMove);
              } else {
                  newTasks.push(taskToMove);
              }
          }
          reorderTasks(newTasks);
      } else {
          const newStatus = destination.droppableId as TaskStatus;
          const taskToMoveUpdated = { ...taskToMove, status: newStatus };
          const destList = filteredTasks.filter(t => t.status === newStatus);
          
          const reorderedDest = Array.from(destList);
          reorderedDest.splice(destination.index, 0, taskToMoveUpdated);
          
          const newTasks = Array.from(tasks);
          const oldIndexInMain = newTasks.findIndex(t => t.id === draggableId);
          newTasks.splice(oldIndexInMain, 1);
          
          const taskAfter = reorderedDest[destination.index + 1];
          if (taskAfter) {
              const insertIndex = newTasks.findIndex(t => t.id === taskAfter.id);
              newTasks.splice(insertIndex, 0, taskToMoveUpdated);
          } else {
              const lastTask = reorderedDest[destination.index - 1];
              if (lastTask) {
                  const insertIndex = newTasks.findIndex(t => t.id === lastTask.id);
                  newTasks.splice(insertIndex + 1, 0, taskToMoveUpdated);
              } else {
                  newTasks.push(taskToMoveUpdated);
              }
          }
          reorderTasks(newTasks);
      }
  };

  // Generate week dates for the calendar header
  const startOfCurrentWeek = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDates = React.useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(startOfCurrentWeek, i)), [startOfCurrentWeek]);

  // Generate month dates for the calendar view
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const monthDates = React.useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);
  const startDayOfWeek = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1; // 0 = Monday

  return (
    <DragDropContext onDragEnd={onDragEnd}>
    <div className="space-y-6 h-full flex flex-col">
      
      {/* Live Date & Time Display */}
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 rounded-[2rem] shadow-2xl flex justify-between items-center relative overflow-hidden text-white backdrop-blur-md animate-slide-up">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white opacity-20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-white opacity-10 rounded-full blur-[60px] translate-y-1/3 -translate-x-1/4"></div>
          
          <div className="z-10">
              <h2 className="text-3xl font-black tracking-tight flex items-center gap-2 drop-shadow-md">
                {format(currentTime, 'EEEE')}
                {isPro && <Crown size={22} className="text-yellow-300 drop-shadow animate-float" />}
              </h2>
              <p className="text-sm opacity-90 mt-1.5 font-medium drop-shadow-sm tracking-wide">{format(currentTime, 'MMMM do, yyyy')}</p>
          </div>
          <div className="z-10 text-right">
              <div className="flex items-center gap-2 justify-end text-white/90 mb-1 drop-shadow-sm">
                  <Clock size={14} className="animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded-full border border-white/10">Live Time</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tabular-nums leading-none drop-shadow-lg tracking-tighter">
                  {format(currentTime, 'HH:mm:ss')}
              </h1>
          </div>
      </div>

      <div className="flex justify-between items-center animate-slide-up" style={{animationDelay: '0.1s'}}>
        <h1 className="text-3xl font-black tracking-tight text-current drop-shadow-sm">My Schedule</h1>
        <div className="flex gap-2">
            <button 
                onClick={refreshTasks}
                className="p-2 sm:px-4 sm:py-2.5 rounded-xl bg-tt-blue/10 hover:bg-tt-blue/20 transition-colors text-tt-blue flex items-center gap-2 text-sm font-bold shadow-sm"
                title="Refresh Timetable"
            >
                <RefreshCw size={18} className={syncStatus === 'saving' ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="h-10 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>
            <button 
                onClick={() => setViewMode(viewMode === 'list' ? 'board' : viewMode === 'board' ? 'week' : viewMode === 'week' ? 'month' : 'list')}
                className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors shadow-sm"
                title="Toggle View"
            >
                {viewMode === 'list' ? <LayoutDashboard size={20} className="text-current" /> : viewMode === 'board' ? <Grid size={20} className="text-current" /> : viewMode === 'week' ? <Calendar size={20} className="text-current" /> : <List size={20} className="text-current" />}
            </button>
            <button 
                onClick={() => setSelectedDate(viewMode === 'list' ? addDays(selectedDate, -7) : addDays(selectedDate, -30))}
                className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors shadow-sm"
                title="Previous"
            >
                <ChevronLeft size={20} className="text-current" />
            </button>
            <button 
                onClick={() => setSelectedDate(viewMode === 'list' ? addDays(selectedDate, 7) : addDays(selectedDate, 30))}
                className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors shadow-sm"
                title="Next"
            >
                <ChevronRight size={20} className="text-current" />
            </button>
            <div className="h-10 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>
            <button 
                onClick={() => {
                    if (!isPro) {
                        alert("Upgrade to Pro to use AI Timetable Generation!");
                    } else {
                        navigate('/generate');
                    }
                }}
                className="p-2 w-10 h-10 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors shadow-sm border border-purple-500/10"
                title="AI Generate Timetable"
            >
                <AIAvatar imageUrl={user?.aiSettings?.aiAvatarUrl} type={user?.aiSettings?.aiAvatarType} isLightTheme={isLightTheme} className="w-full h-full text-purple-500" />
            </button>
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2.5 rounded-xl transition-colors shadow-sm ${showFilters ? 'bg-tt-blue text-white shadow-tt-blue/30' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-current'}`}
                title="Filter Tasks"
            >
                <Filter size={20} />
            </button>
            <button 
                onClick={() => {
                    if (isSelectionMode) {
                        setIsSelectionMode(false);
                        setSelectedTaskIds([]);
                    } else {
                        setIsSelectionMode(true);
                    }
                }}
                className={`p-2.5 rounded-xl transition-colors shadow-sm ${isSelectionMode ? 'bg-tt-red text-white shadow-tt-red/30' : 'bg-black/5 dark:bg-white/5 hover:bg-tt-red/10 hover:text-tt-red text-current'}`}
                title={isSelectionMode ? "Cancel Selection" : "Manage Tasks"}
            >
                {isSelectionMode ? <X size={20} /> : <Trash2 size={20} />}
            </button>
        </div>
      </div>

      {showFilters && (
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-top-2 ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800/50 border-gray-700'}`}>
              <div className="flex-1">
                  <label className="block text-xs font-bold mb-2 opacity-70 uppercase tracking-wider">Status</label>
                  <div className="flex flex-wrap gap-2">
                      <button
                          onClick={() => setStatusFilter('All')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${statusFilter === 'All' ? 'bg-tt-blue text-white' : 'bg-black/10 hover:bg-black/20'}`}
                      >
                          All
                      </button>
                      {Object.values(TaskStatus).map(status => (
                          <button
                              key={status}
                              onClick={() => setStatusFilter(status)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${statusFilter === status ? 'bg-tt-blue text-white' : 'bg-black/10 hover:bg-black/20'}`}
                          >
                              {status}
                          </button>
                      ))}
                  </div>
              </div>
              <div className="flex-1">
                  <label className="block text-xs font-bold mb-2 opacity-70 uppercase tracking-wider">Priority</label>
                  <div className="flex flex-wrap gap-2">
                      <button
                          onClick={() => setPriorityFilter('All')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${priorityFilter === 'All' ? 'bg-tt-blue text-white' : 'bg-black/10 hover:bg-black/20'}`}
                      >
                          All
                      </button>
                      {Object.values(TaskPriority).map(priority => (
                          <button
                              key={priority}
                              onClick={() => setPriorityFilter(priority)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${priorityFilter === priority ? 'bg-tt-blue text-white' : 'bg-black/10 hover:bg-black/20'}`}
                          >
                              {priority}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {isSelectionMode && (
          <div className="flex justify-between items-center bg-tt-red/5 border border-tt-red/20 p-3 rounded-xl animate-in fade-in slide-in-from-top-2">
              <span className="text-sm font-bold text-tt-red">
                  {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                  <button 
                      onClick={() => {
                          const completedIds = tasks.filter(t => t.status === TaskStatus.COMPLETED).map(t => t.id);
                          if (completedIds.length === 0) {
                              alert("No completed tasks to delete.");
                              return;
                          }
                          if (window.confirm(`Are you sure you want to permanently delete ${completedIds.length} completed task(s)?`)) {
                              deleteTasks(completedIds);
                              setIsSelectionMode(false);
                              setSelectedTaskIds([]);
                          }
                      }}
                      className={`px-3 py-1.5 text-xs font-bold ${isLightTheme ? 'bg-white' : 'bg-gray-800'} border border-tt-red/30 text-tt-red rounded-lg hover:bg-tt-red/10 transition-colors`}
                  >
                      Delete Completed
                  </button>
                  <button 
                      onClick={() => {
                          if (window.confirm('Are you sure you want to clear ALL tasks? This cannot be undone.')) {
                              clearTasks();
                              setIsSelectionMode(false);
                              setSelectedTaskIds([]);
                          }
                      }}
                      className={`px-3 py-1.5 text-xs font-bold ${isLightTheme ? 'bg-white' : 'bg-gray-800'} border border-tt-red/30 text-tt-red rounded-lg hover:bg-tt-red/10 transition-colors`}
                  >
                      Clear All Tasks
                  </button>
                  <button 
                      onClick={() => {
                          if (selectedTaskIds.length === 0) return;
                          if (window.confirm(`Are you sure you want to clear ${selectedTaskIds.length} selected task(s)?`)) {
                              deleteTasks(selectedTaskIds);
                              setIsSelectionMode(false);
                              setSelectedTaskIds([]);
                          }
                      }}
                      disabled={selectedTaskIds.length === 0}
                      className="px-3 py-1.5 text-xs font-bold bg-tt-red text-white rounded-lg hover:bg-tt-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      Clear Selected
                  </button>
              </div>
          </div>
      )}

      {viewMode === 'list' ? (
          <>
            {/* Week Calendar Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {weekDates.map((date) => {
              const dayName = format(date, 'EEEE');
              const isSelected = isSameDay(selectedDate, date);
              const isToday = isSameDay(date, new Date());
              
              const dayTasks = tasks.filter(t => {
                  if (t.date) return t.date === format(date, 'yyyy-MM-dd');
                  return t.day === dayName;
              });
              const taskCount = dayTasks.length;
              
              return (
                <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={`flex flex-col items-center min-w-[60px] p-3 rounded-2xl transition-all duration-300 border ${
                        isSelected 
                        ? 'bg-gradient-to-br from-[#1E90FF] to-[#2ECC71] border-transparent text-white shadow-lg shadow-blue-500/30 scale-105' 
                        : isToday
                        ? `${isLightTheme ? 'bg-white text-gray-900 hover:bg-gray-50' : 'bg-gray-800 text-white hover:bg-gray-700'} border-[#2ECC71] shadow-md shadow-green-500/20`
                        : `${isLightTheme ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white hover:border-gray-600'} hover:shadow-sm`
                    }`}
                >
                    <span className="text-xs font-bold mb-1 uppercase tracking-wider">{format(date, 'EEE')}</span>
                    <span className={`text-lg font-black ${isToday && !isSelected ? 'text-[#2ECC71]' : ''}`}>{format(date, 'd')}</span>
                    {taskCount > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full mt-1 ${
                            isSelected ? 'bg-white' : 
                            taskCount >= 3 ? 'bg-tt-red' : 'bg-[#2ECC71]'
                        }`}></span>
                    )}
                </button>
              )
          })}
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-20">
          <div className="flex justify-between items-end mb-2">
              <h3 className="opacity-70 text-sm uppercase font-bold tracking-wider">{selectedDayName}'s Tasks</h3>
              <span className="text-xs opacity-60">{filteredTasks.length} tasks</span>
          </div>

          <Droppable droppableId="list-view">
              {(provided) => (
                  <div 
                      {...provided.droppableProps} 
                      ref={provided.innerRef}
                      className="space-y-3 min-h-[100px]"
                  >
                      {filteredTasks.length > 0 ? (
                          filteredTasks.map((task, index) => {
                            const needsReview = task.validationStatus === 'needs_review';
                            const forced = task.validationStatus === 'user_override';
                            
                            return (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided, snapshot) => (
                                <div 
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`flex gap-4 items-start group relative overflow-hidden p-5 rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-md
                                        ${isLightTheme ? 'bg-white border-gray-200 hover:border-gray-300' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}
                                        ${task.status === TaskStatus.COMPLETED ? (isLightTheme ? 'opacity-60 bg-gray-50' : 'opacity-60 bg-gray-900') : ''}
                                        ${task.status === TaskStatus.MISSED ? (isLightTheme ? 'border-l-4 border-l-red-500 bg-red-50/50' : 'border-l-4 border-l-red-500 bg-red-500/10') : ''}
                                        ${needsReview ? 'border-l-4 border-l-yellow-500' : ''}
                                        ${forced ? 'border-l-4 border-l-orange-500' : ''}
                                        ${isSelectionMode && selectedTaskIds.includes(task.id) ? 'ring-2 ring-tt-red border-transparent' : ''}
                                        ${snapshot.isDragging ? 'shadow-2xl scale-[1.02] z-50 ring-2 ring-[#1E90FF]' : ''}
                                    `}
                                    onClick={() => {
                                        if (isSelectionMode) {
                                            setSelectedTaskIds(prev => 
                                                prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id]
                                            );
                                        }
                                    }}
                                >
                                    {isSelectionMode && (
                                        <div className="mt-1 shrink-0 flex items-center justify-center w-6 h-6 rounded-md border-2 border-gray-300 transition-colors">
                                            {selectedTaskIds.includes(task.id) && <CheckCircle size={16} className="text-tt-red" />}
                                        </div>
                                    )}
                                    {!isSelectionMode && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleStatus(task.id, task.status); }}
                                            className="mt-1 shrink-0 text-gray-400 hover:text-[#2ECC71] transition-colors"
                                        >
                                            {task.status === TaskStatus.COMPLETED ? <CheckCircle className="text-[#2ECC71]" /> : task.status === TaskStatus.MISSED ? <AlertTriangle className="text-red-500" /> : <Circle />}
                                        </button>
                                    )}
                                    
                                    <div className="flex-1 cursor-pointer" onClick={(e) => {
                                        if (isSelectionMode) return; // Handled by parent div
                                        alert(`Details:\n${task.description || 'No description'}\nVenue: ${task.venue}`);
                                    }}>
                                        <div className="flex justify-between items-start">
                                            <h4 className={`font-bold text-lg ${task.status === TaskStatus.COMPLETED ? 'line-through text-gray-500' : task.status === TaskStatus.MISSED ? (isLightTheme ? 'text-red-700' : 'text-red-400') : (isLightTheme ? 'text-gray-900' : 'text-white')}`}>
                                                {task.title}
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2.5 py-1 rounded-full font-bold shadow-sm ${
                                                    (task.priority === TaskPriority.HIGH || task.priority === TaskPriority.URGENT) ? 'bg-[#FF4D4D]/10 text-[#FF4D4D] border border-[#FF4D4D]/20' : 
                                                    (task.priority === TaskPriority.MEDIUM || task.priority === TaskPriority.IMPORTANT) ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' : 
                                                    'bg-[#1E90FF]/10 text-[#1E90FF] border border-[#1E90FF]/20'
                                                }`}>
                                                    {task.priority}
                                                </span>
                                                {!isSelectionMode && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setTaskToDelete(task);
                                                        }}
                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                        title="Delete Task"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className={`flex items-center gap-3 mt-2 text-sm font-medium ${isLightTheme ? 'text-gray-600' : 'text-gray-400'}`}>
                                            <span className="font-mono text-[#1E90FF] bg-[#1E90FF]/10 px-2 py-0.5 rounded-md">{task.time}</span>
                                            <span>•</span>
                                            <span>{task.durationMinutes} min</span>
                                            <span>•</span>
                                            <span className="truncate">{task.venue}</span>
                                        </div>

                                        {/* Validation Flags */}
                                        <div className="flex gap-2 mt-3">
                                            {needsReview && (
                                                <div className="text-xs flex items-center gap-1 text-yellow-600 font-bold bg-yellow-50 px-2 py-1 rounded-md">
                                                    <AlertTriangle size={12} /> Review Required
                                                </div>
                                            )}
                                            {forced && (
                                                <div className="text-xs flex items-center gap-1 text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded-md" title="You uploaded this despite warnings">
                                                    <ShieldAlert size={12} /> Forced Upload
                                                </div>
                                            )}
                                            {task.isGoogleEvent && (
                                                <div className="text-xs flex items-center gap-1 text-[#1E90FF] font-bold bg-[#1E90FF]/10 px-2 py-1 rounded-md">
                                                    <RefreshCw size={10} /> Google Calendar
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                )}
                            </Draggable>
                            )})
                      ) : (
                          <div className="flex flex-col items-center justify-center h-64 opacity-60">
                              <Calendar size={48} className="mb-4 opacity-20" />
                              <p>No tasks scheduled for {selectedDayName}.</p>
                              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/add'); }} className="mt-4 text-tt-blue hover:opacity-80 transition-opacity text-sm relative z-10 pointer-events-auto px-4 py-2 bg-tt-blue/10 rounded-lg font-medium">Add a task manually</button>
                          </div>
                      )}
                      {provided.placeholder}
                  </div>
              )}
          </Droppable>
      </div>
          </>
      ) : viewMode === 'board' ? (
          <div className="flex-1 overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max h-full">
                  {Object.values(TaskStatus).map(status => {
                      const statusTasks = filteredTasks.filter(t => t.status === status);
                      return (
                          <div key={status} className={`w-80 flex flex-col rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 ${isLightTheme ? 'bg-gray-50 border-gray-200' : 'bg-gray-900 border-gray-800'}`}>
                              <div className={`p-4 border-b flex justify-between items-center ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                                  <h3 className="font-bold uppercase tracking-wider text-sm">{status}</h3>
                                  <span className="text-xs font-mono bg-black/10 px-2 py-1 rounded-full">{statusTasks.length}</span>
                              </div>
                              <Droppable droppableId={status}>
                                  {(provided, snapshot) => (
                                      <div 
                                          {...provided.droppableProps}
                                          ref={provided.innerRef}
                                          className={`flex-1 p-3 overflow-y-auto space-y-3 transition-colors min-h-[150px] ${snapshot.isDraggingOver ? (isLightTheme ? 'bg-blue-50/50' : 'bg-blue-900/20') : ''}`}
                                      >
                                          {statusTasks.map((task, index) => (
                                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                                  {(provided, snapshot) => (
                                                      <div
                                                          ref={provided.innerRef}
                                                          {...provided.draggableProps}
                                                          {...provided.dragHandleProps}
                                                          className={`p-4 rounded-xl border shadow-sm transition-all relative group
                                                              ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'} 
                                                              ${task.status === TaskStatus.COMPLETED ? (isLightTheme ? 'opacity-60 bg-gray-50' : 'opacity-60 bg-gray-900') : ''}
                                                              ${task.status === TaskStatus.MISSED ? (isLightTheme ? 'border-l-4 border-l-red-500 bg-red-50/50' : 'border-l-4 border-l-red-500 bg-red-500/10') : ''}
                                                              ${isSelectionMode && selectedTaskIds.includes(task.id) ? 'ring-2 ring-tt-red border-transparent' : ''}
                                                              ${snapshot.isDragging ? 'shadow-xl scale-105 ring-2 ring-[#1E90FF] z-50' : 'hover:shadow-md'}
                                                          `}
                                                          onClick={() => {
                                                              if (isSelectionMode) {
                                                                  setSelectedTaskIds(prev => 
                                                                      prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id]
                                                                  );
                                                              } else {
                                                                  alert(`Details:\n${task.description || 'No description'}\nVenue: ${task.venue}`);
                                                              }
                                                          }}
                                                      >
                                                          {isSelectionMode && (
                                                              <div className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded border border-current bg-white/50 z-10">
                                                                  {selectedTaskIds.includes(task.id) && <CheckCircle size={14} className="text-tt-red" />}
                                                              </div>
                                                          )}
                                                          {!isSelectionMode && (
                                                              <button 
                                                                  onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      setTaskToDelete(task);
                                                                  }}
                                                                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100 z-10 bg-white/80 dark:bg-gray-800/80 rounded-full"
                                                                  title="Delete Task"
                                                              >
                                                                  <Trash2 size={14} />
                                                              </button>
                                                          )}
                                                          <div className="flex justify-between items-start mb-2 pr-6">
                                                              <h4 className={`font-bold text-sm ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>{task.title}</h4>
                                                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                                  (task.priority === TaskPriority.HIGH || task.priority === TaskPriority.URGENT) ? 'bg-red-100 text-red-600' : 
                                                                  (task.priority === TaskPriority.MEDIUM || task.priority === TaskPriority.IMPORTANT) ? 'bg-yellow-100 text-yellow-700' : 
                                                                  'bg-blue-100 text-blue-600'
                                                              }`}>
                                                                  {task.priority}
                                                              </span>
                                                          </div>
                                                          <div className={`text-xs font-mono ${isLightTheme ? 'text-gray-500' : 'text-gray-400'}`}>{task.time} • {task.durationMinutes}m</div>
                                                          <div className="flex flex-wrap gap-1 mt-2">
                                                              {task.validationStatus === 'needs_review' && (
                                                                  <div className="text-[10px] flex items-center gap-1 text-yellow-600 font-bold bg-yellow-50 px-1.5 py-0.5 rounded">
                                                                      <AlertTriangle size={10} /> Review
                                                                  </div>
                                                              )}
                                                              {task.validationStatus === 'user_override' && (
                                                                  <div className="text-[10px] flex items-center gap-1 text-orange-500 font-bold bg-orange-50 px-1.5 py-0.5 rounded">
                                                                      <ShieldAlert size={10} /> Forced
                                                                  </div>
                                                              )}
                                                              {task.isGoogleEvent && (
                                                                  <div className="text-[10px] flex items-center gap-1 text-[#1E90FF] font-bold bg-[#1E90FF]/10 px-1.5 py-0.5 rounded">
                                                                      <RefreshCw size={8} /> GCal
                                                                  </div>
                                                              )}
                                                          </div>
                                                      </div>
                                                  )}
                                              </Draggable>
                                          ))}
                                          {provided.placeholder}
                                      </div>
                                  )}
                              </Droppable>
                          </div>
                      );
                  })}
              </div>
          </div>
      ) : viewMode === 'week' ? (
          <div className="flex-1 overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max h-full">
                  {weekDates.map(date => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const dayName = format(date, 'EEEE');
                      const dayTasks = tasks.filter(t => {
                          const dateMatch = t.date === dateStr || (!t.date && t.day === dayName);
                          if (!dateMatch) return false;
                          if (statusFilter !== 'All' && t.status !== statusFilter) return false;
                          if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
                          return true;
                      }).sort((a, b) => a.time.localeCompare(b.time));
                      const isToday = isSameDay(date, new Date());

                      return (
                          <div key={date.toISOString()} className={`w-64 flex flex-col rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md duration-300 ${isLightTheme ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                              <div className={`p-3 text-center border-b relative ${isToday ? 'bg-gradient-to-r from-[#1E90FF] to-[#2ECC71] text-white border-transparent' : (isLightTheme ? 'bg-gray-50 text-gray-700 border-gray-200' : 'bg-gray-900 text-gray-300 border-gray-700')}`}>
                                  <div className="text-xs font-bold uppercase tracking-wider">{format(date, 'EEEE')}</div>
                                  <div className="text-xl font-black">{format(date, 'd MMM')}</div>
                                  {dayTasks.length > 0 && (
                                      <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                                          dayTasks.length >= 3 ? 'bg-tt-red' : 'bg-[#2ECC71]'
                                      }`}></div>
                                  )}
                              </div>
                              <div className={`flex-1 p-2 overflow-y-auto space-y-2 ${isLightTheme ? 'bg-white' : 'bg-gray-800'}`}>
                                  {dayTasks.map(task => (
                                      <div 
                                          key={task.id} 
                                          onClick={() => {
                                              if (isSelectionMode) {
                                                  setSelectedTaskIds(prev => 
                                                      prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id]
                                                  );
                                              }
                                          }}
                                          className={`p-3 rounded-xl text-sm border transition-all hover:scale-[1.02] relative ${
                                          (task.priority === TaskPriority.HIGH || task.priority === TaskPriority.URGENT) ? 'bg-[#FF4D4D]/10 border-[#FF4D4D]/20 text-[#FF4D4D]' : 
                                          (task.priority === TaskPriority.MEDIUM || task.priority === TaskPriority.IMPORTANT) ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700' : 
                                          'bg-[#1E90FF]/10 border-[#1E90FF]/20 text-[#1E90FF]'
                                      } ${isSelectionMode && selectedTaskIds.includes(task.id) ? 'ring-2 ring-tt-red border-transparent' : ''}`}>
                                          {isSelectionMode && (
                                              <div className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded border border-current bg-white/50">
                                                  {selectedTaskIds.includes(task.id) && <CheckCircle size={14} className="text-tt-red" />}
                                              </div>
                                          )}
                                          {!isSelectionMode && (
                                              <button 
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      setTaskToDelete(task);
                                                  }}
                                                  className="absolute top-2 right-2 text-current opacity-50 hover:opacity-100 transition-opacity p-1"
                                                  title="Delete Task"
                                              >
                                                  <Trash2 size={14} />
                                              </button>
                                          )}
                                          <div className={`font-bold truncate ${isSelectionMode || !isSelectionMode ? 'pr-6' : ''}`}>{task.title}</div>
                                          <div className="text-xs opacity-80 flex justify-between mt-1 font-medium">
                                              <span>{task.time}</span>
                                              <span className="truncate max-w-[80px] text-right">{task.venue}</span>
                                          </div>
                                      </div>
                                  ))}
                                  {dayTasks.length === 0 && (
                                      <div className="text-center text-xs text-gray-400 py-4 font-medium">No tasks scheduled</div>
                                  )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      ) : (
          <div className={`flex-1 rounded-2xl border shadow-sm p-4 overflow-y-auto ${isLightTheme ? 'bg-white border-gray-200 text-gray-800' : 'bg-gray-800 border-gray-700 text-gray-200'}`}>
              <h3 className={`text-xl font-black mb-4 text-center ${isLightTheme ? 'text-gray-900' : 'text-white'}`}>{format(selectedDate, 'MMMM yyyy')}</h3>
              <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <div key={day} className={`text-center text-xs font-bold uppercase tracking-wider ${isLightTheme ? 'text-gray-500' : 'text-gray-400'}`}>{day}</div>
                  ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: startDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className={`h-20 rounded-xl border border-transparent ${isLightTheme ? 'bg-gray-50' : 'bg-gray-900'}`}></div>
                  ))}
                  {monthDates.map(date => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const dayName = format(date, 'EEEE');
                      const dayTasks = tasks.filter(t => {
                          const dateMatch = t.date === dateStr || (!t.date && t.day === dayName);
                          if (!dateMatch) return false;
                          if (statusFilter !== 'All' && t.status !== statusFilter) return false;
                          if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
                          return true;
                      });
                      const isToday = isSameDay(date, new Date());
                      const isSelected = isSameDay(date, selectedDate);

                      return (
                          <div 
                              key={date.toISOString()}
                              onClick={() => { setSelectedDate(date); setViewMode('list'); }}
                              className={`h-20 rounded-xl p-1 flex flex-col cursor-pointer transition-all duration-300 border hover:shadow-md ${
                                  isSelected ? 'border-[#1E90FF] bg-[#1E90FF]/5 ring-2 ring-[#1E90FF]/20 scale-[1.02]' : 
                                  isToday ? 'border-[#2ECC71] bg-[#2ECC71]/5' : 
                                  (isLightTheme ? 'border-gray-200 hover:border-[#1E90FF]/50 bg-white' : 'border-gray-700 hover:border-[#1E90FF]/50 bg-gray-800')
                              }`}
                          >
                              <div className={`text-xs font-black text-right p-1 flex justify-between items-center ${isToday ? 'text-[#2ECC71]' : isSelected ? 'text-[#1E90FF]' : (isLightTheme ? 'text-gray-600' : 'text-gray-400')}`}>
                                  {dayTasks.length > 0 ? (
                                      <div className={`w-1.5 h-1.5 rounded-full ${
                                          dayTasks.length >= 3 ? 'bg-tt-red' : 'bg-[#2ECC71]'
                                      }`}></div>
                                  ) : <div></div>}
                                  {format(date, 'd')}
                              </div>
                              <div className="flex-1 overflow-hidden flex flex-col gap-1 mt-1">
                                  {dayTasks.slice(0, 3).map(t => (
                                      <div key={t.id} className={`w-full h-1.5 rounded-full ${
                                          (t.priority === TaskPriority.HIGH || t.priority === TaskPriority.URGENT) ? 'bg-[#FF4D4D]' : 
                                          (t.priority === TaskPriority.MEDIUM || t.priority === TaskPriority.IMPORTANT) ? 'bg-yellow-500' : 
                                          'bg-[#1E90FF]'
                                      }`}></div>
                                  ))}
                                  {dayTasks.length > 3 && (
                                      <div className="text-[10px] text-center text-gray-400 font-bold">+{dayTasks.length - 3}</div>
                                  )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {taskToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className={`w-[90%] max-w-sm p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 ${isLightTheme ? 'bg-white' : 'bg-gray-900 border border-gray-800'}`}>
                  <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                          <Trash2 className="text-red-500" size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-current">Delete Task</h3>
                          <p className="text-sm opacity-70">This action cannot be undone.</p>
                      </div>
                  </div>
                  <p className={`text-sm mb-6 ${isLightTheme ? 'text-gray-600' : 'text-gray-400'}`}>
                      Are you sure you want to permanently delete <span className="font-bold text-current">"{taskToDelete.title}"</span>?
                  </p>
                  <div className="flex gap-3">
                      <button 
                          onClick={() => setTaskToDelete(null)}
                          className={`flex-1 py-3 rounded-xl font-bold transition-colors ${isLightTheme ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
                      >
                          No, Cancel
                      </button>
                      <button 
                          onClick={() => {
                              deleteTasks([taskToDelete.id]);
                              setTaskToDelete(null);
                          }}
                          className="flex-1 py-3 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-500/30"
                      >
                          Yes, Delete
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
    </DragDropContext>
  );
};

export default Tasks;