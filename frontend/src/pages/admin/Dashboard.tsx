import Applications from './Applications';
import Settings from './Settings';
import Announcements from './Announcements';
import Admins from './Admins';
import AuditLogs from './AuditLogs';
import Tickets from './Tickets';
import Messages from './Messages';
import Overview from './Overview';
import { useLocation } from 'react-router-dom';
import { storage } from '../../utils/storage';

export default function Dashboard() {
  const location = useLocation();

  // Get user role from localStorage
  const user = storage.get('admin_user');
  const role = user.role || 'reviewer';

  // Get active tab from URL query params
  const searchParams = new URLSearchParams(location.search);
  const activeTab = (searchParams.get('tab') as 'overview' | 'applications' | 'settings' | 'announcements' | 'admins' | 'audit-logs' | 'tickets' | 'messages') || 'overview';

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-64px)] bg-default-50/50">
      {/* Main Content Area */}
      <div className="flex-grow container mx-auto px-6 py-8">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'applications' && <Applications />}
          {activeTab === 'tickets' && <Tickets />}
          {activeTab === 'messages' && <Messages />}
          {activeTab === 'announcements' && role === 'super' && <Announcements />}
          {activeTab === 'settings' && role === 'super' && <Settings />}
          {activeTab === 'admins' && role === 'super' && <Admins />}
          {activeTab === 'audit-logs' && role === 'super' && <AuditLogs />}
        </div>
      </div>
    </div>
  );
}
