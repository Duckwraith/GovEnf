import { createContext, useContext, useState, useEffect } from 'react';

const MobileViewContext = createContext();

export const useMobileView = () => {
  const context = useContext(MobileViewContext);
  if (!context) {
    throw new Error('useMobileView must be used within a MobileViewProvider');
  }
  return context;
};

export const MobileViewProvider = ({ children }) => {
  // Check if device is actually mobile
  const detectMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  };

  const [isMobileDevice, setIsMobileDevice] = useState(detectMobile());
  const [mobileViewEnabled, setMobileViewEnabled] = useState(() => {
    const stored = localStorage.getItem('mobileViewEnabled');
    if (stored !== null) {
      return JSON.parse(stored);
    }
    return detectMobile(); // Default to auto-detect
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileDevice(detectMobile());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('mobileViewEnabled', JSON.stringify(mobileViewEnabled));
    
    // Add/remove mobile class to body
    if (mobileViewEnabled) {
      document.body.classList.add('mobile-view');
    } else {
      document.body.classList.remove('mobile-view');
    }
  }, [mobileViewEnabled]);

  const toggleMobileView = () => {
    setMobileViewEnabled(prev => !prev);
  };

  return (
    <MobileViewContext.Provider value={{
      isMobileDevice,
      mobileViewEnabled,
      setMobileViewEnabled,
      toggleMobileView
    }}>
      {children}
    </MobileViewContext.Provider>
  );
};

export default MobileViewProvider;
