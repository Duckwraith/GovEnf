import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState({
    app_title: 'GovEnforce',
    organisation_name: 'Council Enforcement',
    logo_base64: null,
    enable_public_reporting: true
  });
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPublicSettings();
  }, []);

  const fetchPublicSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings/public`);
      setBranding(response.data);
    } catch (error) {
      console.error('Failed to fetch branding:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F2F1] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-in">
        {/* Header */}
        <div className="text-center mb-8">
          {branding.logo_base64 ? (
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-lg shadow-sm mb-4 overflow-hidden">
              <img 
                src={branding.logo_base64} 
                alt="Logo" 
                className="w-full h-full object-contain p-2"
                data-testid="login-logo"
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#005EA5] rounded-sm mb-4">
              <Shield className="w-10 h-10 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-[#0B0C0C]" data-testid="login-app-title">
            {branding.app_title}
          </h1>
          <p className="text-[#505A5F] mt-1" data-testid="login-org-name">
            {branding.organisation_name}
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-sm" data-testid="login-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@council.gov.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="email-input"
                  className="h-11"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="password-input"
                    className="h-11 pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#505A5F] hover:text-[#0B0C0C]"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#005EA5] hover:bg-[#004F8C]"
                data-testid="login-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 p-4 bg-[#F3F2F1] rounded-sm">
              <p className="text-xs font-medium text-[#505A5F] mb-2">Demo Accounts:</p>
              <div className="space-y-1 text-xs text-[#0B0C0C] font-mono">
                <p>Manager: admin@council.gov.uk / admin123</p>
                <p>Supervisor: supervisor@council.gov.uk / super123</p>
                <p>Officer: officer@council.gov.uk / officer123</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Public Report Link */}
        {branding.enable_public_reporting && (
          <p className="text-center mt-6 text-sm text-[#505A5F]">
            Member of the public?{' '}
            <a href="/report" className="text-[#005EA5] hover:underline" data-testid="public-report-link">
              Report an issue
            </a>
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
