import React, { useEffect, ReactNode, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TaskProvider } from './contexts/TaskContext';
import { AnnouncementProvider } from './contexts/AnnouncementContext';
import { AIProvider } from './contexts/AIContext';
import { UsageProvider } from './contexts/UsageContext';
import { LectureProvider } from './contexts/LectureContext';
import Layout from './components/Layout';
import { Loader } from 'lucide-react';

const Home = lazy(() => import('./pages/Home'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Profile = lazy(() => import('./pages/Profile'));
const Auth = lazy(() => import('./pages/Auth'));
const AddTask = lazy(() => import('./pages/AddTask'));
const ReviewTimetable = lazy(() => import('./pages/ReviewTimetable'));
const GenerateTimetable = lazy(() => import('./pages/GenerateTimetable'));
const Notifications = lazy(() => import('./pages/Notifications'));
const AICompanion = lazy(() => import('./pages/AICompanion'));
const Lectures = lazy(() => import('./pages/Lectures'));
const ExamMode = lazy(() => import('./pages/ExamMode'));
const StudyMaterials = lazy(() => import('./pages/StudyMaterials'));

const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <Loader className="animate-spin text-tt-blue" size={48} />
    </div>
);

const ProtectedRoute = ({ children }: { children?: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" />;
};

const AppContent = () => {
    const { user } = useAuth();
    
    // Request notification permission on mount
    useEffect(() => {
        if ('Notification' in window) {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        const theme = user?.aiSettings?.theme || (user?.aiSettings?.natureThemeEnabled ? 'nature' : 'dark');
        document.body.className = ''; // Reset classes
        document.body.style.removeProperty('--custom-theme-color');
        document.body.style.removeProperty('--custom-text-color');
        document.body.style.removeProperty('--custom-glass-bg');
        
        if (theme === 'custom' && user?.aiSettings?.customThemeColor) {
            document.body.classList.add('custom-theme');
            document.body.style.setProperty('--custom-theme-color', user.aiSettings.customThemeColor);
            
            // Calculate brightness safely
            let r = 0, g = 0, b = 0;
            const hexMatch = user.aiSettings.customThemeColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
            if (hexMatch) {
                r = parseInt(hexMatch[1], 16);
                g = parseInt(hexMatch[2], 16);
                b = parseInt(hexMatch[3], 16);
            } else if (user.aiSettings.customThemeColor === 'white' || user.aiSettings.customThemeColor.includes('light')) {
                r = 255; g = 255; b = 255;
            } else {
                // Default to a dark baseline for unknown names like 'red' if no hex match
                r = 0; g = 0; b = 0;
            }
            const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            
            if (brightness > 155) {
                document.body.style.setProperty('--custom-text-color', '#111827');
                document.body.style.setProperty('--custom-glass-bg', 'rgba(255, 255, 255, 0.4)');
            } else {
                document.body.style.setProperty('--custom-text-color', '#ffffff');
                document.body.style.setProperty('--custom-glass-bg', 'rgba(0, 0, 0, 0.3)');
            }
        } else if (theme && theme !== 'dark') {
            const cleanTheme = theme.replace(/\s+/g, '-');
            document.body.classList.add(`${cleanTheme}-theme`);
        }
    }, [user?.aiSettings?.theme, user?.aiSettings?.natureThemeEnabled, user?.aiSettings?.customThemeColor]);

    return (
        <Suspense fallback={<LoadingFallback />}>
            <Routes>
                <Route path="/auth" element={<Auth />} />
                
                <Route path="/" element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }>
                    <Route index element={<Home />} />
                    <Route path="tasks" element={<Tasks />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="add" element={<AddTask />} />
                    <Route path="review" element={<ReviewTimetable />} />
                    <Route path="generate" element={<GenerateTimetable />} />
                    <Route path="notifications" element={<Notifications />} />
                    <Route path="ai-companion" element={<AICompanion />} />
                    <Route path="lectures" element={<Lectures />} />
                    <Route path="exams" element={<ExamMode />} />
                    <Route path="study-materials" element={<StudyMaterials />} />
                </Route>
            </Routes>
        </Suspense>
    );
};

const App = () => {
  return (
    <AuthProvider>
      <UsageProvider>
        <AnnouncementProvider>
          <TaskProvider>
              <LectureProvider>
                  <AIProvider>
                      <HashRouter>
                          <AppContent />
                      </HashRouter>
                  </AIProvider>
              </LectureProvider>
          </TaskProvider>
        </AnnouncementProvider>
      </UsageProvider>
    </AuthProvider>
  );
};

export default App;