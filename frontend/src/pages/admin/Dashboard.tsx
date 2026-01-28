import Applications from './Applications';
import Settings from './Settings';
import Announcements from './Announcements';
import { useLocation } from 'react-router-dom';

export default function Dashboard() {
  const location = useLocation();

  // Get active tab from URL query params
  const searchParams = new URLSearchParams(location.search);
  const activeTab = (searchParams.get('tab') as 'applications' | 'settings' | 'announcements') || 'applications';

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-64px)] bg-default-50/50">
      {/* Main Content Area */}
      <div className="flex-grow container mx-auto px-6 py-8">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'applications' ? <Applications /> : 
           activeTab === 'announcements' ? <Announcements /> : <Settings />}
        </div>
      </div>
    </div>
  );
}
