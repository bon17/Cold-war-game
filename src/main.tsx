import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/gowun-batang/400.css';
import '@fontsource/gowun-batang/700.css';
import '@fontsource/nanum-myeongjo/400.css';
import '@fontsource/nanum-myeongjo/800.css';
import '@fontsource/nanum-gothic-coding/400.css';
import '@fontsource/nanum-gothic-coding/700.css';
import '@fontsource/gaegu/700.css';
import './styles/tokens.css';
import './styles/global.css';
import { strings } from './lib/data';
import App from './App';

document.title = strings.title;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
