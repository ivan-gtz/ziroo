import React from 'react';
import { ChefHat } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface WelcomeScreenProps {
  branchId?: string;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ branchId }) => {
  const { systemSettings, allSettings, activeBranchId } = useAppContext();

  // Determine effective settings
  // 1. Try passed branchId (for public pages)
  // 2. Try activeBranchId (for internal dashboard)
  const effectiveBranchId = branchId || activeBranchId;
  const branchSettings = effectiveBranchId ? allSettings[effectiveBranchId] : null;
  const config = branchSettings?.animationConfig;

  // Styles logic
  const bgColor = config?.backgroundColor || '#06c167'; // Default Ziroo Green
  const textColor = config?.textColor || '#ffffff';
  const rawText = config?.text || systemSettings.appTitle || 'Ziroo chef';
  const displayText = rawText.replace(/app/gi, 'chef');
  // Ensure 'chef' shows if the text is Ziroo (default) or if it doesn't already contain it
  const displaySubText = (!displayText || displayText.toLowerCase().trim() === 'ziroo') ? 'chef' : '';

  // Determine logo
  const [imgError, setImgError] = React.useState(false);
  let logoSrc = '';
  let useDefaultIcon = false;

  if (config?.logoUrl && !imgError) {
    logoSrc = config.logoUrl;
  } else if (systemSettings.logoAnimation && !imgError) {
    logoSrc = systemSettings.logoAnimation;
  } else {
    useDefaultIcon = true;
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-[9999] overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      {/* Background Subtle Zoom */}
      <div className="absolute inset-0 animate-splash-bg" style={{ backgroundColor: bgColor }} />

      <div className="relative flex flex-col items-center z-10">
        <div className="animate-splash-logo opacity-0 mb-6 flex items-center justify-center">
          {logoSrc && !useDefaultIcon ? (
            <img
              src={logoSrc}
              alt="Logo"
              onError={() => setImgError(true)}
              className="h-44 w-44 object-contain"
              style={{
                filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.2))',
                imageRendering: 'auto'
              }}
            />
          ) : (
            <div className="h-44 w-44 flex items-center justify-center p-8 bg-white/10 rounded-[2.5rem] backdrop-blur-md border border-white/20 shadow-2xl animate-pulse">
                <ChefHat size={120} className="text-white drop-shadow-2xl" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center animate-splash-text opacity-0">
          <h1 className="text-6xl font-black leading-none tracking-tighter" style={{ color: textColor }}>
            {displayText}<span className="text-primary-400">.</span>
          </h1>
          {displaySubText && (
            <span
              className="text-lg font-bold uppercase tracking-[0.5em] leading-none mt-2 flex items-center gap-2"
              style={{ color: textColor, opacity: 0.8 }}
            >
              <div className="h-[1px] w-4 bg-current opacity-30"></div>
              {displaySubText}
              <div className="h-[1px] w-4 bg-current opacity-30"></div>
            </span>
          )}
        </div>
      </div>

      {/* Loading bar at bottom */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-white/60 animate-[loading-bar_2s_ease-in-out_forwards]"></div>
      </div>
    </div>
  );
};

export default WelcomeScreen;