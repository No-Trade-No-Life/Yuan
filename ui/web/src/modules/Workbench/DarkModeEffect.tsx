import { useEffect, useState } from 'react';
import { useIsDarkMode } from './darkmode';
import DarkCSS from 'flexlayout-react/style/dark.css?raw';
import LightCSS from 'flexlayout-react/style/light.css?raw';

export const DarkModeEffect = () => {
  const isDarkMode = useIsDarkMode();

  const [style, setStyle] = useState('');

  useEffect(() => {
    // ISSUE: use css by raw import will not produce side-effect. we can easily switch between dark and light
    if (isDarkMode) {
      setStyle(DarkCSS);
      //   import('flexlayout-react/style/dark.css?raw').then((mod) => setStyle(mod.default));
    } else {
      setStyle(LightCSS);
      //   import('flexlayout-react/style/light.css?raw').then((mod) => setStyle(mod.default));
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (isDarkMode) {
      if (!document.body.hasAttribute('theme-mode')) {
        document.body.setAttribute('theme-mode', 'dark');
      }
    } else {
      if (document.body.hasAttribute('theme-mode')) {
        document.body.removeAttribute('theme-mode');
      }
    }
  }, [isDarkMode]);

  return <style>{style}</style>;
};
