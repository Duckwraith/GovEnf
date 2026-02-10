import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMobileView } from '@/contexts/MobileViewContext';
import axios from 'axios';
import {
  LayoutDashboard,
  FileText,
  Map,
  Users,
  Users2,
  Settings,
  BarChart3,
  Receipt,
  Bell,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronDown,
  Smartphone,
  Monitor,
  UserCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Layout = () => {
  const { user, logout } = useAuth();
  const { mobileViewEnabled, toggleMobileView, isMobileDevice } = useMobileView();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [systemSettings, setSystemSettings] = useState({
    app_title: 'GovEnforce',
    organisation_name: 'Council Enforcement',
    logo_base64: null
  });

  const fetchSystemSettings = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSystemSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch system settings:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/notifications`);
      setNotifications(response.data);
      setUnreadCount(response.data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchSystemSettings();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, fetchSystemSettings]);

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put(`${API}/notifications/mark-all-read`);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['officer', 'supervisor', 'manager'] },
    { path: '/cases', label: 'Cases', icon: FileText, roles: ['officer', 'supervisor', 'manager'] },
    { path: '/map', label: 'Map View', icon: Map, roles: ['officer', 'supervisor', 'manager'] },
    { path: '/persons', label: 'Persons', icon: UserCircle, roles: ['supervisor', 'manager'] },
    { path: '/users', label: 'User Management', icon: Users, roles: ['manager'] },
    { path: '/teams', label: 'Teams', icon: Users2, roles: ['manager'] },
    { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['supervisor', 'manager'] },
    { path: '/fpn-reports', label: 'FPN Reports', icon: Receipt, roles: ['supervisor', 'manager'] },
    { path: '/settings', label: 'Admin Settings', icon: Settings, roles: ['manager'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'manager': return 'bg-purple-100 text-purple-800';
      case 'supervisor': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`app-layout ${mobileViewEnabled ? 'mobile-active' : ''}`}>
      {/* Mobile Menu Button - only show when NOT in mobile view mode */}
      {!mobileViewEnabled && (
        <button
          data-testid="mobile-menu-btn"
          className="fixed top-4 left-4 z-50 md:hidden p-2 bg-white rounded-sm shadow-sm border"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} data-testid="sidebar">
        <div className="sidebar-header">
          <div className="flex items-center gap-3">
            {systemSettings.logo_base64 ? (
              <div className="w-10 h-10 rounded-sm overflow-hidden flex items-center justify-center bg-white">
                <img 
                  src={systemSettings.logo_base64} 
                  alt="Logo" 
                  className="w-full h-full object-contain"
                  data-testid="sidebar-logo"
                />
              </div>
            ) : (
              <div className="w-10 h-10 bg-[#005EA5] rounded-sm flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="font-semibold text-lg text-[#0B0C0C]">{systemSettings.app_title || 'GovEnforce'}</h1>
              <p className="text-xs text-[#505A5F]">{systemSettings.organisation_name || 'Council Enforcement'}</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.path.replace('/', '')}`}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F3F2F1] rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-[#0B0C0C]">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0B0C0C] truncate">{user?.name}</p>
              <span className={`inline-block px-2 py-0.5 text-xs rounded-full capitalize ${getRoleBadgeColor(user?.role)}`}>
                {user?.role}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              data-testid="logout-btn"
              onClick={handleLogout}
              className="text-[#505A5F] hover:text-[#D4351C]"
            >
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          {/* Mobile view: Show logo and title */}
          {mobileViewEnabled ? (
            <div className="flex items-center gap-2">
              {systemSettings.logo_base64 ? (
                <img 
                  src={systemSettings.logo_base64} 
                  alt="Logo" 
                  className="w-8 h-8 object-contain"
                />
              ) : (
                <Shield className="w-6 h-6 text-[#005EA5]" />
              )}
              <span className="font-semibold text-[#0B0C0C] text-sm">{systemSettings.app_title || 'GovEnforce'}</span>
            </div>
          ) : (
            <>
              <div className="md:hidden w-10" /> {/* Spacer for mobile menu button */}
              <h2 className="text-lg font-semibold text-[#0B0C0C] hidden md:block">
                {filteredNavItems.find(item => location.pathname.startsWith(item.path))?.label || 'GovEnforce'}
              </h2>
            </>
          )}
          
          <div className="flex items-center gap-4">
            {/* Mobile View Toggle */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full" data-testid="mobile-view-toggle">
              <Monitor size={16} className={!mobileViewEnabled ? 'text-[#005EA5]' : 'text-gray-400'} />
              <Switch
                checked={mobileViewEnabled}
                onCheckedChange={toggleMobileView}
                className="data-[state=checked]:bg-[#005EA5]"
              />
              <Smartphone size={16} className={mobileViewEnabled ? 'text-[#005EA5]' : 'text-gray-400'} />
            </div>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#D4351C] text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80" data-testid="notifications-dropdown">
                <div className="flex items-center justify-between px-4 py-2 border-b">
                  <span className="font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs text-[#005EA5]"
                      onClick={markAllAsRead}
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[300px]">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-[#505A5F]">
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className={`p-4 cursor-pointer ${!notification.is_read ? 'bg-blue-50' : ''}`}
                        onClick={() => {
                          markAsRead(notification.id);
                          if (notification.case_id) {
                            navigate(`/cases/${notification.case_id}`);
                          }
                        }}
                      >
                        <div>
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-xs text-[#505A5F] mt-1">{notification.message}</p>
                          <p className="text-xs text-[#B1B4B6] mt-1">
                            {new Date(notification.created_at).toLocaleString('en-GB')}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2" data-testid="user-menu-btn">
                  <div className="w-8 h-8 bg-[#F3F2F1] rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">{user?.name?.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="hidden md:inline text-sm">{user?.name}</span>
                  <ChevronDown size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" data-testid="user-dropdown">
                <div className="px-4 py-2 border-b">
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-xs text-[#505A5F]">{user?.email}</p>
                </div>
                {/* Mobile view toggle in dropdown for small screens */}
                <div className="sm:hidden px-4 py-2 border-b">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#505A5F]">Mobile View</span>
                    <div className="flex items-center gap-2">
                      <Monitor size={14} className={!mobileViewEnabled ? 'text-[#005EA5]' : 'text-gray-400'} />
                      <Switch
                        checked={mobileViewEnabled}
                        onCheckedChange={toggleMobileView}
                        className="data-[state=checked]:bg-[#005EA5]"
                      />
                      <Smartphone size={14} className={mobileViewEnabled ? 'text-[#005EA5]' : 'text-gray-400'} />
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-[#D4351C]">
                  <LogOut size={16} className="mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 md:p-8 animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
